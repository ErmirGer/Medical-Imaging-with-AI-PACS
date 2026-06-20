from __future__ import annotations

import logging
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlmodel import select

from ..config import settings
from ..db import get_session
from ..models import Alert, Finding, Patient, Study
from ..schemas import (
    AlertOut,
    FindingOut,
    ImageUrls,
    PacsOut,
    PatientOut,
    ReportOut,
    StudyOut,
)
from ..services import notify
from ..services.pipeline import UPLOADS_DIR, process

log = logging.getLogger("radguard.studies")
router = APIRouter(prefix="/api", tags=["studies"])


def to_study_out(study: Study, session) -> StudyOut:
    patient = session.get(Patient, study.patient_id)
    findings = session.exec(
        select(Finding).where(Finding.study_id == study.id)
    ).all()
    alert = session.exec(select(Alert).where(Alert.study_id == study.id)).first()
    return StudyOut(
        id=study.id,
        patient=PatientOut(
            id=patient.id if patient else "",
            name=patient.name if patient else "Unknown",
            age=patient.age if patient else 0,
            sex=patient.sex if patient else "U",
        ),
        modality=study.modality,
        uploaded_at=study.uploaded_at.isoformat(),
        risk_score=study.risk_score,
        risk_band=study.risk_band,
        top_finding=study.top_finding,
        findings=[
            FindingOut(
                pathology=f.pathology,
                probability=round(f.probability, 3),
                contribution=round(f.contribution, 3),
            )
            for f in sorted(findings, key=lambda f: f.probability, reverse=True)
        ],
        report=ReportOut(
            impression_en=study.report_en,
            impression_sq=study.report_sq,
            recommendation_en=study.recommendation_en,
            recommendation_sq=study.recommendation_sq,
        ),
        pacs=PacsOut(
            study_instance_uid=study.pacs_study_uid,
            orthanc_id=study.pacs_orthanc_id,
            archived=study.archived,
        ),
        image_urls=ImageUrls(
            original=f"/api/studies/{study.id}/image?type=original",
            heatmap=f"/api/studies/{study.id}/image?type=heatmap",
        ),
        alert=AlertOut(
            sent=alert is not None,
            department=alert.department if alert else "",
            acknowledged=alert.acknowledged if alert else False,
        )
        if alert
        else None,
    )


def persist_study(results: dict, patient: dict, session) -> Study:
    """Persist pipeline results to a Study + Findings rows. Caller commits."""
    risk = results["risk"]
    rep = results["report"]
    study = Study(
        patient_id=patient["id"],
        modality="DX",
        original_path=results["original_png"],
        heatmap_path=results["heatmap_png"],
        pacs_study_uid=results["pacs"]["study_instance_uid"],
        pacs_orthanc_id=results["pacs"]["orthanc_id"],
        archived=results["pacs"]["archived"],
        risk_score=risk["score"],
        risk_band=risk["band"],
        top_finding=risk["driver"],
        report_en=rep["impression_en"],
        report_sq=rep["impression_sq"],
        recommendation_en=rep["recommendation_en"],
        recommendation_sq=rep["recommendation_sq"],
    )
    session.add(study)
    session.commit()
    session.refresh(study)
    for f in risk["top_findings"]:
        session.add(
            Finding(
                study_id=study.id,
                pathology=f["pathology"],
                probability=f["probability"],
                contribution=f["contribution"],
            )
        )
    session.commit()
    session.refresh(study)
    return study


@router.post("/studies", response_model=StudyOut)
async def create_study(
    file: UploadFile = File(...),
    patient_id: str | None = Form(None),
):
    # 1. save upload
    suffix = Path(file.filename or "upload.png").suffix or ".png"
    dst = UPLOADS_DIR / f"{uuid.uuid4().hex[:12]}{suffix}"
    with open(dst, "wb") as f:
        shutil.copyfileobj(file.file, f)

    with get_session() as session:
        # resolve / create patient
        patient = None
        if patient_id:
            patient = session.get(Patient, patient_id)
        if patient is None:
            pid = patient_id or f"P-{uuid.uuid4().hex[:6].upper()}"
            patient = Patient(id=pid, name="Walk-in Patient", age=50, sex="U")
            session.add(patient)
            session.commit()
            session.refresh(patient)
        patient_d = {
            "id": patient.id,
            "name": patient.name,
            "age": patient.age,
            "sex": patient.sex,
        }

        # 2-6 pipeline
        results = process(str(dst), patient_d)

        # 7. persist
        study = persist_study(results, patient_d, session)

        # 8. high-risk alert
        if study.risk_band == "High" or study.risk_score >= settings.HIGH_RISK_THRESHOLD:
            dept = "Emergency"
            session.add(
                Alert(
                    study_id=study.id,
                    department=dept,
                    channel="sse+telegram",
                )
            )
            session.commit()
            await notify.fire_high_risk(study, patient.name, dept)

        out = to_study_out(study, session)
    return out


@router.get("/studies", response_model=list[StudyOut])
def list_studies(sort: str | None = None):
    with get_session() as session:
        studies = session.exec(select(Study)).all()
        if sort == "risk":
            studies = sorted(studies, key=lambda s: s.risk_score, reverse=True)
        else:
            studies = sorted(studies, key=lambda s: s.uploaded_at, reverse=True)
        return [to_study_out(s, session) for s in studies]


@router.get("/studies/{study_id}", response_model=StudyOut)
def get_study(study_id: int):
    with get_session() as session:
        study = session.get(Study, study_id)
        if not study:
            raise HTTPException(404, "study not found")
        return to_study_out(study, session)


@router.get("/studies/{study_id}/image")
def get_image(study_id: int, type: str = "original"):
    with get_session() as session:
        study = session.get(Study, study_id)
        if not study:
            raise HTTPException(404, "study not found")
        path = study.heatmap_path if type == "heatmap" else study.original_path
        if not path or not Path(path).exists():
            raise HTTPException(404, "image not found")
        return FileResponse(path, media_type="image/png")


@router.post("/studies/{study_id}/ack")
def ack_alert(study_id: int):
    with get_session() as session:
        alert = session.exec(select(Alert).where(Alert.study_id == study_id)).first()
        if not alert:
            raise HTTPException(404, "no alert for study")
        alert.acknowledged = True
        session.add(alert)
        session.commit()
        return {"acknowledged": True, "study_id": study_id}


@router.post("/seed")
def seed():
    from ..services.seed import run_seed

    return run_seed()

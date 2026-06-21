from __future__ import annotations

import json
import logging
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlmodel import select

from ..config import settings
from ..db import get_session
from ..models import Account, Alert, Finding, Patient, Study
from ..services import auth
from ..schemas import (
    AlertOut,
    ClinicalOut,
    ConfidenceOut,
    FindingOut,
    ImageUrls,
    PacsOut,
    PatientOut,
    ReportOut,
    StudyOut,
)
from ..services import notify
from ..services.inference import PATHOLOGY_SQ, POPULATION_RATES, severity_from_prob
from ..services.pipeline import UPLOADS_DIR, ImageRejected, process

log = logging.getLogger("radguard.studies")
router = APIRouter(prefix="/api", tags=["studies"])


def _parse_factors(raw: str) -> list[str]:
    if not raw:
        return []
    try:
        val = json.loads(raw)
        return val if isinstance(val, list) else []
    except Exception:
        return []


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
        region=study.region,
        analysis_source=study.analysis_source or "model",
        heatmap_available=bool(
            study.heatmap_path and study.heatmap_path != study.original_path
        ),
        uploaded_at=study.uploaded_at.isoformat(),
        risk_score=study.risk_score,
        risk_base=study.risk_base or study.risk_score,
        risk_band=study.risk_band,
        top_finding=study.top_finding,
        top_finding_sq=study.top_finding_sq or study.top_finding,
        findings=[
            FindingOut(
                pathology=f.pathology,
                pathology_sq=f.pathology_sq or f.pathology,
                probability=round(f.probability, 3),
                contribution=round(f.contribution, 3),
                severity=f.severity or "mild",
                # only real for chest pathologies; None (no reference) otherwise
                population_rate=POPULATION_RATES.get(f.pathology),
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
        confidence=ConfidenceOut(
            score=study.confidence,
            band=study.confidence_band or "Moderate",
            note=study.confidence_note,
            note_sq=study.confidence_note_sq or study.confidence_note,
            double_check=study.double_check,
        ),
        clinical=ClinicalOut(
            symptoms=study.symptoms,
            temperature=study.temperature,
            spo2=study.spo2,
            smoker=study.smoker,
            adjustment=study.clinical_adjustment,
            factors=_parse_factors(study.clinical_factors),
            provided=bool(
                study.symptoms
                or study.temperature
                or study.spo2
                or study.smoker
            ),
        ),
        alert=AlertOut(
            sent=alert is not None,
            department=alert.department if alert else "",
            acknowledged=alert.acknowledged if alert else False,
        )
        if alert
        else None,
    )


def persist_study(
    results: dict, patient: dict, session, owner_account_id: int | None = None
) -> Study:
    """Persist pipeline results to a Study + Findings rows. Caller commits."""
    risk = results["risk"]
    rep = results["report"]
    clinical = results.get("clinical") or {}
    conf = results.get("confidence") or {}
    study = Study(
        patient_id=patient["id"],
        owner_account_id=owner_account_id,
        modality=results.get("modality", "DX"),
        region=results.get("region", "") or "",
        analysis_source=results.get("analysis_source", "model"),
        original_path=results["original_png"],
        heatmap_path=results["heatmap_png"],
        pacs_study_uid=results["pacs"]["study_instance_uid"],
        pacs_orthanc_id=results["pacs"]["orthanc_id"],
        archived=results["pacs"]["archived"],
        symptoms=clinical.get("symptoms", "") or "",
        temperature=float(clinical.get("temperature") or 0),
        spo2=int(clinical.get("spo2") or 0),
        smoker=bool(clinical.get("smoker")),
        clinical_adjustment=risk.get("clinical_adjustment", 0),
        clinical_factors=json.dumps(risk.get("clinical_factors", [])),
        risk_score=risk["score"],
        risk_base=risk.get("base_score", risk["score"]),
        risk_band=risk["band"],
        top_finding=risk["driver"],
        top_finding_sq=results.get("top_finding_sq", "") or risk["driver"],
        confidence=conf.get("score", 0),
        confidence_band=conf.get("band", ""),
        confidence_note=conf.get("note", ""),
        confidence_note_sq=conf.get("note_sq", ""),
        double_check=bool(conf.get("double_check", False)),
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
                pathology_sq=f.get("pathology_sq")
                or PATHOLOGY_SQ.get(f["pathology"], f["pathology"]),
                probability=f["probability"],
                contribution=f["contribution"],
                severity=f.get("severity") or severity_from_prob(f["probability"]),
            )
        )
    session.commit()
    session.refresh(study)
    return study


@router.post("/studies", response_model=StudyOut)
async def create_study(
    file: UploadFile = File(...),
    patient_id: str | None = Form(None),
    patient_name: str | None = Form(None),
    age: int | None = Form(None),
    sex: str | None = Form(None),
    modality: str = Form("DX"),
    symptoms: str | None = Form(None),
    temperature: float | None = Form(None),
    spo2: int | None = Form(None),
    smoker: bool = Form(False),
    account: Account = Depends(auth.require_doctor),
):
    # 0. require patient identity before any analysis runs
    name = (patient_name or "").strip()
    if not name:
        raise HTTPException(422, "Patient name is required.")
    if age is None or age <= 0:
        raise HTTPException(422, "Patient age is required.")
    if (sex or "").upper() not in {"M", "F", "O"}:
        raise HTTPException(422, "Patient sex is required.")

    # 1. save upload
    suffix = Path(file.filename or "upload.png").suffix or ".png"
    dst = UPLOADS_DIR / f"{uuid.uuid4().hex[:12]}{suffix}"
    with open(dst, "wb") as f:
        shutil.copyfileobj(file.file, f)

    clinical = {
        "symptoms": (symptoms or "").strip(),
        "temperature": temperature or 0,
        "spo2": spo2 or 0,
        "smoker": bool(smoker),
    }

    pid = patient_id or f"P-{uuid.uuid4().hex[:6].upper()}"
    patient_d = {"id": pid, "name": name, "age": age, "sex": sex.upper()}

    # 2-6 pipeline runs FIRST (vision triage + quality gate) — nothing is written
    # to the DB if the image is rejected, so no orphan patient/study is left behind.
    try:
        results = process(str(dst), patient_d, clinical=clinical, modality=modality)
    except ImageRejected as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    with get_session() as session:
        # resolve / create patient only after a successful analysis
        patient = None
        if patient_id:
            # an explicit Patient ID is the canonical key — it distinguishes
            # different people who share a name/age/sex, so never merge by name
            patient = session.get(Patient, patient_id)
        else:
            # no ID given: group repeat uploads by name + age + sex so multiple
            # studies accumulate under one record
            patient = session.exec(
                select(Patient).where(
                    Patient.name == name,
                    Patient.age == age,
                    Patient.sex == sex.upper(),
                )
            ).first()
        if patient is None:
            patient = Patient(id=pid, name=name, age=age, sex=sex.upper())
            session.add(patient)
            session.commit()
            session.refresh(patient)
        patient_d["id"] = patient.id

        # 7. persist (owned by the uploading doctor)
        study = persist_study(results, patient_d, session, owner_account_id=account.id)

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
def list_studies(
    sort: str | None = None,
    patient_id: str | None = None,
    account: Account = Depends(auth.get_account),
):
    with get_session() as session:
        query = select(Study)
        if account.role == "patient":
            # patients only ever see their own record's studies
            query = query.where(Study.patient_id == (account.patient_id or "__none__"))
        else:
            # doctors see studies they own; optional further filter by patient
            query = query.where(Study.owner_account_id == account.id)
            if patient_id:
                query = query.where(Study.patient_id == patient_id)
        studies = session.exec(query).all()
        if sort == "risk":
            studies = sorted(studies, key=lambda s: s.risk_score, reverse=True)
        else:
            studies = sorted(studies, key=lambda s: s.uploaded_at, reverse=True)
        return [to_study_out(s, session) for s in studies]


@router.get("/studies/{study_id}", response_model=StudyOut)
def get_study(study_id: int, account: Account = Depends(auth.get_account)):
    with get_session() as session:
        study = session.get(Study, study_id)
        if not study or not auth.can_access_study(study, account):
            raise HTTPException(404, "study not found")
        return to_study_out(study, session)


@router.get("/studies/{study_id}/image")
def get_image(
    study_id: int,
    type: str = "original",
    authorization: str | None = Header(default=None),
    token: str | None = None,
):
    # <img> tags can't send headers, so allow ?token= as a fallback
    account = auth.get_account(authorization or (f"Bearer {token}" if token else None))
    with get_session() as session:
        study = session.get(Study, study_id)
        if not study or not auth.can_access_study(study, account):
            raise HTTPException(404, "study not found")
        path = study.heatmap_path if type == "heatmap" else study.original_path
        if not path or not Path(path).exists():
            raise HTTPException(404, "image not found")
        return FileResponse(path, media_type="image/png")


@router.post("/studies/{study_id}/ack")
def ack_alert(study_id: int, account: Account = Depends(auth.require_doctor)):
    with get_session() as session:
        study = session.get(Study, study_id)
        if not study or not auth.can_access_study(study, account):
            raise HTTPException(404, "study not found")
        alert = session.exec(select(Alert).where(Alert.study_id == study_id)).first()
        if not alert:
            raise HTTPException(404, "no alert for study")
        alert.acknowledged = True
        session.add(alert)
        session.commit()
        return {"acknowledged": True, "study_id": study_id}


@router.get("/studies/{study_id}/comparison")
def comparison(study_id: int, account: Account = Depends(auth.get_account)):
    """Mocked prior-study comparison: find an earlier study for the same patient
    and return a templated progression delta built from the real risk scores.
    """
    with get_session() as session:
        study = session.get(Study, study_id)
        if not study or not auth.can_access_study(study, account):
            raise HTTPException(404, "study not found")
        priors = session.exec(
            select(Study).where(Study.patient_id == study.patient_id)
        ).all()
        priors = [
            s for s in priors if s.id != study.id and s.uploaded_at < study.uploaded_at
        ]
        if not priors:
            return {"has_prior": False}
        prior = max(priors, key=lambda s: s.uploaded_at)
        delta = study.risk_score - prior.risk_score
        direction = "increased" if delta > 0 else "decreased" if delta < 0 else "unchanged"
        drejtim = "rritur" if delta > 0 else "ulur" if delta < 0 else "pa ndryshim"
        return {
            "has_prior": True,
            "prior_id": prior.id,
            "prior_score": prior.risk_score,
            "current_score": study.risk_score,
            "delta": delta,
            "prior_finding": prior.top_finding,
            "current_finding": study.top_finding,
            "summary_en": (
                f"Compared to the prior study, {study.top_finding.lower()} extent has "
                f"{direction} (risk {prior.risk_score} → {study.risk_score}, Δ{delta:+d})."
            ),
            "summary_sq": (
                f"Krahasuar me studimin e mëparshëm, shtrirja e {study.top_finding.lower()} "
                f"është {drejtim} (rrezik {prior.risk_score} → {study.risk_score}, Δ{delta:+d})."
            ),
        }


@router.post("/seed")
def seed(account: Account = Depends(auth.require_doctor)):
    # seeded demo studies are owned by the doctor who loaded them
    from ..services.seed import run_seed

    return run_seed(owner_account_id=account.id)

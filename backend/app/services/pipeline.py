"""End-to-end study processing: inference -> risk -> heatmap -> PACS -> report.

Kept separate from the router so it can be reused by the seeder and tested
directly. Every external/heavy step is wrapped so the demo never hard-fails.
"""
from __future__ import annotations

import logging
import uuid
from pathlib import Path

from ..config import settings
from . import inference, medgemma, report, vision
from .dicom import png_to_dicom_bytes, push_to_orthanc

log = logging.getLogger("radguard.pipeline")


class ImageRejected(Exception):
    """Raised when an upload cannot be analyzed (not medical / too low quality)."""


def _reject_if_bad(result: dict | None) -> None:
    """Quality / medical gate shared by every analyzer."""
    if result is None:
        return
    if not result.get("is_medical", True):
        raise ImageRejected(
            "This does not appear to be a medical image, so it was not analyzed."
        )
    if result.get("quality") == "poor":
        why = result.get("quality_issue") or "the image is too low quality to read reliably"
        raise ImageRejected(
            f"The image cannot be analyzed: {why}. Please upload a clearer image."
        )

STORAGE = Path(__file__).resolve().parents[2] / "storage"
IMAGES_DIR = STORAGE / "images"
UPLOADS_DIR = STORAGE / "uploads"
for _d in (IMAGES_DIR, UPLOADS_DIR):
    _d.mkdir(parents=True, exist_ok=True)


def process(
    src_path: str,
    patient: dict,
    study_uid: str | None = None,
    clinical: dict | None = None,
    modality: str = "DX",
) -> dict:
    """Run the full pipeline on a saved upload. Returns a dict of results
    to persist on a Study row. `patient` = {id,name,age,sex}.
    `clinical` = optional {symptoms,temperature,spo2,smoker} fused into risk+report.
    """
    token = uuid.uuid4().hex[:12]

    # 0. Cheap resolution gate (no API cost) — reject obviously unusable uploads.
    try:
        from PIL import Image

        with Image.open(src_path) as im:
            w, h = im.size
        if min(w, h) < 64:
            raise ImageRejected(
                "The image resolution is too low to analyze. "
                "Please upload a higher-resolution image."
            )
    except ImageRejected:
        raise
    except Exception as exc:
        log.warning("could not read image dimensions: %s", exc)

    original_png = str(IMAGES_DIR / f"{token}_original.png")
    heatmap_png = str(IMAGES_DIR / f"{token}_heatmap.png")

    # 1. Image analysis. If MedGemma is configured it does the scan analysis
    #    (modality/region/findings/risk); otherwise the built-in analyzers run.
    med = medgemma.analyze(src_path, patient, clinical) if medgemma.is_enabled() else None
    if med is not None:
        _reject_if_bad(med)
        analysis_source = "medgemma"
        is_chest = med["is_chest_xray"]
        region = med["body_region"]
        modality = medgemma.modality_to_dicom(med["modality"])
        driver = med["driver"]
        probs = {f["name"]: f["probability"] for f in med["findings"]}
        try:
            inference.save_display_png(src_path, original_png)
        except Exception as exc:
            log.warning("display png failed: %s", exc)
            original_png = src_path
        heatmap_png = original_png
        # chest: still produce the Grad-CAM localization overlay (visual only)
        if is_chest:
            try:
                cam_probs = inference.predict(src_path)
                inference.heatmap(
                    src_path, max(cam_probs, key=cam_probs.get), heatmap_png
                )
            except Exception as exc:
                log.warning("medgemma chest heatmap failed: %s", exc)
                heatmap_png = original_png
        risk = {
            "score": med["risk_score"],
            "base_score": med["risk_score"],
            "clinical_adjustment": 0,
            "clinical_factors": [],
            "band": med["risk_band"],
            "driver": driver,
            "top_findings": [
                {
                    "pathology": f["name"],
                    "pathology_sq": inference.PATHOLOGY_SQ.get(f["name"], f["name"]),
                    "probability": f["probability"],
                    "contribution": f["probability"],
                    "severity": f.get("severity", "mild"),
                }
                for f in med["findings"][:5]
            ],
        }
        # MedGemma analyzes the image; Claude writes the bilingual report
        rep = report.generate(patient, risk, risk["top_findings"], clinical)
        top_finding_sq = inference.PATHOLOGY_SQ.get(driver, driver)
        confidence = inference.confidence_payload(
            med.get("confidence", 60), reason=med.get("confidence_reason")
        )
        return {
            "probs": probs,
            "risk": risk,
            "original_png": original_png,
            "heatmap_png": heatmap_png,
            "pacs": _archive(src_path, patient, study_uid, modality),
            "report": rep,
            "clinical": clinical or {},
            "modality": modality,
            "region": region,
            "analysis_source": analysis_source,
            "top_finding_sq": top_finding_sq,
            "confidence": confidence,
        }

    # 1b. Vision triage: figure out what this image actually IS before assuming chest.
    vis = vision.analyze(src_path, patient, clinical)
    _reject_if_bad(vis)

    is_chest = vis["is_chest_xray"] if vis else True  # no key/failed -> assume CXR
    region = vis["body_region"] if vis else ""
    if vis:
        modality = vision.modality_to_dicom(vis["modality"])

    if is_chest:
        # --- Chest X-ray: specialized torchxrayvision model + Grad-CAM + deterministic risk
        analysis_source = "model"
        probs = inference.predict(src_path)
        risk = inference.risk_score(probs, clinical)
        driver = risk["driver"]
        try:
            inference.save_original_png(src_path, original_png)
        except Exception as exc:
            log.warning("original png failed: %s", exc)
            original_png = src_path
        try:
            inference.heatmap(src_path, driver, heatmap_png)
        except Exception as exc:
            log.warning("heatmap failed: %s", exc)
            heatmap_png = original_png
        rep = report.generate(patient, risk, risk["top_findings"], clinical)
        top_finding_sq = inference.PATHOLOGY_SQ.get(driver, driver)
        confidence = inference.analysis_confidence(list(probs.values()))
    else:
        # --- Anything else (hand X-ray, CT, MRI, ultrasound...): Claude vision is
        #     the analyzer. No chest model, no Grad-CAM (would be meaningless).
        analysis_source = "vision"
        try:
            # faithful full-frame copy (NOT the chest center-crop) so it isn't zoomed
            inference.save_display_png(src_path, original_png)
        except Exception as exc:
            log.warning("display png failed: %s", exc)
            original_png = src_path
        heatmap_png = original_png  # no localization model for this modality/region
        risk = {
            "score": vis["risk_score"],
            "base_score": vis["risk_score"],
            "clinical_adjustment": 0,
            "clinical_factors": [],
            "band": vis["risk_band"],
            "driver": vis["driver"],
            # population_rate omitted on purpose — no population baseline for arbitrary findings
            "top_findings": [
                {
                    "pathology": f["name"],
                    "pathology_sq": f.get("name_sq", f["name"]),
                    "probability": f["probability"],
                    "contribution": f["probability"],
                    "severity": f.get("severity", "mild"),
                }
                for f in vis["findings"][:5]
            ],
        }
        probs = {f["name"]: f["probability"] for f in vis["findings"]}
        rep = {
            "impression_en": vis["impression_en"],
            "impression_sq": vis["impression_sq"],
            "recommendation_en": vis["recommendation_en"],
            "recommendation_sq": vis["recommendation_sq"],
        }
        top_finding_sq = vis.get("driver_sq", vis["driver"])
        confidence = (
            inference.confidence_payload(
                vis.get("confidence", 60),
                reason=vis.get("confidence_reason"),
                reason_sq=vis.get("confidence_reason_sq"),
            )
            if vis
            else inference.analysis_confidence(
                [f["probability"] for f in risk["top_findings"]]
            )
        )

    # 5. PNG -> DICOM + push to Orthanc
    pacs = _archive(src_path, patient, study_uid, modality)

    return {
        "probs": probs,
        "risk": risk,
        "original_png": original_png,
        "heatmap_png": heatmap_png,
        "pacs": pacs,
        "report": rep,
        "clinical": clinical or {},
        "modality": modality,
        "region": region,
        "analysis_source": analysis_source,
        "top_finding_sq": top_finding_sq,
        "confidence": confidence,
    }


def _archive(src_path: str, patient: dict, study_uid: str | None, modality: str) -> dict:
    """PNG -> DICOM (Secondary Capture) -> Orthanc. Degrades gracefully if PACS
    is offline, still returning the generated StudyInstanceUID."""
    pacs = {"study_instance_uid": "", "orthanc_id": "", "archived": False}
    try:
        dicom_bytes, sop_study_uid = png_to_dicom_bytes(
            src_path, patient["name"], patient["id"], study_uid, modality
        )
        res = push_to_orthanc(dicom_bytes, settings.ORTHANC_URL)
        pacs = {
            "study_instance_uid": sop_study_uid,
            "orthanc_id": res.get("ParentStudy", res.get("ID", "")),
            "archived": True,
        }
    except Exception as exc:
        log.warning("orthanc archive failed (PACS offline?): %s", exc)
        try:
            _, sop_study_uid = png_to_dicom_bytes(
                src_path, patient["name"], patient["id"], study_uid, modality
            )
            pacs["study_instance_uid"] = sop_study_uid
        except Exception:
            pass
    return pacs

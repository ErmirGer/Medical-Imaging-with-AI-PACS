"""End-to-end study processing: inference -> risk -> heatmap -> PACS -> report.

Kept separate from the router so it can be reused by the seeder and tested
directly. Every external/heavy step is wrapped so the demo never hard-fails.
"""
from __future__ import annotations

import logging
import uuid
from pathlib import Path

from ..config import settings
from . import inference, report, vision
from .dicom import png_to_dicom_bytes, push_to_orthanc

log = logging.getLogger("radguard.pipeline")

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

    # 1. Vision triage: figure out what this image actually IS (modality, body
    #    region, whether it's a chest X-ray) before assuming the chest model applies.
    vis = vision.analyze(src_path, patient, clinical)
    is_chest = vis["is_chest_xray"] if vis else True  # no key/failed -> assume CXR
    region = vis["body_region"] if vis else ""
    if vis:
        modality = vision.modality_to_dicom(vis["modality"])

    original_png = str(IMAGES_DIR / f"{token}_original.png")
    heatmap_png = str(IMAGES_DIR / f"{token}_heatmap.png")

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
    else:
        # --- Anything else (hand X-ray, CT, MRI, ultrasound...): Claude vision is
        #     the analyzer. No chest model, no Grad-CAM (would be meaningless).
        analysis_source = "vision"
        try:
            inference.save_original_png(src_path, original_png)
        except Exception as exc:
            log.warning("original png failed: %s", exc)
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
                    "probability": f["probability"],
                    "contribution": f["probability"],
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

    # 5. PNG -> DICOM + push to Orthanc
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
        # still record the UID we generated so the study is PACS-ready
        try:
            _, sop_study_uid = png_to_dicom_bytes(
                src_path, patient["name"], patient["id"], study_uid, modality
            )
            pacs["study_instance_uid"] = sop_study_uid
        except Exception:
            pass

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
    }

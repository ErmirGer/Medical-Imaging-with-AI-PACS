"""Seed demo users, patients, and (on demand) studies from data/samples."""
from __future__ import annotations

import json
import logging
from pathlib import Path

from sqlmodel import select

from ..db import get_session
from ..models import Patient, Study, User
from .pipeline import process

log = logging.getLogger("radguard.seed")

DATA_DIR = Path(__file__).resolve().parents[2].parent / "data" / "samples"

USERS = [
    {"name": "Dr. Elira Hoxha", "role": "radiologist", "department": "Radiology"},
    {"name": "Dr. Besnik Marku", "role": "emergency", "department": "Emergency"},
    {"name": "Dr. Ana Dervishi", "role": "cardiology", "department": "Cardiology"},
    {"name": "Dr. Genc Leka", "role": "surgery", "department": "Surgery"},
    {"name": "Admin", "role": "admin", "department": "IT"},
]

# Default patient roster; manifest entries may reference these ids.
PATIENTS = [
    {"id": "P-001", "name": "Ardit Krasniqi", "age": 54, "sex": "M", "mrn": "MRN-001"},
    {"id": "P-002", "name": "Mirela Shala", "age": 41, "sex": "F", "mrn": "MRN-002"},
    {"id": "P-003", "name": "Sokol Berisha", "age": 67, "sex": "M", "mrn": "MRN-003"},
    {"id": "P-004", "name": "Drita Hysenaj", "age": 33, "sex": "F", "mrn": "MRN-004"},
]


def seed_if_empty() -> dict:
    """Seed users + patients only (fast, runs on startup)."""
    with get_session() as session:
        users_n = len(session.exec(select(User)).all())
        if users_n == 0:
            for u in USERS:
                session.add(User(**u))
            session.commit()
        pats_n = len(session.exec(select(Patient)).all())
        if pats_n == 0:
            for p in PATIENTS:
                session.add(Patient(**p))
            session.commit()
        return {
            "users": len(session.exec(select(User)).all()),
            "patients": len(session.exec(select(Patient)).all()),
        }


def _load_manifest() -> list[dict]:
    mf = DATA_DIR / "manifest.json"
    if mf.exists():
        try:
            return json.loads(mf.read_text(encoding="utf-8"))
        except Exception as exc:
            log.warning("manifest parse failed: %s", exc)
    # fallback: process every image file in the samples dir
    entries = []
    for img in sorted(DATA_DIR.glob("*")):
        if img.suffix.lower() in (".png", ".jpg", ".jpeg"):
            entries.append({"file": img.name, "patient_id": "P-001"})
    return entries


def run_seed() -> dict:
    """Process the sample images into studies (idempotent-ish; skips if studies exist)."""
    seed_if_empty()
    created = 0
    with get_session() as session:
        existing = len(session.exec(select(Study)).all())
    if existing > 0:
        return {"studies_existing": existing, "studies_created": 0}

    from ..routers.studies import persist_study

    for entry in _load_manifest():
        img_path = DATA_DIR / entry["file"]
        if not img_path.exists():
            log.warning("sample missing: %s", img_path)
            continue
        with get_session() as session:
            pid = entry.get("patient_id", "P-001")
            patient = session.get(Patient, pid)
            if patient is None:
                patient = Patient(id=pid, name="Demo Patient", age=50, sex="U")
                session.add(patient)
                session.commit()
                session.refresh(patient)
            patient_d = {
                "id": patient.id,
                "name": patient.name,
                "age": patient.age,
                "sex": patient.sex,
            }
            study_uid = entry.get("study_uid")
            try:
                results = process(str(img_path), patient_d, study_uid)
                persist_study(results, patient_d, session)
                created += 1
            except Exception as exc:
                log.warning("seed study failed for %s: %s", img_path, exc)

    return {"studies_created": created}

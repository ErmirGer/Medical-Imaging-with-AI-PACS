"""Seed demo users, patients, and (on demand) studies from data/samples."""
from __future__ import annotations

import json
import logging
from pathlib import Path

from sqlmodel import select

from ..config import settings
from ..db import get_session
from ..models import Account, Alert, Patient, Study, User
from . import auth
from .pipeline import process

# Demo accounts created on startup so the login page works out of the box.
DEMO_DOCTOR = {"personal_number": "1234567890", "password": "demo1234",
               "name": "Dr. Besnik Marku", "department": "Radiology"}
DEMO_PATIENT = {"personal_number": "9876543210", "password": "demo1234",
                "name": "Ardit Krasniqi", "patient_id": "P-001"}

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
        _seed_accounts(session)
        return {
            "users": len(session.exec(select(User)).all()),
            "patients": len(session.exec(select(Patient)).all()),
            "accounts": len(session.exec(select(Account)).all()),
        }


def _seed_accounts(session) -> None:
    """Create the demo doctor + patient logins if they don't exist."""
    def ensure(personal_number, password, role, name, **extra):
        if session.exec(
            select(Account).where(Account.personal_number == personal_number)
        ).first():
            return
        salt = auth.new_salt()
        session.add(
            Account(
                personal_number=personal_number,
                password_hash=auth.hash_password(password, salt),
                salt=salt,
                role=role,
                name=name,
                token=auth.new_token(),
                **extra,
            )
        )
        session.commit()

    ensure(DEMO_DOCTOR["personal_number"], DEMO_DOCTOR["password"], "doctor",
           DEMO_DOCTOR["name"], department=DEMO_DOCTOR["department"])
    ensure(DEMO_PATIENT["personal_number"], DEMO_PATIENT["password"], "patient",
           DEMO_PATIENT["name"], patient_id=DEMO_PATIENT["patient_id"])


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


def run_seed(owner_account_id: int | None = None) -> dict:
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
            clinical = entry.get("clinical")
            try:
                results = process(
                    str(img_path), patient_d, study_uid, clinical=clinical
                )
                study = persist_study(
                    results, patient_d, session, owner_account_id=owner_account_id
                )
                # pre-create an alert for high-risk seeded studies so the
                # Emergency board shows "the alert is already there".
                if study.risk_band == "High" or study.risk_score >= settings.HIGH_RISK_THRESHOLD:
                    session.add(
                        Alert(
                            study_id=study.id,
                            department="Emergency",
                            channel="seed",
                        )
                    )
                    session.commit()
                created += 1
            except Exception as exc:
                log.warning("seed study failed for %s: %s", img_path, exc)

    return {"studies_created": created}

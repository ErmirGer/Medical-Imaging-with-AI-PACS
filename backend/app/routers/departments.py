from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import select

from ..db import get_session
from ..models import Account, Study
from ..schemas import StudyOut
from ..services import auth
from .studies import to_study_out

router = APIRouter(prefix="/api/departments", tags=["departments"])

DEPARTMENTS = {"emergency", "radiology", "cardiology", "surgery"}

# A study is routed to a department when ANY of its (top-5) findings falls in the
# department's relevant set above REL_THRESHOLD — not just the single top driver.
# This is what makes every board actually populate with the cases it owns.
REL_THRESHOLD = 0.40

DEPT_FINDINGS = {
    "cardiology": {
        "Cardiomegaly",
        "Enlarged Cardiomediastinum",
        "Edema",
        "Effusion",  # pleural effusion is frequently cardiac (CHF) in origin
    },
    "surgery": {
        "Mass",
        "Nodule",
        "Lung Lesion",
        "Pneumothorax",
        "Effusion",
        "Fracture",
    },
}

# Findings that make a case time-critical for Emergency even at Medium band.
EMERGENCY_CRITICAL = {"Pneumothorax", "Consolidation", "Pneumonia", "Edema"}


def _relevant_finding(study: StudyOut, names: set[str]) -> str | None:
    """Return the highest-probability finding in `names` above threshold, else None."""
    best = None
    best_p = REL_THRESHOLD
    for f in study.findings:
        if f.pathology in names and f.probability >= best_p:
            best, best_p = f.pathology, f.probability
    return best


@router.get("/{dept}/queue", response_model=list[StudyOut])
def department_queue(dept: str, account: Account = Depends(auth.require_doctor)):
    dept = dept.lower()
    with get_session() as session:
        studies = session.exec(
            select(Study).where(Study.owner_account_id == account.id)
        ).all()
        studies = sorted(studies, key=lambda s: s.risk_score, reverse=True)
        outs = [to_study_out(s, session) for s in studies]

    if dept == "emergency":
        return [
            o
            for o in outs
            if o.risk_band == "High"
            or (
                o.risk_band == "Medium"
                and _relevant_finding(o, EMERGENCY_CRITICAL) is not None
            )
        ]
    if dept in DEPT_FINDINGS:
        return [o for o in outs if _relevant_finding(o, DEPT_FINDINGS[dept])]
    # radiology (and unknown) = full worklist
    return outs

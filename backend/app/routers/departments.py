from __future__ import annotations

from fastapi import APIRouter
from sqlmodel import select

from ..db import get_session
from ..models import Study
from ..schemas import StudyOut
from .studies import to_study_out

router = APIRouter(prefix="/api/departments", tags=["departments"])

# Which risk bands / findings route to which department queue.
# Emergency sees the most urgent; others see relevant subsets but the demo
# keeps it simple: emergency = High, others = everything sorted by risk.
DEPARTMENTS = {"emergency", "radiology", "cardiology", "surgery"}

CARDIO_FINDINGS = {"Cardiomegaly", "Enlarged Cardiomediastinum", "Edema"}


@router.get("/{dept}/queue", response_model=list[StudyOut])
def department_queue(dept: str):
    dept = dept.lower()
    with get_session() as session:
        studies = session.exec(select(Study)).all()
        studies = sorted(studies, key=lambda s: s.risk_score, reverse=True)
        outs = [to_study_out(s, session) for s in studies]

    if dept == "emergency":
        return [o for o in outs if o.risk_band == "High"]
    if dept == "cardiology":
        return [o for o in outs if o.top_finding in CARDIO_FINDINGS]
    if dept == "surgery":
        return [o for o in outs if o.risk_band in ("High", "Medium")]
    # radiology (and unknown) = full worklist
    return outs

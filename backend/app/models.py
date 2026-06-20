from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Patient(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    age: int = 0
    sex: str = "U"
    mrn: str = ""


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    role: str  # radiologist | emergency | cardiology | surgery | admin
    department: str = ""


class Study(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    patient_id: str = Field(foreign_key="patient.id")
    modality: str = "DX"
    uploaded_at: datetime = Field(default_factory=_utcnow)

    original_path: str = ""
    heatmap_path: str = ""

    pacs_study_uid: str = ""
    pacs_orthanc_id: str = ""
    archived: bool = False

    risk_score: int = 0
    risk_band: str = "Low"
    top_finding: str = ""

    report_en: str = ""
    report_sq: str = ""
    recommendation_en: str = ""
    recommendation_sq: str = ""


class Finding(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    study_id: int = Field(foreign_key="study.id")
    pathology: str
    probability: float = 0.0
    contribution: float = 0.0


class Alert(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    study_id: int = Field(foreign_key="study.id")
    department: str = ""
    channel: str = ""
    sent_at: datetime = Field(default_factory=_utcnow)
    acknowledged: bool = False

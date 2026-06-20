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
    region: str = ""  # body region detected by vision (e.g. "Hand", "Chest")
    analysis_source: str = "model"  # "model" (chest torchxrayvision) | "vision" (Claude)
    uploaded_at: datetime = Field(default_factory=_utcnow)

    original_path: str = ""
    heatmap_path: str = ""

    pacs_study_uid: str = ""
    pacs_orthanc_id: str = ""
    archived: bool = False

    # Clinical context (fused with imaging findings in the risk score + report)
    symptoms: str = ""
    temperature: float = 0.0  # body temp °C (0 = not provided)
    spo2: int = 0  # oxygen saturation % (0 = not provided)
    smoker: bool = False
    clinical_adjustment: int = 0  # risk points added by clinical fusion
    clinical_factors: str = ""  # JSON list of human-readable clinical drivers

    risk_score: int = 0
    risk_base: int = 0  # imaging-only score before clinical fusion
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

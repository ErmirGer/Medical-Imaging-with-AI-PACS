from typing import Optional

from pydantic import BaseModel


class PatientOut(BaseModel):
    id: str
    name: str
    age: int
    sex: str


class FindingOut(BaseModel):
    pathology: str
    probability: float
    contribution: float
    population_rate: float = 0.0  # population baseline prevalence for reference


class ReportOut(BaseModel):
    impression_en: str = ""
    impression_sq: str = ""
    recommendation_en: str = ""
    recommendation_sq: str = ""


class PacsOut(BaseModel):
    study_instance_uid: str = ""
    orthanc_id: str = ""
    archived: bool = False


class ImageUrls(BaseModel):
    original: str
    heatmap: str


class AlertOut(BaseModel):
    sent: bool = False
    department: str = ""
    acknowledged: bool = False


class ClinicalOut(BaseModel):
    symptoms: str = ""
    temperature: float = 0.0
    spo2: int = 0
    smoker: bool = False
    adjustment: int = 0  # risk points contributed by clinical fusion
    factors: list[str] = []  # human-readable clinical drivers
    provided: bool = False  # whether any clinical context was entered


class StudyOut(BaseModel):
    id: int
    patient: PatientOut
    modality: str
    uploaded_at: str
    risk_score: int
    risk_base: int = 0
    risk_band: str
    top_finding: str
    findings: list[FindingOut]
    report: ReportOut
    pacs: PacsOut
    image_urls: ImageUrls
    clinical: Optional[ClinicalOut] = None
    alert: Optional[AlertOut] = None

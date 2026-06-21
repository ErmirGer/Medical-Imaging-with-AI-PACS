from typing import Optional

from pydantic import BaseModel


class AccountOut(BaseModel):
    id: int
    personal_number: str
    role: str  # doctor | patient
    name: str
    patient_id: str = ""
    department: str = ""


class AuthOut(BaseModel):
    token: str
    account: AccountOut


class PatientOut(BaseModel):
    id: str
    name: str
    age: int
    sex: str


class FindingOut(BaseModel):
    pathology: str
    pathology_sq: str = ""
    probability: float
    contribution: float
    severity: str = "mild"  # none|mild|moderate|severe — drives UI color
    # population baseline prevalence; None when no reference exists (non-chest findings)
    population_rate: Optional[float] = None


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


class ConfidenceOut(BaseModel):
    score: int = 0  # 0-100, how sure the AI is the analysis is correct
    band: str = ""  # High | Moderate | Low
    note: str = ""
    note_sq: str = ""
    double_check: bool = False


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
    region: str = ""
    analysis_source: str = "model"  # "model" | "vision"
    heatmap_available: bool = False  # Grad-CAM localization only exists for chest X-ray
    uploaded_at: str
    risk_score: int
    risk_base: int = 0
    risk_band: str
    top_finding: str
    top_finding_sq: str = ""
    findings: list[FindingOut]
    report: ReportOut
    pacs: PacsOut
    image_urls: ImageUrls
    confidence: Optional[ConfidenceOut] = None
    clinical: Optional[ClinicalOut] = None
    alert: Optional[AlertOut] = None

export interface Finding {
  pathology: string;
  probability: number;
  contribution: number;
  population_rate?: number;
}

export interface Clinical {
  symptoms: string;
  temperature: number;
  spo2: number;
  smoker: boolean;
  adjustment: number;
  factors: string[];
  provided: boolean;
}

export interface Report {
  impression_en: string;
  impression_sq: string;
  recommendation_en: string;
  recommendation_sq: string;
}

export interface Pacs {
  study_instance_uid: string;
  orthanc_id: string;
  archived: boolean;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  sex: string;
}

export interface AlertInfo {
  sent: boolean;
  department: string;
  acknowledged: boolean;
}

export interface Study {
  id: number;
  patient: Patient;
  modality: string;
  uploaded_at: string;
  risk_score: number;
  risk_band: "High" | "Medium" | "Low";
  top_finding: string;
  findings: Finding[];
  report: Report;
  pacs: Pacs;
  image_urls: { original: string; heatmap: string };
  clinical?: Clinical | null;
  alert: AlertInfo | null;
}

export interface Comparison {
  has_prior: boolean;
  prior_id?: number;
  prior_score?: number;
  current_score?: number;
  delta?: number;
  prior_finding?: string;
  current_finding?: string;
  summary_en?: string;
  summary_sq?: string;
}

export type Role = "radiologist" | "emergency" | "cardiology" | "surgery";

export interface AlertEvent {
  type: string;
  study_id: number;
  patient: string;
  score: number;
  driver: string;
  department: string;
}

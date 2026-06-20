import type { Study, Comparison } from "./types";

export interface UploadMeta {
  patientId?: string;
  patientName?: string;
  age?: number;
  sex?: string;
  modality?: string;
  symptoms?: string;
  temperature?: number;
  spo2?: number;
  smoker?: boolean;
}

export const API_BASE =
  (import.meta as any).env?.VITE_API_BASE ?? "http://localhost:8000";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  imageUrl(study: Study, type: "original" | "heatmap"): string {
    return `${API_BASE}/api/studies/${study.id}/image?type=${type}`;
  },

  async listStudies(sort: "risk" | "recent" = "risk"): Promise<Study[]> {
    const q = sort === "risk" ? "?sort=risk" : "";
    return json(await fetch(`${API_BASE}/api/studies${q}`));
  },

  async getStudy(id: number): Promise<Study> {
    return json(await fetch(`${API_BASE}/api/studies/${id}`));
  },

  async patientStudies(patientId: string): Promise<Study[]> {
    return json(
      await fetch(
        `${API_BASE}/api/studies?patient_id=${encodeURIComponent(patientId)}`,
      ),
    );
  },

  async getComparison(id: number): Promise<Comparison> {
    return json(await fetch(`${API_BASE}/api/studies/${id}/comparison`));
  },

  async uploadStudy(file: File, meta?: UploadMeta): Promise<Study> {
    const fd = new FormData();
    fd.append("file", file);
    if (meta?.patientId) fd.append("patient_id", meta.patientId);
    if (meta?.patientName) fd.append("patient_name", meta.patientName);
    if (meta?.age != null) fd.append("age", String(meta.age));
    if (meta?.sex) fd.append("sex", meta.sex);
    if (meta?.modality) fd.append("modality", meta.modality);
    if (meta?.symptoms) fd.append("symptoms", meta.symptoms);
    if (meta?.temperature != null)
      fd.append("temperature", String(meta.temperature));
    if (meta?.spo2 != null) fd.append("spo2", String(meta.spo2));
    fd.append("smoker", meta?.smoker ? "true" : "false");
    return json(
      await fetch(`${API_BASE}/api/studies`, { method: "POST", body: fd })
    );
  },

  async departmentQueue(dept: string): Promise<Study[]> {
    return json(await fetch(`${API_BASE}/api/departments/${dept}/queue`));
  },

  async ack(id: number): Promise<void> {
    await fetch(`${API_BASE}/api/studies/${id}/ack`, { method: "POST" });
  },

  async seed(): Promise<{ studies_created?: number }> {
    return json(await fetch(`${API_BASE}/api/seed`, { method: "POST" }));
  },
};

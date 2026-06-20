import type { Study } from "./types";

export const API_BASE =
  (import.meta as any).env?.VITE_API_BASE ?? "http://localhost:8000";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
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

  async uploadStudy(file: File, patientId?: string): Promise<Study> {
    const fd = new FormData();
    fd.append("file", file);
    if (patientId) fd.append("patient_id", patientId);
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

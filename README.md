# RadGuard — AI Medical Imaging + PACS

Chest X-ray → AI analysis + Grad-CAM heatmap → explainable risk score → bilingual
(EN/SQ) radiology report → archived in a **real PACS (Orthanc)** → cross-departmental
access → real-time high-risk alerts (in-app SSE + Telegram).

Built for JunctionX Tirana 2026 — *Innovation4Albania: Medical Imaging with AI & PACS*.

## Stack
- **Backend:** FastAPI · torchxrayvision (DenseNet) · pytorch-grad-cam · pydicom · SQLite
- **PACS:** Orthanc (Docker) with DICOMweb
- **Frontend:** Vite + React + TypeScript + Tailwind
- **AI report:** Anthropic API (bilingual, with templated fallback)
- **Alerts:** Server-Sent Events + Telegram Bot

## Run (dev — backend + frontend on host, Orthanc in Docker)

```bash
# 0. one-time: copy env + add your ANTHROPIC_API_KEY
cp .env.example .env

# 1. PACS
docker compose up -d orthanc            # Orthanc Explorer at http://localhost:8042

# 2. backend
cd backend
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
.venv/Scripts/uvicorn app.main:app --reload      # http://localhost:8000

# 3. samples + curate (optional, see real scores)
python ../scripts/fetch_samples.py
.venv/Scripts/python ../scripts/curate_samples.py

# 4. frontend
cd ../frontend
npm install && npm run dev               # http://localhost:5173
```

## Run (full Docker)

```bash
docker compose up --build
# frontend :5173 · backend :8000 · orthanc :8042
```

## Demo
Open the app → **Load demo cases** (seeds curated studies) → Worklist sorts by risk →
click a High case → heatmap + findings + bilingual report → switch role to **Emergency**
→ Dept Board shows the routed alert (and your phone buzzes if Telegram is configured).

## Data sources & provenance

The challenge names NIH Chest X-Ray, RSNA Pneumonia, VinBigData, and synthetic DICOM.

- **AI model** — `torchxrayvision` `densenet121-res224-all` is pretrained on the
  **union of NIH ChestX-ray14, RSNA, CheXpert, MIMIC-CXR and PadChest**. So the
  classifier itself is built on the named datasets (we do no training).
- **Demo images** — every seed image is a real radiograph from a public dataset,
  with its source recorded per-image in [data/samples/manifest.json](data/samples/manifest.json):
  - `nih_chestxray14_00000001.png`, `nih_chestxray14_00027426.png` — **NIH ChestX-ray14** (public domain)
  - `covid_collection_pneumonia_58.jpg` — **COVID-19 Image Data Collection** (Cohen et al., CC BY-NC-SA)
  - `normal_wikimedia_pa.png` — normal PA film (Wikimedia, public domain)
  - `xrv_sample_16747.jpg` — public sample chest radiograph
- **RSNA / VinBigData** are Kaggle-gated (account + license), so they can't be
  pulled unattended. To use them: download from Kaggle → drop files in
  `data/samples/` → add manifest entries → re-seed. Run `python scripts/fetch_samples.py`
  to (re)download the documented set.
- **Any modality** — uploads that aren't chest X-ray (hand/CT/MRI/ultrasound) are
  analyzed by Claude vision (modality + region detected from the image); chest
  X-ray additionally gets the specialized model + Grad-CAM heatmap.

## Where uploads are stored (persistence)

A single upload is persisted to **four** places:

| Store | Path | Contents |
|---|---|---|
| Raw upload | `backend/storage/uploads/<token>.<ext>` | the exact file you dropped |
| Rendered images | `backend/storage/images/<token>_original.png` (+`_heatmap.png`) | viewer image + Grad-CAM |
| Database | `backend/storage/radguard.db` (SQLite) | study, findings, bilingual report, risk, clinical, PACS UID |
| **PACS** | **Orthanc** (`:8042`) | real DICOM, retrievable by StudyInstanceUID |

Low-quality / non-medical uploads are rejected (HTTP 422) **before** anything is
written — no orphan rows or files.

## PACS note (Orthanc)

`docker compose up -d orthanc` is the documented path, but Orthanc also runs
**natively** (no Docker/WSL needed): install `OrthancInstaller-Win64` from
orthanc-server.com — it runs as a Windows service on `:8042`, and the backend
(`ORTHANC_URL=http://localhost:8042`) archives to it unchanged.

See [CLAUDE.md](CLAUDE.md) for full architecture and the 90-second demo script.

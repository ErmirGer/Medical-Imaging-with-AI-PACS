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

See [CLAUDE.md](CLAUDE.md) for full architecture and the 90-second demo script.

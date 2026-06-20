# CLAUDE.md — RadGuard: AI Medical Imaging + PACS

> Project context for Claude Code. Read this fully before writing any code.
> This is a **48h hackathon** build (JunctionX Tirana 2026, Innovation4Albania challenge "Medical Imaging with AI & PACS"). Optimize for a **working end-to-end demo**, not production completeness. A live, robust demo beats breadth every time.

---

## 0. Prime directive

Build the loop: **upload chest X-ray → AI analyzes + heatmap → risk score → bilingual report → archive in real PACS → cross-departmental access → real-time high-risk alert.**

When a tradeoff appears, always choose: **working core loop > more features**. If something is taking too long, fall back to the documented fallback in §13 and keep the demo alive.

You are running autonomously (bypass mode). After each phase in §11, run the pipeline end-to-end against a seeded image, then `git commit` with a clear message. Do not wait for confirmation between phases.

---

## 1. What we are building (and what we are NOT)

### Scope: IN
- Chest X-ray ONLY (PNG/JPG ingest, wrapped into DICOM).
- One pretrained classifier (`torchxrayvision`) → 18 pathology probabilities. **No model training. Ever.**
- Grad-CAM heatmap overlay on the original image (the single biggest demo "wow").
- Deterministic, explainable **Risk Score (0–100)** with Low/Medium/High banding + per-finding contributions.
- AI-generated structured radiology report, **English + Albanian (sq)**.
- Real PACS: **Orthanc** (Docker), images + study UIDs archived and retrievable via REST/DICOMweb.
- Radiologist worklist auto-sorted by risk.
- Cross-departmental board (Radiology / Emergency / Cardiology / Surgery) with role switch.
- Real-time high-risk notification: in-app via **SSE** + phone via **Telegram Bot**.
- Seeded demo data (a few reliable positive + negative cases).

### Scope: OUT (do not build — these are time traps)
- CT / MRI / ultrasound (say "architecture generalizes" in the pitch; build CXR only).
- Training, fine-tuning, or any dataset download beyond a handful of sample images.
- Real DICOM Structured Reports (SR objects). Store reports as JSON/columns linked by StudyInstanceUID.
- Real auth/SSO/registration. Hardcode 4 role logins, switch via a dropdown.
- Multimodal fusion, population reference comparison, real image registration.
- Prior-study comparison via real algorithms — if shown, **mock** it with two seeded studies of the same patient and a hardcoded delta string.
- Kubernetes, CI/CD, multi-env config, comprehensive tests.

---

## 2. Architecture

```
                         ┌──────────────────────────────┐
  Upload (PNG/JPG) ───▶  │  FastAPI backend (orchestrator) │
                         └──────────────┬───────────────┘
            ┌───────────────────────────┼───────────────────────────┐
            ▼                           ▼                           ▼
  torchxrayvision +           Orthanc PACS                  Anthropic API
  Grad-CAM + RiskScore        (PNG→DICOM, REST archive)     (bilingual report)
            │                           │                           │
            └───────────────┬───────────┴───────────────┬───────────┘
                            ▼                           ▼
                   SQLite (studies, findings,    SSE stream + Telegram
                   reports, alerts, users)       (high-risk alerts)
                            │
                            ▼
                React frontend: Upload · Worklist · Study detail · Dept board
```

Real-time path: when `risk_band == "High"`, backend pushes an SSE event to all connected dashboards AND sends a Telegram message. The frontend Dept board listens via `EventSource`.

---

## 3. Tech stack (pinned)

**Orchestration:** Docker Compose.

**PACS:** `orthancteam/orthanc:25.5.0` (or latest `orthancteam/orthanc`) with DICOMweb plugin enabled. REST on `:8042`.

**Backend:** Python 3.11, FastAPI, Uvicorn.
- `torch` (CPU build is fine), `torchvision`
- `torchxrayvision`
- `grad-cam` (imports as `pytorch_grad_cam`)
- `pydicom`
- `Pillow`, `numpy`, `scikit-image`
- `httpx` (Orthanc calls), `python-multipart` (uploads)
- `anthropic` (report generation)
- `sqlmodel` (SQLite ORM), `pydantic-settings`
- `requests` (Telegram)

**Frontend:** Vite + React 18 + TypeScript + Tailwind.
- `@tanstack/react-query`, `zustand` (role state), `recharts` (small charts), `lucide-react` (icons)
- Viewer: **PNG-primary** (render backend-produced overlay PNG). Cornerstone3D is a STRETCH only (§13).

**DB:** SQLite file (`backend/storage/radguard.db`).

---

## 4. Repository layout

```
radguard/
├── CLAUDE.md
├── docker-compose.yml
├── .env.example
├── README.md
├── orthanc/
│   └── orthanc.json
├── data/
│   └── samples/                # seed X-rays (PNG/JPG) + a manifest.json
├── scripts/
│   └── fetch_samples.sh        # optional: pull a few public CXR images
├── backend/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── app/
│       ├── main.py             # FastAPI app, CORS, router includes, startup seed
│       ├── config.py           # pydantic-settings, reads .env
│       ├── db.py               # engine, session, create_all
│       ├── models.py           # SQLModel tables
│       ├── schemas.py          # pydantic response models
│       ├── services/
│       │   ├── inference.py    # torchxrayvision + grad-cam + risk score
│       │   ├── dicom.py        # png->dicom + push to Orthanc
│       │   ├── report.py       # Anthropic bilingual report
│       │   ├── notify.py       # SSE broker + Telegram
│       │   └── seed.py         # seed patients/users/studies
│       └── routers/
│           ├── studies.py      # upload, list, detail, heatmap
│           ├── departments.py  # role-filtered queues
│           └── stream.py       # GET /api/stream (SSE)
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx             # router + role switcher
        ├── api.ts              # typed fetch wrappers
        ├── useAlerts.ts        # EventSource hook
        ├── store.ts            # zustand role/department
        ├── pages/
        │   ├── Upload.tsx
        │   ├── Worklist.tsx
        │   ├── StudyDetail.tsx
        │   └── DepartmentBoard.tsx
        └── components/
            ├── Viewer.tsx      # shows original + heatmap PNG toggle
            ├── RiskBadge.tsx
            ├── FindingsList.tsx
            ├── ReportPanel.tsx
            └── AlertToast.tsx
```

---

## 5. Environment variables (`.env.example`)

```env
ANTHROPIC_API_KEY=sk-ant-...
REPORT_MODEL=claude-sonnet-4-6        # haiku for speed: claude-haiku-4-5-20251001

ORTHANC_URL=http://orthanc:8042
ORTHANC_USER=                          # auth disabled for hackathon
ORTHANC_PASSWORD=

TELEGRAM_BOT_TOKEN=                     # from @BotFather
TELEGRAM_CHAT_ID=                      # your chat/group id

DATABASE_URL=sqlite:///storage/radguard.db
HIGH_RISK_THRESHOLD=70
FRONTEND_ORIGIN=http://localhost:5173
```

Backend reads these via `pydantic-settings`. Never hardcode the API key. The Anthropic SDK auto-reads `ANTHROPIC_API_KEY`.

---

## 6. docker-compose.yml (target shape)

```yaml
services:
  orthanc:
    image: orthancteam/orthanc:25.5.0
    ports: ["8042:8042"]
    volumes:
      - ./orthanc/orthanc.json:/etc/orthanc/orthanc.json:ro
      - orthanc-db:/var/lib/orthanc/db
    restart: unless-stopped

  backend:
    build: ./backend
    ports: ["8000:8000"]
    env_file: .env
    volumes:
      - ./backend/app:/app/app
      - ./data:/app/data
      - model-cache:/root/.torchxrayvision     # cache pretrained weights
      - backend-storage:/app/storage
    depends_on: [orthanc]
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports: ["5173:5173"]
    environment:
      - VITE_API_BASE=http://localhost:8000
    depends_on: [backend]

volumes:
  orthanc-db:
  model-cache:
  backend-storage:
```

> During active dev it's often faster to run backend (`uvicorn app.main:app --reload`) and frontend (`npm run dev`) on the host and only run Orthanc in Docker. Support both.

---

## 7. Orthanc config (`orthanc/orthanc.json`)

```json
{
  "Name": "RadGuard PACS",
  "RemoteAccessAllowed": true,
  "AuthenticationEnabled": false,
  "DicomWeb": { "Enable": true, "Root": "/dicom-web/" },
  "HttpCompressionEnabled": false,
  "CorsEnabled": true,
  "CorsOrigins": "*"
}
```

If `CorsEnabled` isn't recognized by the image version, ignore — backend proxies all Orthanc calls server-side, so the browser never hits Orthanc directly unless Cornerstone (stretch) is used.

---

## 8. Backend specifics — get these exactly right

### 8.1 Inference (`services/inference.py`)

`torchxrayvision` normalization is the #1 footgun. Follow this exactly:

```python
import numpy as np, torch, torchvision, skimage.io
import torchxrayvision as xrv

_MODEL = None
def get_model():
    global _MODEL
    if _MODEL is None:
        _MODEL = xrv.models.DenseNet(weights="densenet121-res224-all").eval()
    return _MODEL

def _preprocess(path: str) -> torch.Tensor:
    img = skimage.io.imread(path)
    if img.ndim == 3:                       # RGB/RGBA -> grayscale
        img = img[..., :3].mean(2)
    img = xrv.datasets.normalize(img, 255)  # maps [0,255] -> [-1024,1024]
    img = img[None, ...]                     # (1, H, W)
    tf = torchvision.transforms.Compose([
        xrv.datasets.XRayCenterCrop(),
        xrv.datasets.XRayResizer(224),
    ])
    img = tf(img)                            # (1, 224, 224)
    return torch.from_numpy(img)[None, ...]  # (1, 1, 224, 224)

def predict(path: str) -> dict[str, float]:
    model = get_model()
    x = _preprocess(path)
    with torch.no_grad():
        out = model(x)[0]                    # already sigmoid-activated, [0,1]
    return {p: float(v) for p, v in zip(model.pathologies, out.numpy())}
```

The 18 pathologies (model.pathologies) include: Atelectasis, Consolidation, Infiltration, Pneumothorax, Edema, Emphysema, Fibrosis, Effusion, Pneumonia, Pleural_Thickening, Cardiomegaly, Nodule, Mass, Hernia, Lung Opacity, Enlarged Cardiomediastinum, Lung Lesion, Fracture (exact set comes from `model.pathologies` — read it at runtime, never hardcode).

### 8.2 Grad-CAM heatmap

```python
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
import numpy as np
from PIL import Image

def heatmap(path: str, top_idx: int, out_png: str):
    model = get_model()
    x = _preprocess(path)                          # (1,1,224,224)
    cam = GradCAM(model=model, target_layers=[model.features.denseblock4])
    grayscale = cam(input_tensor=x, targets=[ClassifierOutputTarget(top_idx)])[0]  # (224,224) in [0,1]
    base = x[0,0].numpy()
    base = (base - base.min()) / (base.ptp() + 1e-8)               # [0,1]
    # build an RGB overlay: grayscale base + warm CAM where activation is high
    import matplotlib.cm as cm
    heat = cm.get_cmap("jet")(grayscale)[..., :3]
    blend = (0.55*np.stack([base]*3, -1) + 0.45*heat)
    Image.fromarray((blend*255).astype(np.uint8)).resize((512,512)).save(out_png)
```

`model.features.denseblock4` is the correct CAM target for the xrv DenseNet. Also save a plain grayscale 512×512 PNG of the original (for the "toggle heatmap off" view).

### 8.3 Risk Score (deterministic + explainable)

```python
WEIGHTS = {   # clinical urgency weight per pathology
  "Pneumothorax": 1.00, "Mass": 0.92, "Consolidation": 0.88, "Pneumonia": 0.88,
  "Edema": 0.82, "Effusion": 0.72, "Lung Opacity": 0.65, "Nodule": 0.62,
  "Infiltration": 0.55, "Cardiomegaly": 0.50, "Atelectasis": 0.45,
  "Enlarged Cardiomediastinum": 0.45, "Fracture": 0.45, "Lung Lesion": 0.60,
}
DEFAULT_W = 0.30

def risk_score(probs: dict[str, float]) -> dict:
    contribs = {p: probs[p] * WEIGHTS.get(p, DEFAULT_W) for p in probs}
    driver, raw = max(contribs.items(), key=lambda kv: kv[1])
    cofindings = sum(1 for v in probs.values() if v > 0.5)
    score = min(100, round(100 * raw + 5 * max(0, cofindings - 1)))
    band = "High" if score >= 70 else "Medium" if score >= 40 else "Low"
    top = sorted(probs.items(), key=lambda kv: kv[1], reverse=True)[:5]
    return {
        "score": score, "band": band, "driver": driver,
        "top_findings": [{"pathology": p, "probability": round(v, 3),
                          "contribution": round(contribs[p], 3)} for p, v in top],
    }
```

`HIGH_RISK_THRESHOLD` (env) gates notifications; keep the band logic in sync.

### 8.4 PNG → DICOM + push to Orthanc (`services/dicom.py`)

Wrap as a Secondary Capture (simplest valid object Orthanc + viewers accept):

```python
import io, numpy as np, datetime, skimage.io, httpx
import pydicom
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import generate_uid, ExplicitVRLittleEndian, SecondaryCaptureImageStorage

def png_to_dicom_bytes(path, patient_name, patient_id, study_uid=None):
    arr = skimage.io.imread(path)
    if arr.ndim == 3: arr = arr[..., :3].mean(2)
    arr = ((arr - arr.min())/(arr.ptp()+1e-8)*255).astype(np.uint8)
    fm = FileMetaDataset()
    fm.MediaStorageSOPClassUID = SecondaryCaptureImageStorage
    fm.MediaStorageSOPInstanceUID = generate_uid()
    fm.TransferSyntaxUID = ExplicitVRLittleEndian
    ds = FileDataset(None, {}, file_meta=fm, preamble=b"\0"*128)
    ds.PatientName, ds.PatientID = patient_name, patient_id
    ds.StudyInstanceUID = study_uid or generate_uid()
    ds.SeriesInstanceUID = generate_uid()
    ds.SOPInstanceUID = fm.MediaStorageSOPInstanceUID
    ds.SOPClassUID = SecondaryCaptureImageStorage
    ds.Modality = "DX"
    ds.StudyDate = datetime.date.today().strftime("%Y%m%d")
    ds.Rows, ds.Columns = arr.shape
    ds.SamplesPerPixel = 1; ds.PhotometricInterpretation = "MONOCHROME2"
    ds.BitsAllocated = 8; ds.BitsStored = 8; ds.HighBit = 7; ds.PixelRepresentation = 0
    ds.PixelData = arr.tobytes()
    ds.is_little_endian = True; ds.is_implicit_VR = False
    buf = io.BytesIO(); ds.save_as(buf, write_like_original=False)
    return buf.getvalue(), str(ds.StudyInstanceUID)

def push_to_orthanc(dicom_bytes, orthanc_url):
    r = httpx.post(f"{orthanc_url}/instances", content=dicom_bytes,
                   headers={"content-type": "application/dicom"}, timeout=30)
    r.raise_for_status()
    return r.json()   # {"ID":..., "ParentStudy":..., "Status":"Success"}
```

`POST /instances` with raw DICOM is simpler and more reliable than STOW-RS multipart for this. Store `ParentStudy` (Orthanc id) and `StudyInstanceUID` on the Study row.

### 8.5 Bilingual report (`services/report.py`)

```python
import json, anthropic
from .config import settings

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY

SYSTEM = ("You are a radiology reporting assistant for chest X-rays. "
          "You produce concise, structured impressions for clinician review. "
          "You never give a definitive diagnosis; this is AI decision support. "
          "Return ONLY valid JSON, no markdown.")

def generate(patient, risk, findings):
    prompt = (f"Patient: {patient['name']}, age {patient['age']}.\n"
              f"Risk score {risk['score']} ({risk['band']}), main driver {risk['driver']}.\n"
              f"Model findings (probability): {findings}.\n"
              'Return JSON: {"impression_en","impression_sq","recommendation_en",'
              '"recommendation_sq"}. Keep each field 1-2 sentences, clinical tone.')
    msg = client.messages.create(model=settings.REPORT_MODEL, max_tokens=700,
                                 system=SYSTEM,
                                 messages=[{"role":"user","content":prompt}])
    text = "".join(b.text for b in msg.content if b.type == "text")
    return json.loads(text.strip().removeprefix("```json").removesuffix("```").strip())
```

Always wrap in try/except; on failure, fall back to a templated impression so the demo never blocks on the network.

### 8.6 Notifications (`services/notify.py`)

SSE broker (in-memory, fine for one process) + Telegram:

```python
import asyncio, json, requests
from .config import settings

_subscribers: set[asyncio.Queue] = set()

def subscribe() -> asyncio.Queue:
    q = asyncio.Queue(); _subscribers.add(q); return q

def unsubscribe(q): _subscribers.discard(q)

async def broadcast(event: dict):
    for q in list(_subscribers):
        await q.put(event)

def telegram(text: str):
    if not settings.TELEGRAM_BOT_TOKEN: return
    try:
        requests.post(
          f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
          json={"chat_id": settings.TELEGRAM_CHAT_ID, "text": text}, timeout=5)
    except Exception: pass

async def fire_high_risk(study):
    evt = {"type":"high_risk","study_id":study.id,"patient":study.patient_name,
           "score":study.risk_score,"driver":study.top_finding,"department":"Emergency"}
    await broadcast(evt)
    telegram(f"🚨 HIGH RISK ({study.risk_score}) — {study.patient_name}: "
             f"{study.top_finding}. Routed to Emergency.")
```

SSE endpoint (`routers/stream.py`):

```python
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from ..services.notify import subscribe, unsubscribe
import json

router = APIRouter()

@router.get("/api/stream")
async def stream():
    q = subscribe()
    async def gen():
        try:
            while True:
                evt = await q.get()
                yield f"data: {json.dumps(evt)}\n\n"
        finally:
            unsubscribe(q)
    return StreamingResponse(gen(), media_type="text/event-stream")
```

---

## 9. API contract

| Method | Path | Body / params | Returns |
|---|---|---|---|
| POST | `/api/studies` | multipart `file`, optional `patient_id` | full `StudyOut` (runs whole pipeline) |
| GET | `/api/studies` | `?sort=risk` | `StudyOut[]` (worklist) |
| GET | `/api/studies/{id}` | — | `StudyOut` |
| GET | `/api/studies/{id}/image?type=original\|heatmap` | — | PNG |
| GET | `/api/departments/{dept}/queue` | dept ∈ emergency/radiology/cardiology/surgery | `StudyOut[]` filtered |
| POST | `/api/studies/{id}/ack` | — | marks alert acknowledged |
| GET | `/api/stream` | — | SSE event stream |
| POST | `/api/seed` | — | seeds demo data, returns counts |

`StudyOut` shape:
```json
{
  "id": 12,
  "patient": {"id":"P-001","name":"Ardit Krasniqi","age":54,"sex":"M"},
  "modality":"DX","uploaded_at":"2026-06-20T14:31:00Z",
  "risk_score":87,"risk_band":"High","top_finding":"Pneumonia",
  "findings":[{"pathology":"Pneumonia","probability":0.89,"contribution":0.78}, ...],
  "report":{"impression_en":"...","impression_sq":"...","recommendation_en":"...","recommendation_sq":"..."},
  "pacs":{"study_instance_uid":"1.2.840...","orthanc_id":"...","archived":true},
  "image_urls":{"original":"/api/studies/12/image?type=original","heatmap":"/api/studies/12/image?type=heatmap"},
  "alert":{"sent":true,"department":"Emergency","acknowledged":false}
}
```

Pipeline order inside `POST /api/studies`:
1. save upload → 2. `predict()` → 3. `risk_score()` → 4. `heatmap()` (top finding) →
5. `png_to_dicom_bytes()` + `push_to_orthanc()` → 6. `report.generate()` →
7. persist Study + Findings → 8. if band High: `fire_high_risk()` → 9. return `StudyOut`.

Keep total latency under ~5s for the demo (model is small on CPU; report call is the slowest — consider firing it concurrently and/or using haiku).

---

## 10. Data model (`models.py`, SQLModel)

- **Patient**(id PK str, name, age int, sex, mrn)
- **User**(id PK, name, role ∈ {radiologist,emergency,cardiology,surgery,admin}, department)
- **Study**(id PK, patient_id FK, modality, uploaded_at, original_path, heatmap_path,
  pacs_study_uid, pacs_orthanc_id, archived bool, risk_score int, risk_band, top_finding,
  report_en, report_sq, recommendation_en, recommendation_sq)
- **Finding**(id PK, study_id FK, pathology, probability float, contribution float)
- **Alert**(id PK, study_id FK, department, channel, sent_at, acknowledged bool)

---

## 11. Build order (commit after each)

1. **Skeleton + pipe proof** — compose up Orthanc; FastAPI `/health`; push one seeded PNG→DICOM to Orthanc and confirm it appears in Orthanc Explorer. React shell renders.
2. **AI core** — `inference.predict` + `risk_score` working on 3 sample images; print results. Verify normalization gives sane probabilities (a clear pneumonia case should score high).
3. **Heatmap** — Grad-CAM PNG generated and visually correct (hotspot over the lesion).
4. **Full POST /api/studies** — wire steps 1–9 from §9; persist to SQLite; return `StudyOut`.
5. **Report** — Anthropic bilingual JSON, with templated fallback.
6. **Frontend Upload + StudyDetail** — drag-drop upload, viewer with original/heatmap toggle, RiskBadge, FindingsList (bars), ReportPanel (EN+SQ).
7. **Worklist** — list sorted by risk, color-coded bands, click → detail.
8. **Dept board + SSE + Telegram** — `useAlerts` EventSource; high-risk toast lands live; phone buzzes. This is the demo climax — make it reliable.
9. **Seed + demo polish** — `seed.py` loads curated cases (≥2 high-risk, ≥2 normal, 1 patient with two studies for the mocked "prior comparison"). Lock the demo dataset.
10. **Pitch pass** — clinical dark theme, Albanian framing, rehearse the 90s script.

If time is short, ship 1–8 fully before polishing. A working alert beats a pretty form.

---

## 12. Frontend notes

- Role switch lives in a top-bar dropdown (zustand). Switching role changes which board/queue is shown — no real auth.
- `useAlerts.ts`: open `new EventSource(`${API}/api/stream`)`, on message show `<AlertToast>` and refetch the relevant queue. Reconnect on error.
- `Viewer.tsx`: two `<img>` (original + heatmap), a toggle/opacity slider over them. No DICOM parsing in the browser (PNG-primary).
- Color bands: High = red, Medium = amber, Low = neutral/green. Keep consistent across badge, worklist rows, board.
- Clinical aesthetic: dark surface for the viewer, light UI around it, system font, generous spacing. Avoid hackathon-default look.

---

## 13. Known pitfalls + fallbacks

- **torchxrayvision weights download:** first run pulls weights from the internet; cache via the `model-cache` volume. Pre-warm in Dockerfile or a startup hook so the demo machine doesn't download live.
- **Normalization:** must use `xrv.datasets.normalize(img, 255)` → `[-1024,1024]`. Skipping it yields garbage probabilities. This is the most common failure.
- **Grayscale:** RGBA/RGB inputs must be collapsed to 1 channel before the transform.
- **Grad-CAM target layer:** use `model.features.denseblock4`. Wrong layer → blank/uniform heatmap.
- **Orthanc push:** prefer `POST /instances` (raw DICOM) over STOW-RS multipart. If an instance is rejected, check `PhotometricInterpretation`/`BitsAllocated` match the pixel dtype.
- **CORS:** FastAPI must allow `FRONTEND_ORIGIN` (`CORSMiddleware`, allow `*` for the hackathon). SSE needs the same.
- **SSE behind reload:** `uvicorn --reload` can drop SSE connections; the client must auto-reconnect.
- **Report latency/failure:** never block the response on Anthropic — timeout 8s, fall back to a templated impression built from the findings.
- **Viewer fallback (the big one):** if anyone tries Cornerstone3D/DICOMweb and it's not solid by hour ~18, **abandon it**. The PNG+heatmap path already satisfies "image uploader with basic viewer." Keep Orthanc purely for the "real PACS archive" story (show the study in Orthanc Explorer during the demo).
- **Telegram:** create a bot via @BotFather, get the token, send one manual message to the bot, then read `getUpdates` to find `chat_id`. Do this at the start so it's ready for the demo.

---

## 14. Definition of done (maps to the challenge's "minimum prototype")

- [ ] Image uploader with viewer (original + heatmap toggle).
- [ ] AI model returns findings + automatic Risk Score.
- [ ] Structured diagnostic report (EN + SQ).
- [ ] Image archived in PACS (Orthanc) with a real StudyInstanceUID, viewable in Orthanc Explorer.
- [ ] Cross-departmental access panel (role switch → dept queue).
- [ ] Automatic high-risk notification (SSE in-app + Telegram).
- [ ] Seeded demo data; 90s demo script runs without errors twice in a row.

---

## 15. Coding conventions

- Python: type hints everywhere, `ruff` + `black`, small pure functions in `services/`, routers thin.
- TS: `strict: true`, typed API layer in `api.ts`, no `any` in components.
- Secrets only via `.env`. No keys in code or git.
- Commit per phase: `feat(phase-N): <what>`. Keep commits runnable.
- Optimize for demo reliability: prefer try/except with graceful fallback over hard failures anywhere in the request path.

---

## 16. Demo script (target runtime — keep the build serving this)

1. Upload Ardit's chest X-ray → heatmap blooms, findings populate, risk hits **87 RED**.
2. Point at heatmap: AI is localizing the consolidation, not guessing.
3. Report panel fills in — English + Albanian.
4. Switch to Orthanc Explorer: the study is archived with its UID — a real PACS.
5. Second screen = Emergency board: the alert is already there; the on-call **phone buzzes** (Telegram).
6. Show the same patient's prior study → mocked "opacity has grown" delta.
7. Close: "turns a folder of forgotten images into a hospital-wide early-warning system, built for Albania."
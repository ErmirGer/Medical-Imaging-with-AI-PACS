# RadGuard — Demo & Setup Guide

## Prerequisites running
- **Backend**: `cd backend && .venv/Scripts/uvicorn app.main:app` → http://localhost:8000
- **Frontend**: `cd frontend && npm run dev` → http://localhost:5173
- **Orthanc PACS** (for the real-PACS step): `docker compose up -d orthanc` → http://localhost:8042
- **Telegram** (optional, for phone buzz): see below.

On first load, click **Load demo cases** in the Worklist to seed 5 curated studies.

---

## 90-second demo script

1. **Worklist** — "Every uploaded study is auto-triaged by AI risk score." Ardit
   Krasniqi sits at the top, **100 · High**, driver Pneumonia.
2. **Open Ardit's High study** — the **Grad-CAM heatmap** blooms red over the
   consolidation. Toggle it off/on, slide opacity: "the AI is *localizing* the
   finding, not guessing." Findings bars: Pneumonia 93%, Lung Opacity 92%.
3. **AI Report** — flip **EN → SQ**: a structured impression + recommendation in
   English and Albanian, generated live by Claude.
4. **Prior comparison** (bottom of Ardit's study) — "Same patient, earlier film
   scored 51. The opacity has grown — risk 51 → 100, Δ+49."
5. **PACS** — open **Orthanc Explorer** (http://localhost:8042): the study is
   archived with its real `StudyInstanceUID`. "A real PACS, not a mock."
6. **Cross-departmental + live alert** — switch role to **Emergency**, open the
   **Dept Board**: the high-risk cases are already routed there. Now upload a new
   chest X-ray → a red **HIGH-RISK ALERT** toast lands live (SSE) and, if
   Telegram is configured, **the on-call phone buzzes**. Click **Acknowledge**.
7. **Close** — "RadGuard turns a folder of forgotten images into a hospital-wide
   early-warning system — built for Albania."

---

## Telegram setup (phone buzz)
1. In Telegram, message **@BotFather** → `/newbot` → copy the **bot token**.
2. Send any message to your new bot (so it can reply to you).
3. Get your chat id: open
   `https://api.telegram.org/bot<TOKEN>/getUpdates` and read `result[0].message.chat.id`.
4. Put both in `.env`:
   ```env
   TELEGRAM_BOT_TOKEN=123456:ABC...
   TELEGRAM_CHAT_ID=987654321
   ```
5. Restart the backend. High-risk uploads now push a Telegram message.
   (If unset, the app simply skips Telegram — SSE in-app alerts still work.)

---

## Orthanc / PACS
- Start: `docker compose up -d orthanc`. Backend pushes each study via
  `POST /instances`; `archived` flips to **true** and the PACS chip shows
  "Archived in PACS" with the UID.
- If Orthanc is down, the pipeline still runs end-to-end — it records the
  generated `StudyInstanceUID` and marks `archived=false` (graceful fallback).
- To re-archive studies seeded while Orthanc was offline, reset and re-seed:
  delete `backend/storage/radguard.db`, restart backend, click **Load demo cases**.

---

## Reset demo state
```powershell
# stop backend first (releases the sqlite lock)
Remove-Item backend\storage\radguard.db -Force
Get-ChildItem backend\storage\images,backend\storage\uploads -File | Remove-Item -Force
# restart backend, then click "Load demo cases"
```

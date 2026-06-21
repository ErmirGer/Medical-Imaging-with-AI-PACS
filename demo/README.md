# skaNova — Demo Video

`skanova_demo.mp4` — ~1:46, 1080p, Albanian voiceover. Walks the full loop:
intro → problem → role-based login → risk-sorted worklist → any-modality upload →
AI risk score + Grad-CAM heatmap + confidence → findings (population reference,
clinical fusion, prior studies) → bilingual EN/SQ report → **real PACS archive
(Orthanc database)** → cross-departmental board + real-time high-risk alert →
printable PDF report → patient view → impact/jury closing.

## Regenerate

Both servers must be running (frontend `:5173`, backend `:8000`) and Orthanc on
`:8042` with the seeded demo studies.

```bash
# 1. capture authenticated screenshots of every page + the Orthanc PACS + title cards
cd frontend && node demo-capture.mjs        # -> demo/shots/*.png

# 2. Albanian voiceover (edge-tts sq-AL-AnilaNeural) + ffmpeg assembly (Ken Burns + fades)
backend/.venv/Scripts/python.exe demo/build_video.py   # -> demo/skanova_demo.mp4
```

- Narration text lives in `SCENES` inside `build_video.py` (one entry per scene).
- ffmpeg is the one bundled by `imageio-ffmpeg` (no system install needed).
- `shots/`, `clips/`, `vo/` are regenerable intermediates and are git-ignored.

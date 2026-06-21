# skaNova — Demo Video

`skanova_demo.mp4` — ~1:45, 1080p, Albanian voiceover. Built from **real recorded
app navigation** (smooth scrolling + live clicks), not static screenshots. Walks
the full loop:

intro (animated) → problem → role-based login → risk-sorted worklist →
any-modality upload → AI risk score + Grad-CAM heatmap + confidence → findings
(population reference, clinical fusion, prior studies) → bilingual EN/SQ report →
**real PACS archive (Orthanc database)** → cross-departmental board + real-time
high-risk alert → printable PDF report → patient view → impact/jury closing
(animated).

## Regenerate

Servers must be running: frontend `:5173`, backend `:8000`, Orthanc `:8042` with
the seeded demo studies. One command does everything:

```bash
backend/.venv/Scripts/python.exe demo/build_video.py
```

It:
1. generates the Albanian VO (`edge-tts`, `sq-AL-AnilaNeural`) → `demo/vo/`
2. writes `demo/scenes.json` (per-scene VO duration + target length)
3. runs `frontend/demo-record.mjs` (Playwright) → records each scene's real
   navigation as `demo/rec/*.webm`, timed to the VO
4. muxes each clip with its VO (cross-fades, stereo 48 kHz, loudness-normalized)
5. concatenates → `demo/skanova_demo.mp4`

Notes:
- Narration text + scene order live in `SCENES` inside `build_video.py`.
- Per-scene navigation (scroll targets, clicks) lives in `demo-record.mjs`.
- Animated intro/problem/outcome cards are CSS-animated HTML recorded the same way.
- ffmpeg is the one bundled by `imageio-ffmpeg` (no system install needed).
- `vo/`, `rec/`, `clips/`, `scenes.json` are regenerable and git-ignored.

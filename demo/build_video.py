"""Build the skaNova demo video.

Pipeline:
  1. generate Albanian VO per scene (edge-tts sq-AL)
  2. write scenes.json (shot + VO duration + target length)
  3. run frontend/demo-record.mjs -> records REAL app navigation as webm per scene
  4. mux each webm with its VO (smooth fades, stereo 48k audio) -> clip mp4
  5. concat -> demo/skanova_demo.mp4

Run with the backend venv python (edge-tts, imageio-ffmpeg, tinytag):
    backend/.venv/Scripts/python.exe demo/build_video.py
"""
from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys

import edge_tts
import imageio_ffmpeg
from tinytag import TinyTag

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FRONTEND = os.path.join(ROOT, "frontend")
VO = os.path.join(HERE, "vo")
REC = os.path.join(HERE, "rec")
CLIPS = os.path.join(HERE, "clips")
OUT = os.path.join(HERE, "skanova_demo.mp4")
SCENES_JSON = os.path.join(HERE, "scenes.json")
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
VOICE = "sq-AL-AnilaNeural"
FPS = 30
PAD = 0.45   # silent breathing room after each VO line
FADE = 0.35

for d in (VO, CLIPS):
    os.makedirs(d, exist_ok=True)

# (shot file, Albanian narration) — order defines the video
SCENES = [
    ("01_intro",
     "skaNova — inteligjencë artificiale për imazherinë mjekësore dhe "
     "arkivimin në PACS."),
    ("02_problem",
     "Interpretimi manual sjell vonesa dhe humbje diagnostike. Mungon arkivimi "
     "qendror dhe aksesi mes departamenteve."),
    ("03_login",
     "Hyrja bëhet me numër personal, e ndarë për mjekë dhe pacientë. Mjeku sheh "
     "vetëm pacientët e tij; pacienti, vetëm skanimet e veta."),
    ("04_worklist",
     "Lista e punës renditet automatikisht sipas Risk Score-it — rastet me rrezik "
     "të lartë dalin të parat."),
    ("05_upload",
     "Ngarkohet çdo imazh — rëntgen, CT, MRI apo ultratingull — me të dhënat "
     "klinike, dhe nis analiza automatike."),
    ("06_study_top",
     "AI-ja jep një Risk Score nga zero në njëqind dhe thekson zonën e dyshimtë "
     "me hartë nxehtësie, duke treguar ku po shikon. Tregon edhe sa i sigurt "
     "është, dhe kur duhet rishikim nga radiologu."),
    ("07_study_findings",
     "Gjetjet krahasohen me referencën e popullatës, ndërthuren me të dhënat "
     "klinike dhe me studimet e mëparshme të pacientit."),
    ("08_report_sq",
     "Gjenerohet automatikisht një raport i strukturuar diagnostik, "
     "në shqip dhe anglisht."),
    ("12_pacs",
     "Çdo studim arkivohet në një PACS real, Orthanc, me identifikues standard "
     "DICOM, gati për shkëmbim."),
    ("09_board",
     "Bordi ndërdepartamental jep akses në kohë reale; rastet me rrezik të lartë "
     "sinjalizohen menjëherë, edhe në telefon."),
    ("10_print",
     "Raporti printohet ose ruhet si PDF, gati për dosjen e pacientit."),
    ("11_patient",
     "Edhe pacienti hyn në llogarinë e vet dhe sheh skanimet e raportet e tij."),
    ("13_outcome",
     "skaNova mundëson zbulim më të hershëm, më pak vonesa dhe vendime të bazuara "
     "në të dhëna. Modeli bazohet në datasete si NIH dhe RSNA, dhe zgjerohet te "
     "CT, MRI e ultratingulli. skaNova — kujdes shëndetësor më i shpejtë dhe më i "
     "sigurt, për Shqipërinë."),
]


async def gen_vo() -> None:
    for shot, text in SCENES:
        out = os.path.join(VO, f"{shot}.mp3")
        await edge_tts.Communicate(text, VOICE, rate="+8%").save(out)
        print("vo", shot)


def dur(path: str) -> float:
    return float(TinyTag.get(path).duration or 0.0)


def build_clip(shot: str, target: float) -> str:
    webm = os.path.join(REC, f"{shot}.webm")
    audio = os.path.join(VO, f"{shot}.mp3")
    clip = os.path.join(CLIPS, f"{shot}.mp4")
    fade_out = max(0.0, target - FADE)
    vf = (
        "scale=1920:1080:force_original_aspect_ratio=increase,"
        "crop=1920:1080,fps=30,"
        f"fade=t=in:st=0:d={FADE},"
        f"fade=t=out:st={fade_out:.2f}:d={FADE},"
        "format=yuv420p"
    )
    af = "aresample=48000,aformat=channel_layouts=stereo,loudnorm=I=-16:TP=-1.5:LRA=11"
    cmd = [
        FFMPEG, "-y", "-i", webm, "-i", audio,
        "-filter_complex", f"[0:v]{vf}[v];[1:a]{af}[a]",
        "-map", "[v]", "-map", "[a]", "-t", f"{target:.3f}",
        "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-ac", "2",
        "-b:a", "192k", "-movflags", "+faststart", clip,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    print(f"clip {shot}  {target:5.1f}s")
    return clip


def main() -> None:
    # 1. VO
    asyncio.run(gen_vo())

    # 2. scenes.json with targets
    scenes = [
        {"shot": shot, "dur": round(dur(os.path.join(VO, f"{shot}.mp3")), 3)}
        for shot, _ in SCENES
    ]
    for s in scenes:
        s["target"] = round(s["dur"] + PAD, 3)
    with open(SCENES_JSON, "w", encoding="utf-8") as f:
        json.dump(scenes, f, ensure_ascii=False, indent=2)

    # 3. record real navigation
    print("\nrecording app navigation (playwright)...")
    subprocess.run(["node", "demo-record.mjs"], cwd=FRONTEND, check=True)

    # 4. clips
    print()
    clips, total = [], 0.0
    for s in scenes:
        clips.append(build_clip(s["shot"], s["target"]))
        total += s["target"]

    # 5. concat (clips are uniform -> stream copy; re-encode fallback)
    listfile = os.path.join(CLIPS, "list.txt")
    with open(listfile, "w", encoding="utf-8") as f:
        for c in clips:
            f.write(f"file '{c.replace(os.sep, '/')}'\n")
    concat = [FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", listfile,
              "-c", "copy", "-movflags", "+faststart", OUT]
    r = subprocess.run(concat, capture_output=True, text=True)
    if r.returncode != 0:
        print("copy concat failed, re-encoding...")
        concat = [FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", listfile,
                  "-c:v", "libx264", "-preset", "medium", "-crf", "20",
                  "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-ac", "2",
                  "-b:a", "192k", "-movflags", "+faststart", OUT]
        subprocess.run(concat, check=True)

    mm, ss = divmod(round(total), 60)
    print(f"\nDONE -> {OUT}")
    print(f"total ~ {mm}:{ss:02d} ({total:.1f}s)")


if __name__ == "__main__":
    sys.exit(main())

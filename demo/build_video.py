"""Build the skaNova demo video: Albanian VO (edge-tts) + Ken Burns/fades (ffmpeg).

Run with the backend venv python (has edge-tts, imageio-ffmpeg, tinytag):
    backend/.venv/Scripts/python.exe demo/build_video.py
"""
from __future__ import annotations

import asyncio
import os
import subprocess
import sys

import edge_tts
import imageio_ffmpeg
from tinytag import TinyTag

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "shots")
VO = os.path.join(HERE, "vo")
CLIPS = os.path.join(HERE, "clips")
OUT = os.path.join(HERE, "skanova_demo.mp4")
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
VOICE = "sq-AL-AnilaNeural"
BG = "0x070b14"
FPS = 30
TAIL = 0.4  # silent breathing room after each line
FADE = 0.3

os.makedirs(VO, exist_ok=True)
os.makedirs(CLIPS, exist_ok=True)

# (shot file, Albanian narration)
SCENES = [
    ("01_intro",
     "skaNova — inteligjencë artificiale për imazherinë mjekësore dhe arkivimin "
     "në PACS, ndërtuar për spitalet shqiptare."),
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


def build_clip(shot: str) -> tuple[str, float]:
    img = os.path.join(SHOTS, f"{shot}.png")
    audio = os.path.join(VO, f"{shot}.mp3")
    clip = os.path.join(CLIPS, f"{shot}.mp4")
    d = dur(audio) + TAIL
    frames = max(1, round(d * FPS))
    fade_out = max(0.0, d - FADE)
    vf = (
        "scale=2304:1296:force_original_aspect_ratio=decrease,"
        f"pad=2304:1296:(ow-iw)/2:(oh-ih)/2:color={BG},"
        f"zoompan=z=min(zoom+0.00035\\,1.08):d={frames}"
        ":x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2):s=1920x1080:fps={fps},".format(fps=FPS)
        + f"fade=t=in:st=0:d={FADE},"
        + f"fade=t=out:st={fade_out:.2f}:d={FADE},"
        + "format=yuv420p"
    )
    cmd = [
        FFMPEG, "-y", "-i", img, "-i", audio,
        "-filter_complex", f"[0:v]{vf}[v]",
        "-map", "[v]", "-map", "1:a",
        "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
        "-movflags", "+faststart", clip,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    print(f"clip {shot}  {d:5.1f}s")
    return clip, d


def main() -> None:
    asyncio.run(gen_vo())
    clips, total = [], 0.0
    for shot, _ in SCENES:
        clip, d = build_clip(shot)
        clips.append(clip)
        total += d

    listfile = os.path.join(CLIPS, "list.txt")
    with open(listfile, "w", encoding="utf-8") as f:
        for c in clips:
            f.write(f"file '{c.replace(os.sep, '/')}'\n")

    # try stream-copy concat; fall back to re-encode if it complains
    concat = [FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", listfile,
              "-c", "copy", "-movflags", "+faststart", OUT]
    r = subprocess.run(concat, capture_output=True, text=True)
    if r.returncode != 0:
        print("copy concat failed, re-encoding...")
        concat = [FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", listfile,
                  "-c:v", "libx264", "-preset", "medium", "-crf", "20",
                  "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
                  "-movflags", "+faststart", OUT]
        subprocess.run(concat, check=True)

    mm, ss = divmod(round(total), 60)
    print(f"\nDONE -> {OUT}")
    print(f"total ~ {mm}:{ss:02d} ({total:.1f}s)")


if __name__ == "__main__":
    sys.exit(main())

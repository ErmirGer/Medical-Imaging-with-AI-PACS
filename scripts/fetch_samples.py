"""Download the real, provenance-documented chest X-rays used for the demo seed.

Every image is a genuine radiograph from a recognized public dataset; the source
of each is recorded in data/samples/manifest.json and mirrored below.

- NIH ChestX-ray14 (NIH Clinical Center, public domain) — the canonical
  00000001_000 / 00027426_000 radiographs, distributed with torchxrayvision.
- COVID-19 Image Data Collection (Cohen et al., JMLR 2020, CC BY-NC-SA).
- Wikimedia Commons — a clean normal PA chest film (public domain).

NOTE on the other challenge datasets: RSNA Pneumonia Detection and VinBigData
Chest X-ray are distributed via Kaggle and require an account + license
acceptance, so they cannot be pulled unattended here. They are, however, part of
the data the AI model was trained on: torchxrayvision's `densenet121-res224-all`
weights are trained on the union of NIH ChestX-ray14, RSNA, CheXpert, MIMIC-CXR
and PadChest. To use official RSNA/VinBigData images, download them from Kaggle,
drop the files in data/samples/, add entries to manifest.json, and re-seed.

Usage:  python scripts/fetch_samples.py
"""
from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "data" / "samples"
OUT.mkdir(parents=True, exist_ok=True)

_XRV = "https://raw.githubusercontent.com/mlmed/torchxrayvision/main/tests/"

# (filename, url) — keep in sync with data/samples/manifest.json
CANDIDATES = [
    ("nih_chestxray14_00000001.png", _XRV + "00000001_000.png"),
    ("nih_chestxray14_00027426.png", _XRV + "00027426_000.png"),
    ("covid_collection_pneumonia_58.jpg", _XRV + "covid-19-pneumonia-58-prior.jpg"),
    ("xrv_sample_16747.jpg", _XRV + "16747_3_1.jpg"),
    (
        "normal_wikimedia_pa.png",
        "https://commons.wikimedia.org/wiki/Special:FilePath/Chest_Xray_PA_3-8-2010.png",
    ),
]

HEADERS = {"User-Agent": "Mozilla/5.0 (RadGuard demo fetch)"}


def fetch(name: str, url: str) -> bool:
    dst = OUT / name
    if dst.exists() and dst.stat().st_size > 0:
        print(f"  = {name} (cached)")
        return True
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
        dst.write_bytes(data)
        print(f"  + {name} ({len(data)//1024} KB)")
        return True
    except Exception as exc:
        print(f"  ! {name} failed: {exc}")
        return False


def main() -> int:
    print(f"Downloading samples -> {OUT}")
    ok = sum(fetch(n, u) for n, u in CANDIDATES)
    print(f"{ok}/{len(CANDIDATES)} downloaded")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

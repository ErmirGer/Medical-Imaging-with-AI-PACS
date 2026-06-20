"""Download a handful of real public chest X-ray images for the demo.

Sources are public/research datasets. We download a spread of likely-positive
and likely-normal images; the actual model scores (printed by curate_samples)
decide which become the curated demo cases.

Usage:  python scripts/fetch_samples.py
"""
from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "data" / "samples"
OUT.mkdir(parents=True, exist_ok=True)

# (filename, url) — public chest X-ray images.
# covid-chestxray-dataset (ieee8023) holds real CXRs with strong findings;
# Wikimedia holds clean normal PA views.
CANDIDATES = [
    # strong pneumonia / consolidation cases
    ("pneumonia_1.jpg",
     "https://raw.githubusercontent.com/ieee8023/covid-chestxray-dataset/master/images/1-s2.0-S0140673620303706-fx1_lrg.jpg"),
    ("pneumonia_2.jpg",
     "https://raw.githubusercontent.com/ieee8023/covid-chestxray-dataset/master/images/auntminnie-a-2020_01_28_23_51_6665_2020_01_28_Vietnam_coronavirus.jpeg"),
    ("pneumonia_3.jpg",
     "https://raw.githubusercontent.com/ieee8023/covid-chestxray-dataset/master/images/nejmoa2001191_f3-PA.jpeg"),
    ("effusion_1.jpg",
     "https://raw.githubusercontent.com/ieee8023/covid-chestxray-dataset/master/images/nejmoa2001191_f1-PA.jpeg"),
    ("pneumonia_4.jpg",
     "https://raw.githubusercontent.com/ieee8023/covid-chestxray-dataset/master/images/ryct.2020200028.fig1a.jpeg"),
    # normal PA chest film
    ("normal_1.png",
     "https://upload.wikimedia.org/wikipedia/commons/c/c8/Chest_Xray_PA_3-8-2010.png"),
    ("normal_2.jpg",
     "https://upload.wikimedia.org/wikipedia/commons/e/e2/Normal_posteroanterior_%28PA%29_chest_radiograph_%28X-ray%29.jpg"),
]

HEADERS = {"User-Agent": "Mozilla/5.0 (RadGuard demo fetch)"}


def fetch(name: str, url: str) -> bool:
    dst = OUT / name
    if dst.exists() and dst.stat().st_size > 0:
        print(f"  = {name} (cached)")
        return True
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=30) as r:
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

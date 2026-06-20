"""Run inference on every image in data/samples and print risk scores.

Used to (a) verify normalization gives sane probabilities and (b) decide which
images become curated demo cases in manifest.json.

Run from the backend venv:
    backend\\.venv\\Scripts\\python.exe scripts\\curate_samples.py
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.services import inference  # noqa: E402

SAMPLES = ROOT / "data" / "samples"


def main() -> int:
    imgs = sorted(
        p for p in SAMPLES.glob("*") if p.suffix.lower() in (".png", ".jpg", ".jpeg")
    )
    if not imgs:
        print("no sample images found")
        return 1
    print(f"Scoring {len(imgs)} images...\n")
    for img in imgs:
        try:
            probs = inference.predict(str(img))
            risk = inference.risk_score(probs)
            top = ", ".join(
                f"{f['pathology']}={f['probability']:.2f}"
                for f in risk["top_findings"][:3]
            )
            print(
                f"{img.name:28s} score={risk['score']:3d} {risk['band']:6s} "
                f"driver={risk['driver']:24s} | {top}"
            )
        except Exception as exc:
            print(f"{img.name:28s} ERROR: {exc}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

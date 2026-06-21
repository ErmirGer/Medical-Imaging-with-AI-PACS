"""Claude vision analysis for ANY medical image (X-ray/CT/MRI/Ultrasound, any
body region).

The torchxrayvision model is chest-X-ray-only: feeding it a hand X-ray, an MRI,
or an ultrasound produces meaningless "chest" probabilities. This module sends
the actual pixels to Claude so the report is grounded in what is really in the
image — the modality, the body region, and the abnormalities that are actually
visible — instead of assumed.

Returns None when the API key is missing or the call fails, so the pipeline can
fall back gracefully.
"""
from __future__ import annotations

import base64
import io
import json
import logging

from ..config import settings

log = logging.getLogger("radguard.vision")

SYSTEM = (
    "You are a careful radiology AI assisting clinicians. You analyze a single "
    "medical image and report only what you can actually see. You identify the "
    "imaging modality and the body region, you never assume it is a chest study, "
    "you never invent findings, and you state uncertainty plainly. This is AI "
    "decision support, not a definitive diagnosis. Return ONLY valid JSON, no markdown."
)

_ALLOWED_MODALITIES = {"X-ray", "CT", "MRI", "Ultrasound", "Other"}
_ALLOWED_SEVERITY = {"none", "mild", "moderate", "severe"}
_ALLOWED_BANDS = {"Low", "Medium", "High"}


def _model() -> str:
    return settings.VISION_MODEL or settings.REPORT_MODEL


def _encode(path: str) -> tuple[str, str]:
    """Downscale to <=1024px and return (base64 jpeg, media_type)."""
    from PIL import Image

    img = Image.open(path).convert("RGB")
    img.thumbnail((1024, 1024))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return base64.standard_b64encode(buf.getvalue()).decode(), "image/jpeg"


def _clinical_line(clinical: dict | None) -> str:
    if not clinical:
        return ""
    bits = []
    if clinical.get("symptoms"):
        bits.append(f"symptoms: {clinical['symptoms']}")
    if clinical.get("temperature"):
        bits.append(f"temp {float(clinical['temperature']):.1f}C")
    if clinical.get("spo2"):
        bits.append(f"SpO2 {int(clinical['spo2'])}%")
    if clinical.get("smoker"):
        bits.append("active smoker")
    return ("Clinical context: " + ", ".join(bits) + ".\n") if bits else ""


def analyze(path: str, patient: dict | None = None, clinical: dict | None = None) -> dict | None:
    if not settings.ANTHROPIC_API_KEY:
        return None
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        data, media = _encode(path)

        ctx = ""
        if patient and patient.get("name"):
            ctx += f"Patient: {patient.get('name')}, age {patient.get('age', '?')}.\n"
        ctx += _clinical_line(clinical)

        prompt = (
            ctx
            + "Analyze this medical image. Determine the imaging modality and the "
            "body region, detect any abnormalities you can actually see, and assign "
            "an overall clinical risk score from 0-100 (higher = more urgent).\n"
            "IGNORE everything that is not anatomy: any burned-in text, letters, "
            "numbers, dates/timestamps, patient/institution labels, watermarks, "
            "measurement overlays, side markers, and device or equipment labels. "
            "Also ignore whether the image is a photograph of a screen or film. "
            "NEVER mention dates, years, the photo/screen, or image artifacts in "
            "your findings, driver, or impression — describe only the anatomy and "
            "any pathology.\n"
            "Return JSON with EXACTLY these keys:\n"
            '{"is_medical": boolean, '
            '"modality": "X-ray" | "CT" | "MRI" | "Ultrasound" | "Other", '
            '"body_region": string (e.g. "Hand", "Chest", "Knee", "Abdomen"), '
            '"is_chest_xray": boolean, '
            '"findings": [{"name": string, "name_sq": string, '
            '"probability": number 0-1, '
            '"severity": "none" | "mild" | "moderate" | "severe"}], '
            '"risk_score": integer 0-100, '
            '"risk_band": "Low" | "Medium" | "High", '
            '"driver": string (the single most important finding), '
            '"driver_sq": string, '
            '"impression_en": string, "impression_sq": string, '
            '"recommendation_en": string, "recommendation_sq": string, '
            '"quality": "good" | "poor", "quality_issue": string, '
            '"confidence": integer 0-100, "confidence_reason": string, '
            '"confidence_reason_sq": string}.\n'
            "confidence = how certain you are this analysis is CORRECT. Most "
            "readable images deserve HIGH confidence (typically 85-97). Only lower "
            "it for genuinely difficult images — heavily limited/blurry, truly "
            "ambiguous or atypical findings, or outside your expertise (and rarely "
            "below 60). "
            "confidence_reason (EN) and confidence_reason_sq (Albanian) briefly say "
            "why, and whether a specialist should double-check. "
            "Set severity to how clinically concerning each finding is: 'none' for "
            "normal/reassuring observations (e.g. 'no fracture', 'normal "
            "alignment'), up to 'severe' for urgent pathology. "
            "Set quality to 'poor' if the image is too blurry, too dark or washed "
            "out, heavily cropped, low-resolution, or otherwise not diagnostic, and "
            "put a short reason in quality_issue; otherwise 'good' with an empty "
            "quality_issue. "
            "name_sq, driver_sq, impression_sq and recommendation_sq MUST be in "
            "Albanian; name/driver/impression_en/recommendation_en in English. "
            "List up to 6 findings, most significant first; if the image is normal, "
            "return a single finding named 'No acute abnormality'. Keep each "
            "impression and recommendation 1-3 sentences, clinical tone. "
            "If the image is not a medical image, set is_medical=false and risk_score=0."
        )

        msg = client.messages.create(
            model=_model(),
            max_tokens=1300,
            system=SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media,
                                "data": data,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
            timeout=40.0,
        )
        text = "".join(b.text for b in msg.content if b.type == "text")
        text = (
            text.strip()
            .removeprefix("```json")
            .removeprefix("```")
            .removesuffix("```")
            .strip()
        )
        return _normalize(json.loads(text))
    except Exception as exc:  # noqa: BLE001 — never block the pipeline on vision
        log.warning("vision analyze failed: %s", exc)
        return None


def _normalize(d: dict) -> dict:
    """Clamp/validate the model's JSON into safe, predictable shapes."""
    modality = d.get("modality") if d.get("modality") in _ALLOWED_MODALITIES else "Other"

    findings = []
    for f in (d.get("findings") or [])[:6]:
        try:
            p = float(f.get("probability", 0) or 0)
        except (TypeError, ValueError):
            p = 0.0
        p = max(0.0, min(1.0, p))
        sev = f.get("severity") if f.get("severity") in _ALLOWED_SEVERITY else "mild"
        name = str(f.get("name", "Finding")).strip() or "Finding"
        name_sq = str(f.get("name_sq", "") or "").strip() or name
        findings.append(
            {
                "name": name,
                "name_sq": name_sq,
                "probability": round(p, 3),
                "severity": sev,
            }
        )

    try:
        score = int(round(float(d.get("risk_score", 0) or 0)))
    except (TypeError, ValueError):
        score = 0
    score = max(0, min(100, score))

    band = d.get("risk_band") if d.get("risk_band") in _ALLOWED_BANDS else None
    if band is None:
        band = "High" if score >= 70 else "Medium" if score >= 40 else "Low"

    driver = str(d.get("driver") or (findings[0]["name"] if findings else "Finding"))
    driver_sq = str(d.get("driver_sq", "") or "").strip() or (
        findings[0]["name_sq"] if findings else driver
    )
    quality = "poor" if str(d.get("quality", "good")).lower() == "poor" else "good"

    try:
        conf = int(round(float(d.get("confidence", 60) or 60)))
    except (TypeError, ValueError):
        conf = 60
    conf = max(0, min(100, conf))

    return {
        "is_medical": bool(d.get("is_medical", True)),
        "quality": quality,
        "quality_issue": str(d.get("quality_issue", "") or "").strip(),
        "confidence": conf,
        "confidence_reason": str(d.get("confidence_reason", "") or "").strip(),
        "confidence_reason_sq": str(d.get("confidence_reason_sq", "") or "").strip(),
        "modality": modality,
        "body_region": str(d.get("body_region", "") or "").strip(),
        "is_chest_xray": bool(d.get("is_chest_xray", False)),
        "findings": findings,
        "risk_score": score,
        "risk_band": band,
        "driver": driver,
        "driver_sq": driver_sq,
        "impression_en": str(d.get("impression_en", "") or ""),
        "impression_sq": str(d.get("impression_sq", "") or ""),
        "recommendation_en": str(d.get("recommendation_en", "") or ""),
        "recommendation_sq": str(d.get("recommendation_sq", "") or ""),
    }


def modality_to_dicom(modality: str) -> str:
    """Map a human modality label to a DICOM modality code."""
    return {
        "X-ray": "DX",
        "CT": "CT",
        "MRI": "MR",
        "Ultrasound": "US",
        "Other": "OT",
    }.get(modality, "DX")

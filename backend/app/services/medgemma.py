"""MedGemma (Google) imaging analysis via an OpenAI-compatible endpoint.

MedGemma is open-weights and not a first-party hosted API. This client talks to
any OpenAI-compatible `/chat/completions` endpoint that serves a MedGemma
multimodal model — a Hugging Face Inference Endpoint, Google Vertex AI's
OpenAI-compatible path, or a self-hosted vLLM/Ollama server. Configure it with
MEDGEMMA_BASE_URL + MEDGEMMA_API_KEY + MEDGEMMA_MODEL.

MedGemma does the *image* analysis (modality, region, findings, risk); Claude
writes the bilingual description/report downstream. Returns None when not
configured or on any failure, so the pipeline falls back to the built-in
analyzers.
"""
from __future__ import annotations

import base64
import io
import json
import logging

import httpx

from ..config import settings

log = logging.getLogger("radguard.medgemma")

SYSTEM = (
    "You are MedGemma, a medical imaging analysis model. You examine a single "
    "medical image (X-ray, CT, MRI, ultrasound, etc.) and report only the "
    "anatomy and any pathology you can actually see. You never assume the body "
    "region, never invent findings, and you state uncertainty. This is decision "
    "support, not a definitive diagnosis. Return ONLY valid JSON, no markdown."
)

_ALLOWED_MODALITIES = {"X-ray", "CT", "MRI", "Ultrasound", "Other"}
_ALLOWED_SEVERITY = {"none", "mild", "moderate", "severe"}
_ALLOWED_BANDS = {"Low", "Medium", "High"}


def is_enabled() -> bool:
    return bool(settings.MEDGEMMA_BASE_URL and settings.MEDGEMMA_MODEL)


def _endpoint() -> str:
    base = settings.MEDGEMMA_BASE_URL.rstrip("/")
    return base if base.endswith("/chat/completions") else base + "/chat/completions"


def _encode(path: str) -> str:
    from PIL import Image

    img = Image.open(path).convert("RGB")
    img.thumbnail((1024, 1024))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    b64 = base64.standard_b64encode(buf.getvalue()).decode()
    return f"data:image/jpeg;base64,{b64}"


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
    if not is_enabled():
        return None
    try:
        ctx = ""
        if patient and patient.get("name"):
            ctx += f"Patient age {patient.get('age', '?')}.\n"
        ctx += _clinical_line(clinical)

        prompt = (
            ctx
            + "Analyze this medical image. Determine the imaging modality and the "
            "body region, detect any abnormalities, and assign an overall clinical "
            "risk score 0-100 (higher = more urgent). Ignore burned-in text, dates, "
            "device labels, side markers and any photo-of-screen artifacts — never "
            "mention them; describe only anatomy and pathology.\n"
            "Return JSON with EXACTLY these keys:\n"
            '{"is_medical": boolean, '
            '"modality": "X-ray" | "CT" | "MRI" | "Ultrasound" | "Other", '
            '"body_region": string, "is_chest_xray": boolean, '
            '"findings": [{"name": string, "probability": number 0-1, '
            '"severity": "none" | "mild" | "moderate" | "severe"}], '
            '"risk_score": integer 0-100, "risk_band": "Low" | "Medium" | "High", '
            '"driver": string, "quality": "good" | "poor", "quality_issue": string}.\n'
            "severity = how clinically concerning each finding is ('none' for "
            "normal/reassuring observations). quality='poor' if too blurry/dark/"
            "cropped/low-res to read. Up to 6 findings, most significant first; if "
            "normal, a single finding 'No acute abnormality'. is_medical=false if "
            "this is not a medical image."
        )

        payload = {
            "model": settings.MEDGEMMA_MODEL,
            "max_tokens": 1200,
            "temperature": 0.0,
            "messages": [
                {"role": "system", "content": SYSTEM},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": _encode(path)}},
                    ],
                },
            ],
        }
        headers = {"Content-Type": "application/json"}
        if settings.MEDGEMMA_API_KEY:
            headers["Authorization"] = f"Bearer {settings.MEDGEMMA_API_KEY}"

        r = httpx.post(_endpoint(), json=payload, headers=headers, timeout=60)
        r.raise_for_status()
        text = r.json()["choices"][0]["message"]["content"]
        text = (
            text.strip()
            .removeprefix("```json")
            .removeprefix("```")
            .removesuffix("```")
            .strip()
        )
        return _normalize(json.loads(text))
    except Exception as exc:  # noqa: BLE001 — never block the pipeline on MedGemma
        log.warning("medgemma analyze failed: %s", exc)
        return None


def _normalize(d: dict) -> dict:
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
        findings.append({"name": name, "probability": round(p, 3), "severity": sev})

    try:
        score = int(round(float(d.get("risk_score", 0) or 0)))
    except (TypeError, ValueError):
        score = 0
    score = max(0, min(100, score))
    band = d.get("risk_band") if d.get("risk_band") in _ALLOWED_BANDS else None
    if band is None:
        band = "High" if score >= 70 else "Medium" if score >= 40 else "Low"

    return {
        "is_medical": bool(d.get("is_medical", True)),
        "quality": "poor" if str(d.get("quality", "good")).lower() == "poor" else "good",
        "quality_issue": str(d.get("quality_issue", "") or "").strip(),
        "modality": modality,
        "body_region": str(d.get("body_region", "") or "").strip(),
        "is_chest_xray": bool(d.get("is_chest_xray", False)),
        "findings": findings,
        "risk_score": score,
        "risk_band": band,
        "driver": str(d.get("driver") or (findings[0]["name"] if findings else "Finding")),
    }


def modality_to_dicom(modality: str) -> str:
    return {
        "X-ray": "DX",
        "CT": "CT",
        "MRI": "MR",
        "Ultrasound": "US",
        "Other": "OT",
    }.get(modality, "DX")

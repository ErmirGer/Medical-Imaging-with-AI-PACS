"""Anthropic bilingual (EN + SQ) structured radiology report, with safe fallback."""
from __future__ import annotations

import json
import logging

from ..config import settings

log = logging.getLogger("radguard.report")

SYSTEM = (
    "You are a radiology reporting assistant for chest X-rays. "
    "You produce concise, structured impressions for clinician review. "
    "You never give a definitive diagnosis; this is AI decision support. "
    "Return ONLY valid JSON, no markdown."
)


def _clinical_str(clinical: dict | None) -> str:
    """One-line human-readable clinical summary, or '' if nothing provided."""
    if not clinical:
        return ""
    bits = []
    if clinical.get("symptoms"):
        bits.append(f"symptoms: {clinical['symptoms']}")
    if clinical.get("temperature"):
        bits.append(f"temp {float(clinical['temperature']):.1f}°C")
    if clinical.get("spo2"):
        bits.append(f"SpO₂ {int(clinical['spo2'])}%")
    if clinical.get("smoker"):
        bits.append("active smoker")
    return ", ".join(bits)


def _fallback(patient: dict, risk: dict, findings: list[dict]) -> dict:
    top = findings[0]["pathology"] if findings else risk.get("driver", "finding")
    band = risk.get("band", "Low")
    score = risk.get("score", 0)
    en_imp = (
        f"AI-assisted review of the chest radiograph suggests {top.lower()} as the "
        f"predominant finding (risk {score}, {band}). Correlate clinically."
    )
    sq_imp = (
        f"Vlerësimi me ndihmën e AI i radiografisë së kraharorit sugjeron {top.lower()} "
        f"si gjetjen kryesore (rrezik {score}, {band}). Korreloni klinikisht."
    )
    if band == "High":
        en_rec = "Urgent radiologist review and clinical correlation recommended."
        sq_rec = "Rekomandohet rishikim urgjent nga radiologu dhe korrelim klinik."
    else:
        en_rec = "Routine radiologist confirmation recommended."
        sq_rec = "Rekomandohet konfirmim rutinë nga radiologu."
    return {
        "impression_en": en_imp,
        "impression_sq": sq_imp,
        "recommendation_en": en_rec,
        "recommendation_sq": sq_rec,
    }


def generate(
    patient: dict, risk: dict, findings: list[dict], clinical: dict | None = None
) -> dict:
    if not settings.ANTHROPIC_API_KEY:
        return _fallback(patient, risk, findings)
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        finding_str = ", ".join(
            f"{f['pathology']} {f['probability']:.2f}" for f in findings[:5]
        )
        clinical_line = ""
        clin = _clinical_str(clinical)
        if clin:
            clinical_line = f"Clinical context: {clin}.\n"
        factors = risk.get("clinical_factors") or []
        if factors:
            clinical_line += "Clinical risk factors: " + "; ".join(factors) + ".\n"
        prompt = (
            f"Patient: {patient['name']}, age {patient['age']}.\n"
            f"{clinical_line}"
            f"Risk score {risk['score']} ({risk['band']}), main driver {risk['driver']}.\n"
            f"Model findings (probability): {finding_str}.\n"
            "Integrate the imaging findings with the clinical context above in your "
            "impression (note any concordance, e.g. fever or hypoxia supporting an "
            "infective process).\n"
            'Return JSON: {"impression_en","impression_sq","recommendation_en",'
            '"recommendation_sq"}. Keep each field 1-2 sentences, clinical tone.'
        )
        msg = client.messages.create(
            model=settings.REPORT_MODEL,
            max_tokens=700,
            system=SYSTEM,
            messages=[{"role": "user", "content": prompt}],
            timeout=8.0,
        )
        text = "".join(b.text for b in msg.content if b.type == "text")
        text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        data = json.loads(text)
        # ensure all keys present
        for k in (
            "impression_en",
            "impression_sq",
            "recommendation_en",
            "recommendation_sq",
        ):
            data.setdefault(k, "")
        return data
    except Exception as exc:
        log.warning("report generation failed, using fallback: %s", exc)
        return _fallback(patient, risk, findings)

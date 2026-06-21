"""torchxrayvision inference + Grad-CAM heatmap + deterministic risk score.

The normalization (`xrv.datasets.normalize(img, 255)`) is the #1 footgun — it maps
[0,255] -> [-1024,1024]. Skipping it yields garbage probabilities.
"""
from __future__ import annotations

import numpy as np
import skimage.io
import torch
import torchvision
import torchxrayvision as xrv
from PIL import Image

_MODEL = None


def get_model():
    global _MODEL
    if _MODEL is None:
        _MODEL = xrv.models.DenseNet(weights="densenet121-res224-all").eval()
    return _MODEL


def _preprocess(path: str) -> torch.Tensor:
    img = skimage.io.imread(path)
    if img.ndim == 3:  # RGB/RGBA -> grayscale
        img = img[..., :3].mean(2)
    img = xrv.datasets.normalize(img, 255)  # [0,255] -> [-1024,1024]
    img = img[None, ...]  # (1, H, W)
    tf = torchvision.transforms.Compose(
        [xrv.datasets.XRayCenterCrop(), xrv.datasets.XRayResizer(224)]
    )
    img = tf(img)  # (1, 224, 224)
    return torch.from_numpy(img)[None, ...]  # (1, 1, 224, 224)


def predict(path: str) -> dict[str, float]:
    model = get_model()
    x = _preprocess(path)
    with torch.no_grad():
        out = model(x)[0]  # already sigmoid-activated, [0,1]
    return {p: float(v) for p, v in zip(model.pathologies, out.numpy())}


def heatmap(path: str, top_pathology: str, out_png: str) -> None:
    """Grad-CAM overlay for the given pathology, saved as a 512x512 RGB PNG."""
    import matplotlib

    matplotlib.use("Agg")
    from matplotlib import colormaps
    from pytorch_grad_cam import GradCAM
    from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget

    model = get_model()
    top_idx = list(model.pathologies).index(top_pathology)
    x = _preprocess(path)  # (1,1,224,224)
    cam = GradCAM(model=model, target_layers=[model.features.denseblock4])
    grayscale = cam(input_tensor=x, targets=[ClassifierOutputTarget(top_idx)])[0]

    base = x[0, 0].numpy()
    base = (base - base.min()) / (np.ptp(base) + 1e-8)  # [0,1]
    heat = colormaps["jet"](grayscale)[..., :3]
    blend = 0.55 * np.stack([base] * 3, -1) + 0.45 * heat
    Image.fromarray((blend * 255).astype(np.uint8)).resize((512, 512)).save(out_png)


def save_original_png(path: str, out_png: str) -> None:
    """Plain grayscale 512x512 PNG of the (preprocessed) original for the toggle view.

    Center-cropped + resized so it aligns with the Grad-CAM heatmap overlay. Use
    only for the chest path where a heatmap is produced.
    """
    x = _preprocess(path)
    base = x[0, 0].numpy()
    base = (base - base.min()) / (np.ptp(base) + 1e-8)
    Image.fromarray((base * 255).astype(np.uint8)).resize((512, 512)).convert("L").save(
        out_png
    )


def save_display_png(path: str, out_png: str, max_size: int = 768) -> None:
    """Faithful, aspect-ratio-preserving copy of the upload for display.

    No center-crop or square resize — used for non-chest images (vision path)
    where there is no heatmap to align with, so the full image must be shown.
    """
    img = Image.open(path).convert("RGB")
    img.thumbnail((max_size, max_size))
    img.save(out_png, format="PNG")


# --- Risk score -----------------------------------------------------------

WEIGHTS = {  # clinical urgency weight per pathology
    "Pneumothorax": 1.00,
    "Mass": 0.92,
    "Consolidation": 0.88,
    "Pneumonia": 0.88,
    "Edema": 0.82,
    "Effusion": 0.72,
    "Lung Opacity": 0.65,
    "Nodule": 0.62,
    "Lung Lesion": 0.60,
    "Infiltration": 0.55,
    "Cardiomegaly": 0.50,
    "Atelectasis": 0.45,
    "Enlarged Cardiomediastinum": 0.45,
    "Fracture": 0.45,
}
DEFAULT_W = 0.30

# Approximate population prevalence per pathology (NIH ChestX-ray14-scale base
# rates). Used for the "comparison with population reference" view — how far a
# patient's finding sits above the normal cohort baseline. Reference only.
POPULATION_RATES = {
    "Atelectasis": 0.103,
    "Consolidation": 0.042,
    "Infiltration": 0.177,
    "Pneumothorax": 0.047,
    "Edema": 0.021,
    "Emphysema": 0.022,
    "Fibrosis": 0.015,
    "Effusion": 0.119,
    "Pneumonia": 0.013,
    "Pleural_Thickening": 0.030,
    "Cardiomegaly": 0.025,
    "Nodule": 0.057,
    "Mass": 0.030,
    "Hernia": 0.002,
    "Lung Opacity": 0.115,
    "Enlarged Cardiomediastinum": 0.047,
    "Lung Lesion": 0.030,
    "Fracture": 0.020,
}
DEFAULT_RATE = 0.05

# Albanian names for the chest pathologies (for the bilingual findings view).
PATHOLOGY_SQ = {
    "Atelectasis": "Atelektazë",
    "Consolidation": "Konsolidim",
    "Infiltration": "Infiltrim",
    "Pneumothorax": "Pneumotoraks",
    "Edema": "Edemë",
    "Emphysema": "Emfizemë",
    "Fibrosis": "Fibrozë",
    "Effusion": "Efuzion pleural",
    "Pneumonia": "Pneumoni",
    "Pleural_Thickening": "Trashje pleurale",
    "Cardiomegaly": "Kardiomegali",
    "Nodule": "Nodul",
    "Mass": "Masë",
    "Hernia": "Hernie",
    "Lung Opacity": "Errësim pulmonar",
    "Enlarged Cardiomediastinum": "Mediastin i zgjeruar",
    "Lung Lesion": "Lezion pulmonar",
    "Fracture": "Frakturë",
}


def confidence_payload(
    score: int, borderline: int = 0, reason: str | None = None, reason_sq: str | None = None
) -> dict:
    """Wrap a 0-100 confidence into band + bilingual note + double-check flag.

    Shared by every analyzer so the doctor-facing meaning is consistent.
    """
    score = max(0, min(100, int(round(score))))
    band = "High" if score >= 70 else "Moderate" if score >= 50 else "Low"
    double_check = band == "Low"  # only Low gets the strong double-check flag
    if reason:
        note, note_sq = reason, (reason_sq or reason)
    elif band == "High":
        note = "Findings are decisive — high-confidence analysis."
        note_sq = "Gjetjet janë të qarta — analizë me besueshmëri të lartë."
    elif band == "Moderate":
        note = (
            f"{borderline} finding(s) sit near the decision threshold — "
            "verify the main finding."
        )
        note_sq = (
            f"{borderline} gjetje afër pragut të vendimit — "
            "verifikoni gjetjen kryesore."
        )
    else:
        note = "Several borderline findings — radiologist double-check recommended."
        note_sq = "Disa gjetje kufitare — rekomandohet rishikim nga radiologu."
    return {
        "score": score,
        "band": band,
        "note": note,
        "note_sq": note_sq,
        "double_check": double_check,
    }


def analysis_confidence(probabilities: list[float]) -> dict:
    """Deterministic confidence for the chest model from its full probability
    vector — how sure it is the analysis is correct.

    Signals:
    - Leading finding's decisiveness: a driver at 0.9 is a confident positive;
      at 0.55 it's a coin-flip. If nothing exceeds ~0.4 the study is a confident
      negative (clearly normal).
    - Competing ambiguity: several findings clustered in the 0.40-0.65 band mean
      the model can't tell them apart -> lower confidence, double-check.
    """
    ps = [float(p) for p in probabilities] or [0.5]
    pmax = max(ps)
    near = sum(1 for p in ps if 0.40 < p < 0.65)  # ambiguous cluster
    if pmax < 0.40:
        score = 88.0  # nothing stands out -> confident normal
    else:
        score = 50.0 + (pmax - 0.5) * 130.0  # decisiveness of leading finding
    # a few competing findings is normal; only a large ambiguous cluster hurts,
    # and the penalty is capped so the score still reflects the leading finding
    score -= min(20.0, 3.0 * max(0, near - 3))
    score = max(8, min(97, round(score)))
    return confidence_payload(score, borderline=near)


def severity_from_prob(p: float) -> str:
    """Map a chest pathology probability to a severity band for UI coloring.

    Chest model outputs are all potential abnormalities, so a low-probability
    finding is still 'mild' (never the reassuring 'none' used for normal vision
    observations).
    """
    if p >= 0.70:
        return "severe"
    if p >= 0.40:
        return "moderate"
    return "mild"


CLINICAL_CAP = 25  # max risk points clinical context can add (image stays primary)


def _clinical_modifier(
    probs: dict[str, float], clinical: dict | None
) -> tuple[int, list[str]]:
    """Fuse clinical data with imaging findings → extra risk points + reasons.

    Deterministic and explainable: each rule states why it fired. Imaging
    remains the primary driver (clinical contribution is capped).
    """
    if not clinical:
        return 0, []
    points = 0
    factors: list[str] = []

    temp = float(clinical.get("temperature") or 0)
    spo2 = int(clinical.get("spo2") or 0)
    smoker = bool(clinical.get("smoker"))
    symptoms = (clinical.get("symptoms") or "").lower()

    resp = max(
        probs.get("Pneumonia", 0.0),
        probs.get("Consolidation", 0.0),
        probs.get("Infiltration", 0.0),
        probs.get("Lung Opacity", 0.0),
    )
    nodular = max(
        probs.get("Mass", 0.0),
        probs.get("Nodule", 0.0),
        probs.get("Lung Lesion", 0.0),
    )

    if temp >= 38.0:
        if resp > 0.4:
            points += 8
            factors.append(f"Fever {temp:.1f}°C with pulmonary infiltrate")
        else:
            points += 3
            factors.append(f"Fever {temp:.1f}°C")

    if 0 < spo2 < 92:
        points += 10
        factors.append(f"Hypoxemia (SpO₂ {spo2}%)")
    elif 92 <= spo2 < 95:
        points += 4
        factors.append(f"Borderline SpO₂ {spo2}%")

    if smoker and nodular > 0.3:
        points += 6
        factors.append("Smoking history with nodular/mass finding")
    elif smoker:
        points += 2
        factors.append("Active smoking history")

    for kw, pts, label in (
        ("hemoptysis", 6, "Reported hemoptysis"),
        ("short", 4, "Reported shortness of breath"),
        ("dyspnea", 4, "Reported dyspnea"),
        ("chest pain", 3, "Reported chest pain"),
    ):
        if kw in symptoms and not any(label == f for f in factors):
            points += pts
            factors.append(label)

    return min(points, CLINICAL_CAP), factors[:4]


def risk_score(probs: dict[str, float], clinical: dict | None = None) -> dict:
    contribs = {p: probs[p] * WEIGHTS.get(p, DEFAULT_W) for p in probs}
    driver, raw = max(contribs.items(), key=lambda kv: kv[1])
    cofindings = sum(1 for v in probs.values() if v > 0.5)
    base_score = min(100, round(100 * raw + 5 * max(0, cofindings - 1)))

    clinical_points, clinical_factors = _clinical_modifier(probs, clinical)
    score = min(100, base_score + clinical_points)
    band = "High" if score >= 70 else "Medium" if score >= 40 else "Low"

    top = sorted(probs.items(), key=lambda kv: kv[1], reverse=True)[:5]
    return {
        "score": score,
        "base_score": base_score,
        "clinical_adjustment": clinical_points,
        "clinical_factors": clinical_factors,
        "band": band,
        "driver": driver,
        "top_findings": [
            {
                "pathology": p,
                "probability": round(v, 3),
                "contribution": round(contribs[p], 3),
                "population_rate": round(POPULATION_RATES.get(p, DEFAULT_RATE), 3),
            }
            for p, v in top
        ],
    }

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
    """Plain grayscale 512x512 PNG of the (preprocessed) original for the toggle view."""
    x = _preprocess(path)
    base = x[0, 0].numpy()
    base = (base - base.min()) / (np.ptp(base) + 1e-8)
    Image.fromarray((base * 255).astype(np.uint8)).resize((512, 512)).convert("L").save(
        out_png
    )


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


def risk_score(probs: dict[str, float]) -> dict:
    contribs = {p: probs[p] * WEIGHTS.get(p, DEFAULT_W) for p in probs}
    driver, raw = max(contribs.items(), key=lambda kv: kv[1])
    cofindings = sum(1 for v in probs.values() if v > 0.5)
    score = min(100, round(100 * raw + 5 * max(0, cofindings - 1)))
    band = "High" if score >= 70 else "Medium" if score >= 40 else "Low"
    top = sorted(probs.items(), key=lambda kv: kv[1], reverse=True)[:5]
    return {
        "score": score,
        "band": band,
        "driver": driver,
        "top_findings": [
            {
                "pathology": p,
                "probability": round(v, 3),
                "contribution": round(contribs[p], 3),
            }
            for p, v in top
        ],
    }

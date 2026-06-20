"""In-memory SSE broker + Telegram high-risk notifications."""
from __future__ import annotations

import asyncio
import logging

import requests

from ..config import settings

log = logging.getLogger("radguard.notify")

_subscribers: set[asyncio.Queue] = set()


def subscribe() -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue()
    _subscribers.add(q)
    return q


def unsubscribe(q: asyncio.Queue) -> None:
    _subscribers.discard(q)


async def broadcast(event: dict) -> None:
    for q in list(_subscribers):
        await q.put(event)


def telegram(text: str) -> bool:
    if not settings.TELEGRAM_BOT_TOKEN or not settings.TELEGRAM_CHAT_ID:
        return False
    try:
        requests.post(
            f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage",
            json={"chat_id": settings.TELEGRAM_CHAT_ID, "text": text},
            timeout=5,
        )
        return True
    except Exception as exc:
        log.warning("telegram send failed: %s", exc)
        return False


async def fire_high_risk(study, patient_name: str = "", department: str = "Emergency") -> dict:
    evt = {
        "type": "high_risk",
        "study_id": study.id,
        "patient": patient_name,
        "score": study.risk_score,
        "driver": study.top_finding,
        "department": department,
    }
    await broadcast(evt)
    telegram(
        f"🚨 HIGH RISK ({study.risk_score}) — {patient_name}: "
        f"{study.top_finding}. Routed to {department}."
    )
    return evt

from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from ..services.notify import subscribe, unsubscribe

router = APIRouter(tags=["stream"])


@router.get("/api/stream")
async def stream():
    q = subscribe()

    async def gen():
        # initial comment so the client opens cleanly
        yield ": connected\n\n"
        try:
            while True:
                try:
                    evt = await asyncio.wait_for(q.get(), timeout=15)
                    yield f"data: {json.dumps(evt)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            unsubscribe(q)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

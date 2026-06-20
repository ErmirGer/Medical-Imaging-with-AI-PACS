import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import init_db
from .routers import departments, studies, stream

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("radguard")

app = FastAPI(title="RadGuard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN, "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(studies.router)
app.include_router(departments.router)
app.include_router(stream.router)


@app.on_event("startup")
def _startup() -> None:
    init_db()
    try:
        from .services.seed import seed_if_empty

        counts = seed_if_empty()
        log.info("startup seed: %s", counts)
    except Exception as exc:  # never block startup on seed
        log.warning("seed skipped: %s", exc)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "radguard"}

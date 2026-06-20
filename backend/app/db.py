from pathlib import Path

from sqlmodel import SQLModel, Session, create_engine

from .config import settings

# Resolve sqlite path relative to the backend working dir and ensure the
# storage directory exists before the engine tries to open the file.
_url = settings.DATABASE_URL
if _url.startswith("sqlite:///") and not _url.startswith("sqlite:////"):
    rel = _url.replace("sqlite:///", "", 1)
    Path(rel).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    _url, echo=False, connect_args={"check_same_thread": False}
)


def init_db() -> None:
    # Import models so they register on SQLModel.metadata before create_all.
    from . import models  # noqa: F401

    SQLModel.metadata.create_all(engine)


def get_session() -> Session:
    return Session(engine)

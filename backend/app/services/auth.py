"""Lightweight auth for the hackathon: salted PBKDF2 passwords + bearer tokens.

Not production-grade (single token per account, no rotation/expiry), but real
enough to gate doctor vs patient access without extra dependencies.
"""
from __future__ import annotations

import hashlib
import secrets

from fastapi import Header, HTTPException
from sqlmodel import select

from ..db import get_session
from ..models import Account


def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), 100_000
    ).hex()


def new_salt() -> str:
    return secrets.token_hex(16)


def new_token() -> str:
    return secrets.token_urlsafe(32)


def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    return secrets.compare_digest(hash_password(password, salt), expected_hash)


def _token_from_header(authorization: str | None) -> str:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return ""


def get_account(authorization: str | None = Header(default=None)) -> Account:
    """FastAPI dependency: resolve the bearer token to an Account or 401."""
    token = _token_from_header(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    with get_session() as session:
        acc = session.exec(select(Account).where(Account.token == token)).first()
    if not acc:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return acc


def require_doctor(authorization: str | None = Header(default=None)) -> Account:
    acc = get_account(authorization)
    if acc.role != "doctor":
        raise HTTPException(status_code=403, detail="Doctors only")
    return acc


def can_access_study(study, account: Account) -> bool:
    if account.role == "patient":
        return bool(account.patient_id) and study.patient_id == account.patient_id
    return study.owner_account_id == account.id

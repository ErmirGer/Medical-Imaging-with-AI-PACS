from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlmodel import select

from ..db import get_session
from ..models import Account, Patient
from ..schemas import AccountOut, AuthOut
from ..services import auth

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SignupBody(BaseModel):
    personal_number: str
    password: str
    role: str = "doctor"  # doctor | patient
    name: str = ""
    # patient fields
    patient_id: str | None = None
    age: int | None = None
    sex: str | None = None
    # doctor fields
    department: str | None = None


class LoginBody(BaseModel):
    personal_number: str
    password: str


def _out(acc: Account) -> AuthOut:
    return AuthOut(
        token=acc.token,
        account=AccountOut(
            id=acc.id,
            personal_number=acc.personal_number,
            role=acc.role,
            name=acc.name,
            patient_id=acc.patient_id,
            department=acc.department,
        ),
    )


@router.post("/signup", response_model=AuthOut)
def signup(body: SignupBody):
    pn = body.personal_number.strip()
    if not pn or not body.password:
        raise HTTPException(422, "Personal number and password are required.")
    if len(body.password) < 6:
        raise HTTPException(422, "Password must be at least 6 characters.")
    role = body.role if body.role in {"doctor", "patient"} else "doctor"
    name = body.name.strip() or pn

    with get_session() as session:
        existing = session.exec(
            select(Account).where(Account.personal_number == pn)
        ).first()
        if existing:
            raise HTTPException(409, "An account with this personal number already exists.")

        patient_id = ""
        if role == "patient":
            # link to (or create) the patient record this account represents
            pid = (body.patient_id or "").strip() or f"P-{uuid.uuid4().hex[:6].upper()}"
            patient = session.get(Patient, pid)
            if patient is None:
                patient = Patient(
                    id=pid,
                    name=name,
                    age=body.age if body.age is not None else 0,
                    sex=(body.sex or "U"),
                )
                session.add(patient)
                session.commit()
            patient_id = pid

        salt = auth.new_salt()
        acc = Account(
            personal_number=pn,
            password_hash=auth.hash_password(body.password, salt),
            salt=salt,
            role=role,
            name=name,
            patient_id=patient_id,
            department=(body.department or "Radiology") if role == "doctor" else "",
            token=auth.new_token(),
        )
        session.add(acc)
        session.commit()
        session.refresh(acc)
        return _out(acc)


@router.post("/login", response_model=AuthOut)
def login(body: LoginBody):
    pn = body.personal_number.strip()
    with get_session() as session:
        acc = session.exec(
            select(Account).where(Account.personal_number == pn)
        ).first()
        if acc is None or not auth.verify_password(
            body.password, acc.salt, acc.password_hash
        ):
            raise HTTPException(401, "Invalid personal number or password.")
        acc.token = auth.new_token()  # fresh session token
        session.add(acc)
        session.commit()
        session.refresh(acc)
        return _out(acc)


@router.get("/me", response_model=AccountOut)
def me(authorization: str | None = Header(default=None)):
    acc = auth.get_account(authorization)
    return AccountOut(
        id=acc.id,
        personal_number=acc.personal_number,
        role=acc.role,
        name=acc.name,
        patient_id=acc.patient_id,
        department=acc.department,
    )

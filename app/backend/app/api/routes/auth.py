from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime

from app.api.deps import get_db
from app.core.security import create_access_token, record_activity, verify_password
from app.db import models
from app.schemas import LoginRequest, Token


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    user.last_login_at = datetime.utcnow()
    db.commit()
    record_activity(db, user.id, "login", "User logged in")

    token = create_access_token(subject=user.username, role=user.role.name)
    return Token(access_token=token, role=user.role.name)

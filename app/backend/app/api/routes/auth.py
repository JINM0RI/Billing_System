from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime

from app.api.deps import get_db
<<<<<<< HEAD
from app.core.security import create_access_token, hash_password, record_activity, verify_password
from app.db import models
from app.schemas import AuthStatus, BootstrapRequest, LoginRequest, Token
=======
from app.core.security import create_access_token, record_activity, verify_password
from app.db import models
from app.schemas import LoginRequest, Token
>>>>>>> 4c670f3f5d2d8ea09a7bf11f18be6914d088aac9


router = APIRouter(prefix="/auth", tags=["auth"])


<<<<<<< HEAD
@router.get("/status", response_model=AuthStatus)
def auth_status(db: Session = Depends(get_db)):
    user_count = db.query(models.User).count()
    admin_count = (
        db.query(models.User)
        .join(models.Role)
        .filter(models.Role.name == "Admin")
        .count()
    )
    return AuthStatus(has_users=user_count > 0, has_admin=admin_count > 0)


=======
>>>>>>> 4c670f3f5d2d8ea09a7bf11f18be6914d088aac9
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
<<<<<<< HEAD


@router.post("/bootstrap", response_model=Token, status_code=status.HTTP_201_CREATED)
def bootstrap_admin(payload: BootstrapRequest, db: Session = Depends(get_db)):
    if db.query(models.User).count() > 0:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Admin already initialized")

    admin_role = db.query(models.Role).filter(models.Role.name == "Admin").first()
    if not admin_role:
        admin_role = models.Role(name="Admin", description="Full system access")
        db.add(admin_role)
        db.flush()

    admin = models.User(
        username=payload.username,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role_id=admin_role.id,
        is_active=True,
    )
    db.add(admin)
    db.commit()
    record_activity(db, admin.id, "bootstrap_admin", "Initial admin registered")

    token = create_access_token(subject=admin.username, role=admin_role.name)
    return Token(access_token=token, role=admin_role.name)
=======
>>>>>>> 4c670f3f5d2d8ea09a7bf11f18be6914d088aac9

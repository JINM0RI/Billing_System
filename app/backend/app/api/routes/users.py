from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, get_db, require_roles
from app.core.security import hash_password, record_activity
from app.db import models
from app.schemas import RoleRead, UserCreate, UserRead, UserUpdate


router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("/roles", response_model=list[RoleRead])
def list_roles(db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin", "Manager"))):
    return db.query(models.Role).order_by(models.Role.name.asc()).all()


@router.get("", response_model=list[UserRead])
def list_employees(db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin", "Manager"))):
    users = (
        db.query(models.User)
        .options(joinedload(models.User.role))
        .order_by(models.User.created_at.desc())
        .all()
    )
    return users


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_employee(payload: UserCreate, db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin"))):
    role = db.query(models.Role).filter(models.Role.id == payload.role_id).first()
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    existing = db.query(models.User).filter(models.User.username == payload.username).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")

    user = models.User(
        username=payload.username,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role_id=payload.role_id,
        is_active=payload.is_active,
    )
    db.add(user)
    db.commit()
    user = db.query(models.User).options(joinedload(models.User.role)).filter(models.User.id == user.id).first()
    record_activity(db, current_user.id, "create_employee", f"Created user {user.username}")
    return user


@router.patch("/{user_id}", response_model=UserRead)
def update_employee(user_id: int, payload: UserUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin", "Manager"))):
    user = db.query(models.User).options(joinedload(models.User.role)).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.password is not None:
        user.password_hash = hash_password(payload.password)
    if payload.role_id is not None:
        role = db.query(models.Role).filter(models.Role.id == payload.role_id).first()
        if not role:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
        user.role_id = payload.role_id
    if payload.is_active is not None:
        user.is_active = payload.is_active

    db.commit()
    user = db.query(models.User).options(joinedload(models.User.role)).filter(models.User.id == user.id).first()
    record_activity(db, current_user.id, "update_employee", f"Updated user {user.username}")
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employee(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin"))):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    db.delete(user)
    db.commit()
    record_activity(db, current_user.id, "delete_employee", f"Deleted user {user.username}")
    return None


@router.get("/{user_id}/activity")
def employee_activity(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin", "Manager"))):
    logs = (
        db.query(models.ActivityLog)
        .filter(models.ActivityLog.user_id == user_id)
        .order_by(models.ActivityLog.created_at.desc())
        .all()
    )
    return [
        {"id": log.id, "action": log.action, "details": log.details, "created_at": log.created_at}
        for log in logs
    ]

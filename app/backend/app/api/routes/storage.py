from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.db import models
from app.schemas import StorageLocationCreate, StorageLocationRead


router = APIRouter(prefix="/storage", tags=["storage"])


@router.get("/locations", response_model=list[StorageLocationRead])
def list_locations(db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin", "Manager"))):
    return db.query(models.StorageLocation).order_by(models.StorageLocation.name.asc()).all()


@router.post("/locations", response_model=StorageLocationRead, status_code=status.HTTP_201_CREATED)
def create_location(payload: StorageLocationCreate, db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin", "Manager"))):
    existing = db.query(models.StorageLocation).filter(models.StorageLocation.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Storage location already exists")

    location = models.StorageLocation(**payload.model_dump())
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


@router.patch("/locations/{location_id}", response_model=StorageLocationRead)
def update_location(location_id: int, payload: StorageLocationCreate, db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin", "Manager"))):
    location = db.query(models.StorageLocation).filter(models.StorageLocation.id == location_id).first()
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storage location not found")

    for field, value in payload.model_dump().items():
        setattr(location, field, value)
    db.commit()
    db.refresh(location)
    return location


@router.delete("/locations/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_location(location_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin"))):
    location = db.query(models.StorageLocation).filter(models.StorageLocation.id == location_id).first()
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storage location not found")

    db.delete(location)
    db.commit()
    return None


@router.get("/overview")
def storage_overview(db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin", "Manager", "Employee"))):
    locations = db.query(models.StorageLocation).all()
    summary = []
    for location in locations:
        inventory_count = sum(item.quantity_on_hand for item in location.inventory_items)
        summary.append(
            {
                "id": location.id,
                "name": location.name,
                "location_type": location.location_type,
                "capacity": location.capacity,
                "utilization": location.utilization,
                "inventory_count": inventory_count,
                "is_active": location.is_active,
            }
        )
    return summary

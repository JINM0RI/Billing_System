from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_
from sqlalchemy.orm import Session, joinedload
import re

from app.api.deps import get_db, require_roles
from app.db import models
from app.schemas import PurchaseCodePreview, PurchaseCreate, PurchaseRead


router = APIRouter(prefix="/purchases", tags=["purchases"])


_MEASURE_TYPES = {"kg", "liter", "pieces"}


def _normalize_code(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "", value.lower())
    return cleaned


def _generate_sku(db: Session, name: str, category: str, measuring_type: str) -> str:
    base = f"{_normalize_code(category)[:3]}{_normalize_code(name)[:3]}{_normalize_code(measuring_type)[:2]}".upper()
    base = base or "PRD"
    candidate = base
    counter = 1
    while db.query(models.Product).filter(models.Product.sku == candidate).first():
        candidate = f"{base}-{counter:03d}"
        counter += 1
    return candidate


def _get_or_create_location(db: Session) -> models.StorageLocation:
    location = (
        db.query(models.StorageLocation)
        .filter(models.StorageLocation.is_active.is_(True))
        .order_by(models.StorageLocation.id.asc())
        .first()
    )
    if not location:
        location = models.StorageLocation(name="Main Warehouse", location_type="warehouse", capacity=0, utilization=0, is_active=True)
        db.add(location)
        db.flush()
    return location


def _find_product(db: Session, name: str, category: str, measuring_type: str) -> models.Product | None:
    return (
        db.query(models.Product)
        .filter(
            and_(
                models.Product.name == name,
                models.Product.category == category,
                models.Product.measuring_type == measuring_type,
            )
        )
        .first()
    )


@router.get("", response_model=list[PurchaseRead])
def list_purchases(db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin", "Manager", "Employee"))):
    purchases = (
        db.query(models.PurchaseRecord)
        .options(joinedload(models.PurchaseRecord.product))
        .order_by(models.PurchaseRecord.created_at.desc())
        .all()
    )
    return [_to_purchase_read(item) for item in purchases]


@router.get("/code", response_model=PurchaseCodePreview)
def preview_code(
    name: str = Query(min_length=1),
    category: str = Query(min_length=1),
    measuring_type: str = Query(min_length=2),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("Admin", "Manager", "Employee")),
):
    normalized_measure = measuring_type.lower().strip()
    if normalized_measure not in _MEASURE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid measuring type")

    product = _find_product(db, name.strip(), category.strip(), normalized_measure)
    if product:
        return PurchaseCodePreview(code=product.sku, exists=True)

    code = _generate_sku(db, name.strip(), category.strip(), normalized_measure)
    return PurchaseCodePreview(code=code, exists=False)


@router.post("", response_model=PurchaseRead, status_code=status.HTTP_201_CREATED)
def create_purchase(payload: PurchaseCreate, db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin", "Manager"))):
    name = payload.product_name.strip()
    category = payload.category.strip()
    measuring_type = payload.measuring_type.lower().strip()

    if measuring_type not in _MEASURE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid measuring type")

    product = _find_product(db, name, category, measuring_type)
    if not product:
        code = _generate_sku(db, name, category, measuring_type)
        product = models.Product(
            sku=code,
            name=name,
            category=category,
            measuring_type=measuring_type,
            description=None,
            unit_price=payload.purchase_price,
            tax_rate=0.0,
            low_stock_threshold=10,
            is_active=True,
        )
        db.add(product)
        db.flush()

    location = _get_or_create_location(db)
    inventory = (
        db.query(models.Inventory)
        .filter(
            models.Inventory.product_id == product.id,
            models.Inventory.storage_location_id == location.id,
        )
        .first()
    )
    if inventory:
        inventory.quantity_on_hand += payload.count
        inventory.updated_at = datetime.utcnow()
    else:
        db.add(
            models.Inventory(
                product_id=product.id,
                storage_location_id=location.id,
                quantity_on_hand=payload.count,
                reorder_level=product.low_stock_threshold,
            )
        )

    purchase = models.PurchaseRecord(
        product_id=product.id,
        purchased_from=payload.purchased_from,
        purchase_price=payload.purchase_price,
        count=payload.count,
    )
    db.add(purchase)
    db.commit()
    db.refresh(purchase)
    db.refresh(purchase, attribute_names=["product"])
    return _to_purchase_read(purchase)


def _to_purchase_read(record: models.PurchaseRecord) -> PurchaseRead:
    product = record.product
    return PurchaseRead(
        id=record.id,
        code=product.sku,
        product_name=product.name,
        category=product.category,
        measuring_type=product.measuring_type,
        purchased_from=record.purchased_from,
        purchase_price=record.purchase_price,
        count=record.count,
        created_at=record.created_at,
    )

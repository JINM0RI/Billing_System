from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db, require_roles
from app.db import models
from app.schemas import ProductCreate, ProductRead, ProductUpdate, StorageLocationCreate


router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductRead])
def list_products(db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin", "Manager", "Employee"))):
    products = db.query(models.Product).options(joinedload(models.Product.inventory_records).joinedload(models.Inventory.storage_location)).order_by(models.Product.name.asc()).all()
    result: list[ProductRead] = []
    for product in products:
        current_stock = sum(record.quantity_on_hand for record in product.inventory_records)
        storage_location = product.inventory_records[0].storage_location.name if product.inventory_records else None
        result.append(
            ProductRead(
                id=product.id,
                sku=product.sku,
                name=product.name,
                description=product.description,
                category=product.category,
                unit_price=product.unit_price,
                tax_rate=product.tax_rate,
                low_stock_threshold=product.low_stock_threshold,
                is_active=product.is_active,
                created_at=product.created_at,
                current_stock=current_stock,
                storage_location=storage_location,
            )
        )
    return result


@router.get("/low-stock")
def low_stock_products(db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin", "Manager"))):
    products = db.query(models.Product).options(joinedload(models.Product.inventory_records)).all()
    low_stock = []
    for product in products:
        stock = sum(record.quantity_on_hand for record in product.inventory_records)
        if stock <= product.low_stock_threshold:
            low_stock.append({"id": product.id, "name": product.name, "stock": stock, "threshold": product.low_stock_threshold})
    return low_stock


@router.post("", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin", "Manager"))):
    existing = db.query(models.Product).filter((models.Product.sku == payload.sku) | (models.Product.name == payload.name)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product sku or name already exists")

    product = models.Product(
        sku=payload.sku,
        name=payload.name,
        description=payload.description,
        category=payload.category,
        unit_price=payload.unit_price,
        tax_rate=payload.tax_rate,
        low_stock_threshold=payload.low_stock_threshold,
        is_active=payload.is_active,
    )
    db.add(product)
    db.flush()

    storage_location = None
    if payload.storage_location_id is not None:
        storage_location = db.query(models.StorageLocation).filter(models.StorageLocation.id == payload.storage_location_id).first()
    if storage_location is None:
        storage_location = db.query(models.StorageLocation).filter(models.StorageLocation.is_active.is_(True)).order_by(models.StorageLocation.id.asc()).first()
    if storage_location is None:
        storage_location = models.StorageLocation(name="Main Warehouse", location_type="warehouse", capacity=0, utilization=0, is_active=True)
        db.add(storage_location)
        db.flush()

    db.add(models.Inventory(product_id=product.id, storage_location_id=storage_location.id, quantity_on_hand=payload.initial_stock, reorder_level=payload.low_stock_threshold))
    db.commit()
    db.refresh(product)
    return _to_product_read(db, product)


@router.patch("/{product_id}", response_model=ProductRead)
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin", "Manager"))):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return _to_product_read(db, product)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin", "Manager"))):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    db.delete(product)
    db.commit()
    return None


def _to_product_read(db: Session, product: models.Product) -> ProductRead:
    stock = db.query(models.Inventory).filter(models.Inventory.product_id == product.id).all()
    current_stock = sum(item.quantity_on_hand for item in stock)
    storage_location = stock[0].storage_location.name if stock else None
    return ProductRead(
        id=product.id,
        sku=product.sku,
        name=product.name,
        description=product.description,
        category=product.category,
        unit_price=product.unit_price,
        tax_rate=product.tax_rate,
        low_stock_threshold=product.low_stock_threshold,
        is_active=product.is_active,
        created_at=product.created_at,
        current_stock=current_stock,
        storage_location=storage_location,
    )

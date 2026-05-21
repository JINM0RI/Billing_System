from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db, require_roles
from app.db import models
from app.schemas import FifoCostPreview, ProductCreate, ProductRead, ProductUpdate, PurchaseBatchRead
from app.services.fifo import compute_fifo_costs, preview_fifo_cost


router = APIRouter(prefix="/products", tags=["products"])
_CODE_START = 100000


def _next_numeric_code(db: Session) -> str:
    codes = [row[0] for row in db.query(models.Product.sku).all()]
    numeric_codes = [int(code) for code in codes if code and str(code).isdigit()]
    max_code = max(numeric_codes) if numeric_codes else _CODE_START
    candidate = max_code + 1
    while db.query(models.Product).filter(models.Product.sku == str(candidate)).first():
        candidate += 1
    return str(candidate)


@router.get("", response_model=list[ProductRead])
def list_products(db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin", "Manager", "Employee"))):
    products = (
        db.query(models.Product)
        .options(
            joinedload(models.Product.inventory_records).joinedload(models.Inventory.storage_location),
            joinedload(models.Product.purchase_batches),
        )
        .order_by(models.Product.name.asc())
        .all()
    )
    result: list[ProductRead] = []
    for product in products:
        current_stock = sum(batch.remaining_qty for batch in product.purchase_batches)
        fifo_min, fifo_max, fifo_avg = compute_fifo_costs(product.purchase_batches)
        storage_location = product.inventory_records[0].storage_location.name if product.inventory_records else None
        result.append(
            ProductRead(
                id=product.id,
                sku=product.sku,
                name=product.name,
                description=product.description,
                category=product.category,
                measuring_type=product.measuring_type,
                price_unit_count=product.price_unit_count,
                unit_price=product.unit_price,
                tax_rate=product.tax_rate,
                low_stock_threshold=product.low_stock_threshold,
                is_active=product.is_active,
                created_at=product.created_at,
                current_stock=current_stock,
                fifo_min_cost=fifo_min,
                fifo_max_cost=fifo_max,
                fifo_avg_cost=fifo_avg,
                storage_location=storage_location,
            )
        )
    return result


@router.get("/low-stock")
def low_stock_products(db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin", "Manager"))):
    products = db.query(models.Product).options(joinedload(models.Product.purchase_batches)).all()
    low_stock = []
    for product in products:
        stock = sum(batch.remaining_qty for batch in product.purchase_batches)
        if stock <= product.low_stock_threshold:
            low_stock.append({"id": product.id, "name": product.name, "stock": stock, "threshold": product.low_stock_threshold})
    return low_stock


@router.get("/code/{sku}", response_model=ProductRead)
def get_product_by_code(sku: str, db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin", "Manager", "Employee"))):
    product = (
        db.query(models.Product)
        .options(
            joinedload(models.Product.inventory_records).joinedload(models.Inventory.storage_location),
            joinedload(models.Product.purchase_batches),
        )
        .filter(models.Product.sku == sku)
        .first()
    )
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return _to_product_read(db, product)


@router.get("/{product_id}/batches", response_model=list[PurchaseBatchRead])
def list_product_batches(product_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin", "Manager", "Employee"))):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    batches = (
        db.query(models.PurchaseBatch)
        .filter(models.PurchaseBatch.product_id == product_id)
        .order_by(models.PurchaseBatch.created_at.asc(), models.PurchaseBatch.id.asc())
        .all()
    )
    return [
        PurchaseBatchRead(
            batch_id=batch.id,
            product_id=batch.product_id,
            original_quantity=batch.quantity,
            remaining_quantity=batch.remaining_qty,
            unit_cost=batch.unit_cost,
            created_at=batch.created_at,
        )
        for batch in batches
    ]


@router.get("/{product_id}/fifo-cost", response_model=FifoCostPreview)
def preview_product_fifo_cost(
    product_id: int,
    quantity: int = Query(ge=1),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("Admin", "Manager", "Employee")),
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    batches = (
        db.query(models.PurchaseBatch)
        .filter(models.PurchaseBatch.product_id == product_id)
        .order_by(models.PurchaseBatch.created_at.asc(), models.PurchaseBatch.id.asc())
        .all()
    )

    try:
        total_cost, available = preview_fifo_cost(batches, quantity)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient stock for FIFO cost preview")

    return FifoCostPreview(product_id=product_id, quantity=quantity, fifo_cost=total_cost, available_stock=available)


@router.post("", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin", "Manager"))):
    existing = (
        db.query(models.Product)
        .filter(
            (models.Product.sku == (payload.sku or ""))
            | (
                (models.Product.name == payload.name)
                & (models.Product.category == payload.category)
                & (models.Product.measuring_type == payload.measuring_type)
            )
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product sku or name/category/measure already exists")

    code = payload.sku or _next_numeric_code(db)

    product = models.Product(
        sku=code,
        name=payload.name,
        description=payload.description,
        category=payload.category,
        measuring_type=payload.measuring_type,
        price_unit_count=payload.price_unit_count,
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
    batches = db.query(models.PurchaseBatch).filter(models.PurchaseBatch.product_id == product.id).all()
    current_stock = sum(batch.remaining_qty for batch in batches)
    fifo_min, fifo_max, fifo_avg = compute_fifo_costs(batches)
    stock = db.query(models.Inventory).filter(models.Inventory.product_id == product.id).all()
    storage_location = stock[0].storage_location.name if stock else None
    return ProductRead(
        id=product.id,
        sku=product.sku,
        name=product.name,
        description=product.description,
        category=product.category,
        measuring_type=product.measuring_type,
        price_unit_count=product.price_unit_count,
        unit_price=product.unit_price,
        tax_rate=product.tax_rate,
        low_stock_threshold=product.low_stock_threshold,
        is_active=product.is_active,
        created_at=product.created_at,
        current_stock=current_stock,
        fifo_min_cost=fifo_min,
        fifo_max_cost=fifo_max,
        fifo_avg_cost=fifo_avg,
        storage_location=storage_location,
    )

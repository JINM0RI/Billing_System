from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.db import models
from app.schemas import DashboardSummary


router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/summary", response_model=DashboardSummary)
def dashboard_summary(db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin", "Manager", "Employee"))):
    total_revenue = db.query(func.coalesce(func.sum(models.Invoice.total_amount), 0.0)).scalar() or 0.0
    invoice_count = db.query(func.count(models.Invoice.id)).scalar() or 0
    active_products = db.query(func.count(models.Product.id)).filter(models.Product.is_active.is_(True)).scalar() or 0
    total_employees = db.query(func.count(models.User.id)).scalar() or 0
    low_stock_count = 0
    for product in db.query(models.Product).all():
        stock = sum(record.quantity_on_hand for record in product.inventory_records)
        if stock <= product.low_stock_threshold:
            low_stock_count += 1

    return DashboardSummary(
        total_revenue=round(float(total_revenue), 2),
        invoice_count=invoice_count,
        low_stock_count=low_stock_count,
        active_products=active_products,
        total_employees=total_employees,
    )

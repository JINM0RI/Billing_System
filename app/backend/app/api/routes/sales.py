from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.db import models


router = APIRouter(prefix="/sales", tags=["sales"])


@router.get("/transactions")
def transactions(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    employee_id: int | None = Query(default=None),
    product_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("Admin", "Manager")),
):
    query = db.query(models.Invoice).order_by(models.Invoice.created_at.desc())
    if start_date:
        query = query.filter(models.Invoice.created_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.filter(models.Invoice.created_at <= datetime.combine(end_date, datetime.max.time()))
    if employee_id:
        query = query.filter(models.Invoice.employee_id == employee_id)
    if product_id:
        query = query.join(models.Invoice.items).filter(models.InvoiceItem.product_id == product_id)

    invoices = query.all()
    return [
        {
            "id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "customer_name": invoice.customer_name,
            "employee_id": invoice.employee_id,
            "total_amount": invoice.total_amount,
            "payment_status": invoice.payment_status,
            "created_at": invoice.created_at,
        }
        for invoice in invoices
    ]


@router.get("/reports")
def reports(range: str = Query(default="daily"), db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin", "Manager"))):
    today = datetime.utcnow().date()
    if range == "monthly":
        start = datetime(today.year, today.month, 1)
    else:
        start = datetime.combine(today, datetime.min.time())

    revenue = db.query(func.coalesce(func.sum(models.Invoice.total_amount), 0.0)).filter(models.Invoice.created_at >= start).scalar() or 0.0
    invoices = db.query(func.count(models.Invoice.id)).filter(models.Invoice.created_at >= start).scalar() or 0
    return {"range": range, "revenue": round(float(revenue), 2), "invoice_count": invoices}

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db, require_roles
from app.db import models
from app.schemas import InvoiceCreate, InvoiceRead


router = APIRouter(prefix="/invoices", tags=["billing"])


@router.post("", response_model=InvoiceRead, status_code=status.HTTP_201_CREATED)
def create_invoice(payload: InvoiceCreate, db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin", "Manager", "Employee"))):
    employee = db.query(models.User).filter(models.User.id == payload.employee_id).first()
    if not employee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    invoice_number = f"INV-{datetime.utcnow():%Y%m%d-%H%M%S}"
    invoice = models.Invoice(invoice_number=invoice_number, customer_name=payload.customer_name, employee_id=employee.id)
    db.add(invoice)
    db.flush()

    subtotal = 0.0
    tax_total = 0.0

    for item in payload.items:
        product = db.query(models.Product).options(joinedload(models.Product.inventory_records)).filter(models.Product.id == item.product_id).first()
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product {item.product_id} not found")

        inventory_record = _select_inventory_record(product.inventory_records)
        if not inventory_record or inventory_record.quantity_on_hand < item.quantity:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Insufficient stock for {product.name}")

        inventory_record.quantity_on_hand -= item.quantity
        line_subtotal = product.unit_price * item.quantity
        tax_rate = payload.tax_rate_override if payload.tax_rate_override is not None else product.tax_rate
        line_tax = line_subtotal * tax_rate
        line_total = line_subtotal + line_tax
        subtotal += line_subtotal
        tax_total += line_tax

        db.add(
            models.InvoiceItem(
                invoice_id=invoice.id,
                product_id=product.id,
                description=product.description,
                quantity=item.quantity,
                unit_price=product.unit_price,
                tax_rate=tax_rate,
                line_total=line_total,
            )
        )

    total_amount = subtotal - payload.discount_amount + tax_total
    invoice.subtotal = subtotal
    invoice.discount_amount = payload.discount_amount
    invoice.tax_amount = tax_total
    invoice.total_amount = total_amount
    invoice.payment_status = "paid"

    db.add(
        models.Payment(
            invoice_id=invoice.id,
            method=payload.payment_method,
            amount=total_amount,
            reference=payload.payment_reference,
        )
    )
    db.commit()
    db.refresh(invoice)
    return _load_invoice(db, invoice.id)


@router.get("", response_model=list[InvoiceRead])
def list_invoices(db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin", "Manager", "Employee"))):
    invoices = db.query(models.Invoice).order_by(models.Invoice.created_at.desc()).all()
    return [_load_invoice(db, invoice.id) for invoice in invoices]


@router.get("/{invoice_id}", response_model=InvoiceRead)
def get_invoice(invoice_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin", "Manager", "Employee"))):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    return _load_invoice(db, invoice.id)


def _select_inventory_record(records: list[models.Inventory]) -> models.Inventory | None:
    available_records = sorted(records, key=lambda record: record.quantity_on_hand, reverse=True)
    return available_records[0] if available_records else None


def _load_invoice(db: Session, invoice_id: int) -> InvoiceRead:
    invoice = (
        db.query(models.Invoice)
        .options(joinedload(models.Invoice.items), joinedload(models.Invoice.payments))
        .filter(models.Invoice.id == invoice_id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    return InvoiceRead.model_validate(invoice)

from __future__ import annotations

from sqlalchemy.orm import Session

from app.db import models


def round_to_2(value: float) -> float:
    return round(value * 100) / 100


def consume_fifo(db: Session, product_id: int, quantity: int) -> float:
    if quantity <= 0:
        return 0.0

    batches = (
        db.query(models.PurchaseBatch)
        .filter(models.PurchaseBatch.product_id == product_id, models.PurchaseBatch.remaining_qty > 0)
        .order_by(models.PurchaseBatch.created_at.asc(), models.PurchaseBatch.id.asc())
        .with_for_update()
        .all()
    )

    remaining = quantity
    total_cost = 0.0

    for batch in batches:
        if remaining <= 0:
            break
        used = min(batch.remaining_qty, remaining)
        total_cost += used * batch.unit_cost
        batch.remaining_qty -= used
        remaining -= used

    if remaining > 0:
        raise ValueError("Insufficient stock")

    return round_to_2(total_cost)


def compute_fifo_costs(batches: list[models.PurchaseBatch]) -> tuple[float, float, float]:
    available = [batch for batch in batches if batch.remaining_qty > 0]
    if not available:
        return 0.0, 0.0, 0.0

    min_cost = min(batch.unit_cost for batch in available)
    max_cost = max(batch.unit_cost for batch in available)
    total_qty = sum(batch.remaining_qty for batch in available)
    total_cost = sum(batch.remaining_qty * batch.unit_cost for batch in available)
    avg_cost = total_cost / total_qty if total_qty else 0.0
    return round_to_2(min_cost), round_to_2(max_cost), round_to_2(avg_cost)


def preview_fifo_cost(batches: list[models.PurchaseBatch], quantity: int) -> tuple[float, int]:
    if quantity <= 0:
        return 0.0, 0

    remaining = quantity
    total_cost = 0.0
    available_stock = sum(batch.remaining_qty for batch in batches)

    for batch in sorted(batches, key=lambda entry: (entry.created_at, entry.id)):
        if remaining <= 0:
            break
        if batch.remaining_qty <= 0:
            continue
        used = min(batch.remaining_qty, remaining)
        total_cost += used * batch.unit_cost
        remaining -= used

    if remaining > 0:
        raise ValueError("Insufficient stock")

    return round_to_2(total_cost), available_stock

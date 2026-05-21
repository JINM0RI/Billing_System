from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.db import models


router = APIRouter(tags=["categories"])


@router.get("/categories", response_model=list[str])
def list_categories(db: Session = Depends(get_db), current_user: models.User = Depends(require_roles("Admin", "Manager", "Employee"))):
    categories = db.query(models.Product.category).distinct().order_by(models.Product.category.asc()).all()
    return [row[0] for row in categories if row[0]]

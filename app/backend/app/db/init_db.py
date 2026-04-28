from pathlib import Path

from app.core.config import settings
from app.core.security import hash_password
from app.db.models import Base, Role, TaxSetting, User
from app.db.session import engine, SessionLocal


def ensure_database_path() -> None:
    db_path = Path(settings.database_url.replace("sqlite:///", ""))
    db_path.parent.mkdir(parents=True, exist_ok=True)


def seed_reference_data() -> None:
    db = SessionLocal()
    try:
        roles = [
            ("Admin", "Full system access"),
            ("Manager", "Operational management access"),
            ("Employee", "Daily billing and inventory access"),
        ]
        for name, description in roles:
            if not db.query(Role).filter(Role.name == name).first():
                db.add(Role(name=name, description=description))

        if not db.query(TaxSetting).first():
            db.add(TaxSetting(name="Default Tax", rate=settings.tax_rate, is_default=True))

        admin_role = db.query(Role).filter(Role.name == "Admin").first()
        if admin_role and not db.query(User).filter(User.username == "admin").first():
            db.add(
                User(
                    username="admin",
                    full_name="System Admin",
                    password_hash=hash_password("Admin@12345!"),
                    role_id=admin_role.id,
                    is_active=True,
                )
            )

        db.commit()
    finally:
        db.close()


def init_db() -> None:
    ensure_database_path()
    Base.metadata.create_all(bind=engine)
    seed_reference_data()

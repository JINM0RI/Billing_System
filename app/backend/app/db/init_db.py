from pathlib import Path

from sqlalchemy import text

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


def normalize_user_names() -> None:
    with engine.begin() as connection:
        connection.execute(text("UPDATE users SET full_name = username WHERE full_name IS NULL OR full_name = ''"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ux_users_full_name ON users(full_name)"))


def ensure_product_measuring_type() -> None:
    with engine.begin() as connection:
        columns = [row[1] for row in connection.execute(text("PRAGMA table_info(products)"))]
        if "measuring_type" not in columns:
            connection.execute(text("ALTER TABLE products ADD COLUMN measuring_type TEXT DEFAULT 'pieces'"))
            connection.execute(text("UPDATE products SET measuring_type = 'pieces' WHERE measuring_type IS NULL"))


def ensure_purchases_schema() -> None:
    with engine.begin() as connection:
        columns = [row[1] for row in connection.execute(text("PRAGMA table_info(purchases)"))]
        if not columns or "sale_price" not in columns:
            return

        connection.execute(
            text(
                """
                CREATE TABLE purchases_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    product_id INTEGER NOT NULL,
                    purchased_from TEXT NOT NULL,
                    purchase_price FLOAT NOT NULL,
                    count INTEGER NOT NULL,
                    created_at DATETIME NOT NULL,
                    FOREIGN KEY(product_id) REFERENCES products(id)
                )
                """
            )
        )
        connection.execute(
            text(
                """
                INSERT INTO purchases_new (id, product_id, purchased_from, purchase_price, count, created_at)
                SELECT id, product_id, purchased_from, purchase_price, count, created_at
                FROM purchases
                """
            )
        )
        connection.execute(text("DROP TABLE purchases"))
        connection.execute(text("ALTER TABLE purchases_new RENAME TO purchases"))


def init_db() -> None:
    ensure_database_path()
    Base.metadata.create_all(bind=engine)
    seed_reference_data()
    normalize_user_names()
    ensure_product_measuring_type()
    ensure_purchases_schema()

from pathlib import Path

from sqlalchemy import text

from app.core.config import settings
from app.core.security import hash_password
from app.db.models import Base, Invoice, InvoiceItem, Product, PurchaseBatch, PurchaseRecord, Role, TaxSetting, User
from app.db.session import engine, SessionLocal
from app.services.fifo import consume_fifo, round_to_2


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


def ensure_product_price_unit_count() -> None:
    with engine.begin() as connection:
        columns = [row[1] for row in connection.execute(text("PRAGMA table_info(products)"))]
        if "price_unit_count" not in columns:
            connection.execute(text("ALTER TABLE products ADD COLUMN price_unit_count INTEGER DEFAULT 1"))
            connection.execute(text("UPDATE products SET price_unit_count = 1 WHERE price_unit_count IS NULL"))


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


def ensure_invoice_costs() -> None:
    with engine.begin() as connection:
        invoice_columns = [row[1] for row in connection.execute(text("PRAGMA table_info(invoices)"))]
        if "cost_price" not in invoice_columns:
            connection.execute(text("ALTER TABLE invoices ADD COLUMN cost_price FLOAT"))
        if "profit" not in invoice_columns:
            connection.execute(text("ALTER TABLE invoices ADD COLUMN profit FLOAT"))

        item_columns = [row[1] for row in connection.execute(text("PRAGMA table_info(invoice_items)"))]
        if "cost_price" not in item_columns:
            connection.execute(text("ALTER TABLE invoice_items ADD COLUMN cost_price FLOAT"))
        if "profit" not in item_columns:
            connection.execute(text("ALTER TABLE invoice_items ADD COLUMN profit FLOAT"))

        if "product_code" not in item_columns:
            connection.execute(text("ALTER TABLE invoice_items ADD COLUMN product_code TEXT"))


def ensure_numeric_product_codes() -> None:
    db = SessionLocal()
    try:
        products = db.query(Product).order_by(Product.id.asc()).all()
        existing_codes = {product.sku for product in products if product.sku and product.sku.isdigit()}
        next_code = max((int(code) for code in existing_codes), default=100000)

        updated = False
        for product in products:
            if not product.sku or not product.sku.isdigit():
                next_code += 1
                while str(next_code) in existing_codes:
                    next_code += 1
                product.sku = str(next_code)
                existing_codes.add(product.sku)
                updated = True

        if updated:
            db.commit()
    finally:
        db.close()


def seed_purchase_batches() -> None:
    db = SessionLocal()
    try:
        has_batches = db.query(PurchaseBatch).first()
        if has_batches:
            return

        purchases = db.query(PurchaseRecord).order_by(PurchaseRecord.created_at.asc()).all()
        if not purchases:
            return

        for record in purchases:
            unit_cost = round_to_2(record.purchase_price / record.count) if record.count else 0.0
            db.add(
                PurchaseBatch(
                    product_id=record.product_id,
                    quantity=record.count,
                    remaining_qty=record.count,
                    unit_cost=unit_cost,
                    created_at=record.created_at,
                )
            )

        db.flush()

        invoice_items = (
            db.query(InvoiceItem, Invoice.created_at)
            .join(Invoice, InvoiceItem.invoice_id == Invoice.id)
            .order_by(Invoice.created_at.asc(), InvoiceItem.id.asc())
            .all()
        )

        for item, _ in invoice_items:
            try:
                consume_fifo(db, item.product_id, item.quantity)
            except ValueError:
                continue

        db.commit()
    finally:
        db.close()


def init_db() -> None:
    ensure_database_path()
    Base.metadata.create_all(bind=engine)
    seed_reference_data()
    normalize_user_names()
    ensure_product_measuring_type()
    ensure_product_price_unit_count()
    ensure_purchases_schema()
    ensure_invoice_costs()
    ensure_numeric_product_codes()
    seed_purchase_batches()

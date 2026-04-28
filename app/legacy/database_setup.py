import sqlite3
import os

# Database filenames
PRODUCTS_DB = "products.db"
ADMIN_PURCHASES_DB = "admin_purchases.db"

def create_products_db():
    """Creates the products database."""
    if not os.path.exists(PRODUCTS_DB):
        print(f"🔹 Creating database: {PRODUCTS_DB}")

    conn = sqlite3.connect(PRODUCTS_DB)
    cursor = conn.cursor()

    #  Create Products Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS products (
            product_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            price REAL NOT NULL,
            stock INTEGER NOT NULL,
            category TEXT NOT NULL
        )
    ''')

    conn.commit()
    conn.close()
    print(" Products database created!")

def create_admin_purchases_db():
    """Creates the admin purchases database."""
    if not os.path.exists(ADMIN_PURCHASES_DB):
        print(f"🔹 Creating database: {ADMIN_PURCHASES_DB}")

    conn = sqlite3.connect(ADMIN_PURCHASES_DB)
    cursor = conn.cursor()

    # Create Admin Purchases Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS admin_purchases (
            purchase_id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            purchase_price REAL NOT NULL,
            sellable_price REAL NOT NULL,
            quantity_bought INTEGER NOT NULL,
            total_value REAL NOT NULL,
            purchase_place TEXT NOT NULL
        )
    ''')

    conn.commit()
    conn.close()
    print(" Admin Purchases database created!")

def sync_purchases_to_products():
    """Syncs the latest purchases from `admin_purchases.db` to `products.db`."""
    # Connect to both databases
    conn_admin = sqlite3.connect(ADMIN_PURCHASES_DB)
    cursor_admin = conn_admin.cursor()

    conn_products = sqlite3.connect(PRODUCTS_DB)
    cursor_products = conn_products.cursor()

    # Fetch all purchases from admin_purchases
    cursor_admin.execute("SELECT product_id, name, sellable_price, quantity_bought FROM admin_purchases")
    purchases = cursor_admin.fetchall()

    for product_id, name, price, stock in purchases:
    # Check if the product exists in products.db
        cursor_products.execute("SELECT product_id FROM products WHERE name = ?", (name,))
        existing_product = cursor_products.fetchone()

    if existing_product:
        # Use product_id in the update query
        cursor_products.execute('''
            UPDATE products
            SET price = ?, stock = stock + ?
            WHERE product_id = ?
        ''', (price, stock, existing_product[0]))  # Use fetched product_id

        print(f"🔄 Updated: {name} | New Price: {price} | Added Stock: {stock}")

    else:
        # Insert new product if not found
        cursor_products.execute('''
            INSERT INTO products (name, price, stock, category)
            VALUES (?, ?, ?, ?)
        ''', (name, price, stock, "Uncategorized"))

        print(f"➕ Added: {name} | Price: {price} | Stock: {stock}")


    # Commit changes and close connections
    conn_products.commit()
    conn_admin.close()
    conn_products.close()
    print(" Syncing complete!")

if __name__ == "__main__":
    create_products_db()
    create_admin_purchases_db()
    sync_purchases_to_products()  # Call sync function

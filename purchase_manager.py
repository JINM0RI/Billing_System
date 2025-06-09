import sqlite3
from PyQt5.QtWidgets import QWidget, QVBoxLayout, QLabel, QLineEdit, QPushButton, QMessageBox

class PurchaseManager(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Admin - Purchase Management")
        self.setGeometry(200, 200, 400, 400)
        
        layout = QVBoxLayout()

        # Fields
        self.supplier_input = QLineEdit(self)
        self.supplier_input.setPlaceholderText("Supplier Name")
        layout.addWidget(QLabel("Supplier Name:"))
        layout.addWidget(self.supplier_input)

        self.product_input = QLineEdit(self)
        self.product_input.setPlaceholderText("Product Name")
        layout.addWidget(QLabel("Product Name:"))
        layout.addWidget(self.product_input)

        self.purchase_price_input = QLineEdit(self)
        self.purchase_price_input.setPlaceholderText("Purchase Price")
        layout.addWidget(QLabel("Purchase Price:"))
        layout.addWidget(self.purchase_price_input)

        self.quantity_input = QLineEdit(self)
        self.quantity_input.setPlaceholderText("Quantity Bought")
        layout.addWidget(QLabel("Quantity Bought:"))
        layout.addWidget(self.quantity_input)

        self.selling_price_input = QLineEdit(self)
        self.selling_price_input.setPlaceholderText("Selling Price")
        layout.addWidget(QLabel("Selling Price:"))
        layout.addWidget(self.selling_price_input)

        self.category_input = QLineEdit(self)
        self.category_input.setPlaceholderText("Product Category")
        layout.addWidget(QLabel("Product Category:"))
        layout.addWidget(self.category_input)


        self.add_button = QPushButton("Add Purchase", self)
        self.add_button.clicked.connect(self.add_purchase)
        layout.addWidget(self.add_button)

        self.setLayout(layout)

    def add_purchase(self):
        """Adds a new purchase to the admin_purchases table and updates the products table."""
        supplier = self.supplier_input.text().strip()
        product_name = self.product_input.text().strip()
        category = self.category_input.text().strip()  # Get category input

        try:
            purchase_price = float(self.purchase_price_input.text().strip())
            quantity = int(self.quantity_input.text().strip())
            selling_price = float(self.selling_price_input.text().strip())
        except ValueError:
            QMessageBox.warning(self, "Error", "Please enter valid numeric values for price and quantity!")
            return

        if not supplier or not product_name or not category:
            QMessageBox.warning(self, "Error", "All fields, including Category, are required!")
            return

        total_value = purchase_price * quantity

        #  Connect to `admin_purchases` database
        conn_purchases = sqlite3.connect("admin_purchases.db")
        cursor_purchases = conn_purchases.cursor()

        #  Check if product exists in `admin_purchases`
        cursor_purchases.execute("SELECT product_id, quantity_bought FROM admin_purchases WHERE name = ?", (product_name,))
        product = cursor_purchases.fetchone()

        if product:
            product_id, existing_stock = product
            new_stock = existing_stock + quantity

            #  Update stock in `admin_purchases`
            cursor_purchases.execute('''
                UPDATE admin_purchases 
                SET quantity_bought = ?, total_value = ?, sellable_price = ?, purchase_place = ?
                WHERE product_id = ?
            ''', (new_stock, purchase_price * new_stock, selling_price, supplier, product_id))
        else:
            #  Generate new product_id if the product is new
            cursor_purchases.execute("SELECT MAX(product_id) FROM admin_purchases")
            last_product_id = cursor_purchases.fetchone()[0]
            new_product_id = 1 if last_product_id is None else last_product_id + 1

            cursor_purchases.execute('''
                INSERT INTO admin_purchases (product_id, name, purchase_price, quantity_bought, total_value, purchase_place, sellable_price)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (new_product_id, product_name, purchase_price, quantity, total_value, supplier, selling_price))

        conn_purchases.commit()
        conn_purchases.close()

        #  Connect to `products` database
        conn_products = sqlite3.connect("products.db")
        cursor_products = conn_products.cursor()

        # Check if the product exists in `products`
        cursor_products.execute("SELECT product_id FROM products WHERE name = ?", (product_name,))
        existing_product = cursor_products.fetchone()

        if existing_product:
            #  Update stock and price in `products`
            cursor_products.execute('''
                UPDATE products 
                SET stock = stock + ?, price = ?, category = ?
                WHERE product_id = ?
            ''', (quantity, selling_price, category, existing_product[0]))
        else:
            #  Insert new product into `products`
            cursor_products.execute('''
                INSERT INTO products (product_id, name, price, stock, category)
                VALUES (?, ?, ?, ?, ?)
            ''', (new_product_id, product_name, selling_price, quantity, category))

        conn_products.commit()
        conn_products.close()

        QMessageBox.information(self, "Success", "Purchase added successfully!")
        self.close()

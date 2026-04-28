from PyQt5.QtWidgets import (
    QApplication, QWidget, QVBoxLayout, QHBoxLayout, QPushButton, QLabel,
    QLineEdit, QTableWidget, QTableWidgetItem, QSpinBox, QMessageBox, QInputDialog
)
from PyQt5.QtCore import Qt
import pandas as pd
import os
import sqlite3
from fpdf import FPDF
from datetime import datetime


# Load products from the database
def load_products():
    """Loads products from the database and returns a DataFrame."""
    conn = sqlite3.connect("products.db")
    cursor = conn.cursor()
    cursor.execute("SELECT product_id, name, price, stock, category FROM products")
    products = cursor.fetchall()
    conn.close()

    # Convert fetched data to a Pandas DataFrame
    df = pd.DataFrame(products, columns=["product_id", "name", "price", "stock", "category"])
    return df


class SupermarketBilling(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Supermarket Billing System")
        self.setGeometry(100, 100, 800, 600)

        self.total_bill = 0
        self.total_quantity = 0  # Track total quantity
        self.data = load_products()  # Load product data
        self.initUI()  

    def initUI(self):
        layout = QVBoxLayout()

        self.product_label = QLabel("Enter Product Name or ID:")
        self.product_entry = QLineEdit()
        self.product_entry.returnPressed.connect(self.add_to_bill)  # Press Enter to Add Item
        
        input_layout = QHBoxLayout()
        input_layout.addWidget(self.product_label)
        input_layout.addWidget(self.product_entry)
        
        self.bill_table = QTableWidget()
        self.bill_table.setColumnCount(4)
        self.bill_table.setHorizontalHeaderLabels(["Product", "Quantity", "Price", "Value"])

        self.Quantity_label = QLabel("Total Quantity: 0")
        self.Quantity_label.setStyleSheet("font-size: 20px; font-weight: bold; color: green;")
        
        self.total_label = QLabel("Total Value: $0.00")
        self.total_label.setStyleSheet("font-size: 20px; font-weight: bold; color: green;")

        self.finalize_button = QPushButton("Finalize Bill")
        self.finalize_button.clicked.connect(self.finalize_bill)
        
        layout.addLayout(input_layout)
        layout.addWidget(self.bill_table)
        layout.addWidget(self.Quantity_label)
        layout.addWidget(self.total_label)
        layout.addWidget(self.finalize_button)
        
        self.setLayout(layout)

    def add_to_bill(self):
        product_name_or_id = self.product_entry.text().strip()
        if not product_name_or_id:
            return
        
        product = self.data[
            (self.data["name"] == product_name_or_id) | 
            (self.data["product_id"].astype(str) == product_name_or_id)
        ]

        if not product.empty:
            product_name, price, stock = product.iloc[0]["name"], product.iloc[0]["price"], product.iloc[0]["stock"]

            # Check if the product already exists in the bill
            for row in range(self.bill_table.rowCount()):
                existing_product = self.bill_table.item(row, 0).text()
                if existing_product == product_name:
                    quantity_spinbox = self.bill_table.cellWidget(row, 1)
                    if isinstance(quantity_spinbox, QSpinBox):
                        new_quantity = quantity_spinbox.value() + 1
                    
                        if new_quantity > stock:  # Prevent exceeding stock limit
                            QMessageBox.warning(self, "Stock Limit", f"Only {stock} items available!")
                            return

                        quantity_spinbox.setValue(new_quantity)  # Update quantity
                        self.quantity_confirmed(quantity_spinbox, row)  # Update total
                        self.product_entry.clear()
                        return  # Exit after updating quantity

            # If the product is not in the cart, add a new row
            row_position = self.bill_table.rowCount()
            self.bill_table.insertRow(row_position)
            self.bill_table.setItem(row_position, 0, QTableWidgetItem(product_name))

            quantity_spinbox = QSpinBox()
            quantity_spinbox.setValue(1)
            quantity_spinbox.setMinimum(1)
            quantity_spinbox.setMaximum(stock)
            quantity_spinbox.setKeyboardTracking(False)
            quantity_spinbox.editingFinished.connect(lambda: self.quantity_confirmed(quantity_spinbox, row_position))

            self.bill_table.setCellWidget(row_position, 1, quantity_spinbox)
            self.bill_table.setItem(row_position, 2, QTableWidgetItem(str(price)))
            self.bill_table.setItem(row_position, 3, QTableWidgetItem(str(price)))

            self.update_total()
            self.product_entry.clear()
        else:
            QMessageBox.warning(self, "Error", "Product not found!")

    def update_total(self):
        """ Updates total bill amount dynamically based on quantity changes. """
        self.total_bill = 0
        self.total_quantity = 0  

        for row in range(self.bill_table.rowCount()):
            quantity_widget = self.bill_table.cellWidget(row, 1)
            if isinstance(quantity_widget, QSpinBox):
                quantity = quantity_widget.value()
            else:
                quantity = 0  # Default to zero if widget is missing

            price = float(self.bill_table.item(row, 2).text())
            total = price * quantity
            self.bill_table.setItem(row, 3, QTableWidgetItem(f"{total:.2f}"))

            self.total_quantity += quantity
            self.total_bill += total

        self.Quantity_label.setText(f"Total Quantity: {self.total_quantity}")  
        self.total_label.setText(f"Total Value: ${self.total_bill:.2f}")

    def quantity_confirmed(self, spinbox, row_position):
        """Updates total when quantity is confirmed."""
        self.update_total()

    def finalize_bill(self):
        """Finalizes the bill, generates the receipt, and updates stock in the database."""
        amount_given, ok = QInputDialog.getDouble(self, "Payment", "Enter Amount Given:", 0, 0, 100000, 2)
        if not ok:
            return

        if amount_given < self.total_bill:
            QMessageBox.warning(self, "Insufficient Amount", "The amount given is less than the total bill.")
            return

        balance = amount_given - self.total_bill

        # Update product stock in the database

        # Connect to the correct database
        conn = sqlite3.connect("products.db")  
        cursor = conn.cursor()


        for row in range(self.bill_table.rowCount()):
            product = self.bill_table.item(row, 0).text()
            quantity_widget = self.bill_table.cellWidget(row, 1)  # QSpinBox for quantity
            quantity_sold = quantity_widget.value()

            # Reduce stock from database
            cursor.execute("SELECT stock FROM products WHERE name=?", (product,))
            current_stock = cursor.fetchone()
            
            if current_stock:  
                new_stock = current_stock[0] - quantity_sold
                if new_stock < 0:
                    QMessageBox.warning(self, "Stock Error", f"Not enough stock for {product}.")
                    conn.close()
                    return  # Prevents incorrect updates

                cursor.execute("UPDATE products SET stock=? WHERE name=?", (new_stock, product))

        conn.commit()
        conn.close()

        # Generate the receipt
        # self.generate_receipt(amount_given, balance)

        if ok:
            balance = amount_given - self.total_bill
            self.generate_receipt(amount_given, balance)  # Generate PDF Receipt

            try:
                conn = sqlite3.connect("products.db")
                cursor = conn.cursor()

                # Debug: Check if the table exists
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='products'")
                if not cursor.fetchone():
                    print("Table 'products' does not exist!")
                    QMessageBox.critical(self, "Database Error", "Products table not found in the database!")
                    conn.close()
                    return

                # Loop through all items in the bill and update stock
                for row in range(self.bill_table.rowCount()):
                    product = self.bill_table.item(row, 0).text()
                    quantity = self.bill_table.cellWidget(row, 1).value()  # Get quantity selected

                    # Fetch current stock
                    cursor.execute("SELECT stock FROM products WHERE name=?", (product,))
                    result = cursor.fetchone()

                    if result:
                        current_stock = result[0]
                        new_stock = current_stock - quantity
                        print(f"🔹 {product}: Current Stock = {current_stock}, Purchased = {quantity}, New Stock = {new_stock}")

                        # Ensure stock does not go negative
                        if new_stock < 0:
                            QMessageBox.warning(self, "Stock Error", f"Not enough stock for {product}!")
                            continue

                        # Update stock in the database
                        cursor.execute("UPDATE products SET stock=? WHERE name=?", (new_stock, product))
                        print(f"Updated stock for {product}")

                conn.commit()
                conn.close()
                print("Stock updated successfully.")

            except sqlite3.Error as e:
                print(f"Database error: {e}")

            # Show final message
            msg = QMessageBox()
            msg.setWindowTitle("Final Bill Amount")
            message_text = f"""
                <p><b><span style='color: green;'>Total Bill Amount:</span> ${self.total_bill:.2f}</b></p>
                <p><b><span style='color: blue;'>Amount Received:</span> ${amount_given:.2f}</b></p>
                <p><b><span style='color: red;'>Balance Given:</span> ${balance:.2f}</b></p>
            """
            msg.setTextFormat(Qt.RichText)  # Enable rich text (HTML)
            msg.setText(message_text)
            msg.setStyleSheet("QLabel{ font-size: 20px; font-weight: bold; }")
            msg.exec_()



        # Clear the bill table
        self.clear_bill()


    def clear_bill(self):
        """Clears the bill table and resets totals after finalizing the transaction."""
        self.bill_table.setRowCount(0)  # Remove all rows
        self.total_bill = 0
        self.total_quantity = 0
        self.Quantity_label.setText("Total Quantity: 0")
        self.total_label.setText("Total Value: $0.00")


    def generate_receipt(self, amount_given, balance):
        """ Generates a customized PDF receipt for the finalized bill. """
        receipt_folder = "Receipts"
        if not os.path.exists(receipt_folder):
            os.makedirs(receipt_folder)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        receipt_file = os.path.join(receipt_folder, f"Receipt_{timestamp}.pdf")

        pdf = FPDF()
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.add_page()

        # Header
        pdf.set_font("Arial", "B", 18)
        pdf.cell(200, 10, "Supermarket Billing", ln=True, align="C")
        pdf.set_font("Arial", "", 12)
        pdf.cell(200, 10, "Valasaravakkam, Chennai-600087", ln=True, align="C")
        pdf.cell(200, 10, f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", ln=True, align="C")
        pdf.ln(10)

        # Table Header
        pdf.set_font("Arial", "B", 12)
        pdf.cell(80, 10, "Product", border=1)
        pdf.cell(30, 10, "Quantity", border=1)
        pdf.cell(40, 10, "Price", border=1)
        pdf.cell(40, 10, "Total", border=1)
        pdf.ln()

        # Fetch Bill Items
        pdf.set_font("Arial", "", 12)
        total_quantity = 0  # Track total quantity

        for row in range(self.bill_table.rowCount()):
            product = self.bill_table.item(row, 0).text()
            quantity_widget = self.bill_table.cellWidget(row, 1)  # QSpinBox for quantity
            quantity = quantity_widget.value()
            price = float(self.bill_table.item(row, 2).text())
            total_price = float(self.bill_table.item(row, 3).text())

            total_quantity += quantity  # Track total quantity

            pdf.cell(80, 10, product, border=1)
            pdf.cell(30, 10, str(quantity), border=1)
            pdf.cell(40, 10, f"${price:.2f}", border=1)
            pdf.cell(40, 10, f"${total_price:.2f}", border=1)
            pdf.ln()

        pdf.ln(10)

        # Payment Details
        pdf.set_font("Arial", "B", 14)
        pdf.cell(200, 10, f"Total Quantity: {total_quantity}", ln=True)
        pdf.cell(200, 10, f"Total Bill: ${self.total_bill:.2f}", ln=True)
        pdf.cell(200, 10, f"Amount Received: ${amount_given:.2f}", ln=True)
        pdf.cell(200, 10, f"Balance Given: ${balance:.2f}", ln=True)

        # Thank You Message
        pdf.ln(10)
        pdf.set_font("Arial", "I", 12)
        pdf.cell(200, 10, "Thank you for shopping with us!", ln=True, align="C")

        # Save PDF
        pdf.output(receipt_file)
        QMessageBox.information(self, "Receipt Saved", f"Receipt generated: {receipt_file}")


if __name__ == '__main__':
    app = QApplication([])
    window = SupermarketBilling()
    window.show()
    app.exec_()

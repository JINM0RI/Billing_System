from PyQt5.QtWidgets import (
    QApplication, QWidget, QVBoxLayout, QHBoxLayout, QPushButton, QLabel,
    QLineEdit, QTableWidget, QTableWidgetItem, QSpinBox, QMessageBox, QInputDialog
)
from PyQt5.QtCore import Qt
import pandas as pd
import os
from fpdf import FPDF
from datetime import datetime
import sqlite3
import pandas as pd

def load_products(self):
    """Loads products from the database and returns a DataFrame."""
    conn = sqlite3.connect("products.db")
    cursor = conn.cursor()
    cursor.execute("SELECT product_id, name, price, stock, category FROM products")
    products = cursor.fetchall()
    conn.close()

    # Convert fetched data to a Pandas DataFrame
    df = pd.DataFrame(products, columns=["product_id", "name", "price", "stock", "category"])

    self.bill_table.setRowCount(len(products))
    for row, product in enumerate(products):
        product_id, name, price, stock, category = product
        self.bill_table.setItem(row, 0, QTableWidgetItem(str(product_id)))
        self.bill_table.setItem(row, 1, QTableWidgetItem(name))
        self.bill_table.setItem(row, 2, QTableWidgetItem(f"{price:.2f}"))
        self.bill_table.setItem(row, 3, QTableWidgetItem(str(stock)))
        self.bill_table.setItem(row, 4, QTableWidgetItem(category))

    return df  # Return the DataFrame



class SupermarketBilling(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Supermarket Billing System")
        self.setGeometry(100, 100, 800, 600)

        self.total_bill = 0
        self.initUI()  
        self.data = load_products(self)  # Now `self.data` gets the DataFrame


    
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

        self.Quantity_label = QLabel("Total Quantity : $0")
        self.Quantity_label.setStyleSheet("font-size: 20px; font-weight: bold; color: green;")
        
        self.total_label = QLabel("Total Value : $0")
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
        self.total_quantity = 0  # Use self.total_quantity instead of a local variable
        
        for row in range(self.bill_table.rowCount()):
            quantity_widget = self.bill_table.cellWidget(row, 1)
            quantity = quantity_widget.value()
            price = float(self.bill_table.item(row, 2).text())
            total = price * quantity
            self.bill_table.setItem(row, 3, QTableWidgetItem(f"{total:.2f}"))
            
            self.total_quantity += quantity  # Store total quantity in instance variable
            self.total_bill += total

        # Update UI labels
        self.Quantity_label.setText(f"Total Quantity: {self.total_quantity}")  
        self.total_label.setText(f"Total Value: ${self.total_bill:.2f}")



    def quantity_confirmed(self, spinbox, row_position):
        """Updates total when quantity is confirmed and moves to the next row."""
        self.update_total()

        # Move to the next row's quantity field (if available)
        next_row = row_position + 1
        if next_row < self.bill_table.rowCount():
            next_spinbox = self.bill_table.cellWidget(next_row, 1)
            if isinstance(next_spinbox, QSpinBox):
                next_spinbox.setFocus()
    
    def finalize_bill(self):
        """ Finalizes the bill, deducts stock, and generates a receipt. """
        if self.bill_table.rowCount() == 0:
            QMessageBox.warning(self, "No Items", "Your cart is empty!")
            return

        amount_given, ok = QInputDialog.getDouble(self, "Payment", 
                                                  f"Total Bill Amount: ${self.total_bill:.2f}\nEnter Amount Recived:", 
                                                  0, 0, 100000, 2)
        if ok:
            balance = amount_given - self.total_bill
            self.generate_receipt(amount_given, balance)  # Generate PDF Receipt
            
            msg = QMessageBox()
            msg.setWindowTitle("Final Bill Amount")
            message_text = f"""
                    <p><b><span style='color: green;'>Total Bill Amount:</span> ${self.total_bill:.2f}</b></p>
                    <p><b><span style='color: blue;'>Amount Recived:</span> ${amount_given:.2f}</b></p>
                    <p><b><span style='color: red;'>Balance Given:</span> ${balance:.2f}</b></p>
                """

            msg.setTextFormat(Qt.RichText)  # Enable rich text (HTML)
            msg.setText(message_text)

            # Apply font size and weight styling
            msg.setStyleSheet("QLabel{ font-size: 20px; font-weight: bold; }")

            msg.exec_()
            self.clear_bill()

    def clear_bill(self):
        """ Clears the bill table after finalizing the payment. """
        self.bill_table.setRowCount(0)
        self.total_bill = 0
        self.total_quantity = 0  # Reset total quantity

        # Update UI labels
        self.total_label.setText("Total Value: $0.00")
        self.Quantity_label.setText("Total Quantity: 0")


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

        #  Store Header (You Can Add Logo Here)
        pdf.set_font("Arial", "B", 18)
        pdf.cell(200, 10, "Supermarket Billing", ln=True, align="C")
        pdf.set_font("Arial", "", 12)
        pdf.cell(200, 10, "valasaravakkam, Chennai-600087", ln=True, align="C")
        pdf.cell(200, 10, f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", ln=True, align="C")
        pdf.ln(10)

        #  Table Header
        pdf.set_font("Arial", "B", 12)
        pdf.cell(80, 10, "Product", border=1)
        pdf.cell(30, 10, "Quantity", border=1)
        pdf.cell(40, 10, "Price", border=1)
        pdf.cell(40, 10, "Value", border=1)
        pdf.ln()

        # Bill Items
        pdf.set_font("Arial", "", 12)
        for row in range(self.bill_table.rowCount()):
            product = self.bill_table.item(row, 0).text()
            quantity = self.bill_table.cellWidget(row, 1).value()
            price = self.bill_table.item(row, 2).text()
            total = self.bill_table.item(row, 3).text()

            pdf.cell(80, 10, product, border=1)
            pdf.cell(30, 10, str(quantity), border=1)
            pdf.cell(40, 10, price, border=1)
            pdf.cell(40, 10, total, border=1)
            pdf.ln()

        pdf.ln(10)

        total_quantity_text = self.Quantity_label.text().split(": ")[1]  # Get numeric part
        total_quantity = int(total_quantity_text)  # Convert to integer
        
        # Total & Payment Details
        pdf.set_font("Arial", "B", 14)
        

        pdf.cell(200, 10, f"Total Quantity: {total_quantity}", ln=True)
        pdf.cell(200, 10, f"Total Value: ${self.total_bill:.2f}", ln=True)
        pdf.cell(200, 10, f"Amount Recived: ${amount_given:.2f}", ln=True)
        pdf.cell(200, 10, f"Balance Given: ${balance:.2f}", ln=True)

        # Thank You Message
        pdf.ln(10)
        pdf.set_font("Arial", "I", 12)
        pdf.cell(200, 10, "Thank you for shopping with us!", ln=True, align="C")

        pdf.output(receipt_file)
        QMessageBox.information(self, "Receipt Saved", f"Receipt generated: {receipt_file}")


if __name__ == '__main__':
    app = QApplication([])
    window = SupermarketBilling()
    window.show()
    app.exec_()

import sys
import sqlite3
import os
import hashlib
from PyQt5.QtWidgets import (
    QApplication, QWidget, QVBoxLayout, QPushButton, QTableWidget, QTableWidgetItem,
    QMessageBox, QHBoxLayout, QLabel, QLineEdit
)
from PyQt5.QtCore import Qt
from subprocess import Popen

# Database Setup
DB_NAME = "users.db"

def hash_password(password):
    """Hashes the password using SHA-256."""
    return hashlib.sha256(password.encode()).hexdigest()

def init_db():
    """Creates a user database if it doesn't exist."""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL,
                        password TEXT NOT NULL
                      )''')
    conn.commit()
    conn.close()

class AdminDashboard(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Admin Dashboard")
        self.setGeometry(200, 200, 600, 400)
        self.initUI()

    def initUI(self):
        layout = QVBoxLayout()

        # User Database Section
        self.user_db_btn = QPushButton("User Database")
        self.user_db_btn.clicked.connect(self.open_user_database)

        # Billing Button
        self.billing_btn = QPushButton("Billing")
        self.billing_btn.clicked.connect(self.open_billing)

        # Purchase Button
        self.purchase_button = QPushButton("Purchase", self)
        self.purchase_button.clicked.connect(self.open_purchase_window)

        layout.addWidget(self.user_db_btn)
        layout.addWidget(self.billing_btn)
        layout.addWidget(self.purchase_button)

        self.setLayout(layout)

    def open_purchase_window(self):
        """Opens the Admin Purchase Management Interface."""
        try:
            from purchase_manager import PurchaseManager
            self.purchase_window = PurchaseManager()
            self.purchase_window.show()
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to open purchase window!\n\nError: {str(e)}")


    def open_user_database(self):
        """Opens the User Database Management Window."""
        self.user_db_window = UserDatabaseWindow()
        self.user_db_window.show()

    def open_billing(self):
        """Opens the Billing System."""
        if os.path.exists("test.py"):
            Popen(["python", "test.py"])
        else:
            QMessageBox.warning(self, "Error", "Billing system file not found!")

class UserDatabaseWindow(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("User Database")
        self.setGeometry(250, 250, 700, 400)
        self.initUI()

    def initUI(self):
        layout = QVBoxLayout()

        self.table = QTableWidget()
        self.table.setColumnCount(3)  # Removing plain password display
        self.table.setHorizontalHeaderLabels(["ID", "Username", "Action"])
        self.load_users()

        # Registration Section
        reg_layout = QHBoxLayout()
        self.username_input = QLineEdit()
        self.username_input.setPlaceholderText("Enter Username")
        self.password_input = QLineEdit()
        self.password_input.setPlaceholderText("Enter Password")
        self.password_input.setEchoMode(QLineEdit.Password)
        self.register_btn = QPushButton("Register User")
        self.register_btn.clicked.connect(self.register_user)

        reg_layout.addWidget(QLabel("Username:"))
        reg_layout.addWidget(self.username_input)
        reg_layout.addWidget(QLabel("Password:"))
        reg_layout.addWidget(self.password_input)
        reg_layout.addWidget(self.register_btn)

        layout.addWidget(self.table)
        layout.addLayout(reg_layout)
        self.setLayout(layout)

    def load_users(self):
        """Loads users from the database and populates the table."""
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT id, username FROM users")  # Hides passwords
        users = cursor.fetchall()
        conn.close()

        self.table.setRowCount(0)
        for row_idx, (user_id, username) in enumerate(users):
            self.table.insertRow(row_idx)
            self.table.setItem(row_idx, 0, QTableWidgetItem(str(user_id)))
            self.table.setItem(row_idx, 1, QTableWidgetItem(username))

            delete_btn = QPushButton("Delete")
            delete_btn.clicked.connect(lambda _, uid=user_id: self.delete_user(uid))
            self.table.setCellWidget(row_idx, 2, delete_btn)

    def register_user(self):
        """Registers a new user."""
        username = self.username_input.text().strip()
        password = self.password_input.text().strip()

        if not username or not password:
            QMessageBox.warning(self, "Error", "Username and Password cannot be empty!")
            return

        hashed_password = hash_password(password)

        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        try:
            cursor.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, hashed_password))
            conn.commit()
            QMessageBox.information(self, "Success", "User registered successfully!")
            self.load_users()
        except sqlite3.IntegrityError:
            QMessageBox.warning(self, "Error", "Username already exists!")
        conn.close()

    def delete_user(self, user_id):
        """Deletes a user from the database."""
        confirm = QMessageBox.question(self, "Confirm", "Are you sure you want to delete this user?",
                                       QMessageBox.Yes | QMessageBox.No, QMessageBox.No)
        if confirm == QMessageBox.Yes:
            conn = sqlite3.connect(DB_NAME)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
            conn.commit()
            conn.close()
            self.load_users()

if __name__ == "__main__":
    init_db()
    app = QApplication(sys.argv)
    window = AdminDashboard()
    window.show()
    sys.exit(app.exec_())

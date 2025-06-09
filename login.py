from PyQt5.QtWidgets import QApplication, QWidget, QVBoxLayout, QLabel, QLineEdit, QPushButton, QMessageBox
import sys
import sqlite3
import subprocess

class LoginWindow(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Login - Supermarket Billing")
        self.setGeometry(400, 200, 400, 300)
        self.initUI()

    def initUI(self):
        layout = QVBoxLayout()

        # Username Input
        self.username_label = QLabel("Username:")
        self.username_input = QLineEdit()
        self.username_input.setPlaceholderText("Enter your username")

        # Password Input
        self.password_label = QLabel("Password:")
        self.password_input = QLineEdit()
        self.password_input.setPlaceholderText("Enter your password")
        self.password_input.setEchoMode(QLineEdit.Password)

        # Login Button
        self.login_button = QPushButton("Login")
        self.login_button.clicked.connect(self.check_login)

        # Add Widgets to Layout
        layout.addWidget(self.username_label)
        layout.addWidget(self.username_input)
        layout.addWidget(self.password_label)
        layout.addWidget(self.password_input)
        layout.addWidget(self.login_button)

        self.setLayout(layout)

    def check_login(self):
        """ Verify user login credentials from SQLite Database """
        username = self.username_input.text().strip()
        password = self.password_input.text().strip()

        # Connect to Database
        conn = sqlite3.connect("users.db")
        cursor = conn.cursor()

        # Check if user exists
        cursor.execute("SELECT * FROM users WHERE username=? AND password=?", (username, password))
        user = cursor.fetchone()
        conn.close()

        if user:
            QMessageBox.information(self, "Login Successful", f"Welcome, {username}!")
            if username == "admin":  # If admin logs in, open Admin Dashboard
                self.open_admin_dashboard()
            else:  # If cashier logs in, open Billing System
                self.open_billing_system()
        else:
            QMessageBox.warning(self, "Login Failed", "Invalid Username or Password")

    def open_admin_dashboard(self):
        """ Open the Admin Dashboard """
        self.close()  # Close login window
        subprocess.Popen(["python", "admin_dashboard.py"])  # Open Admin Panel

    def open_billing_system(self):
        """ Open the Billing System """
        self.close()
        subprocess.Popen(["python", "test.py"])  # Open Billing System

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = LoginWindow()
    window.show()
    sys.exit(app.exec_())

from PyQt5.QtWidgets import QApplication, QWidget, QVBoxLayout, QLabel, QLineEdit, QPushButton, QMessageBox
import sys
import sqlite3

class RegisterWindow(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Register - Supermarket Billing")
        self.setGeometry(400, 200, 400, 300)
        self.initUI()

    def initUI(self):
        layout = QVBoxLayout()

        # Username Input
        self.username_label = QLabel("Username:")
        self.username_input = QLineEdit()
        self.username_input.setPlaceholderText("Choose a username")

        # Password Input
        self.password_label = QLabel("Password:")
        self.password_input = QLineEdit()
        self.password_input.setPlaceholderText("Choose a password")
        self.password_input.setEchoMode(QLineEdit.Password)  # Hide password

        # Register Button
        self.register_button = QPushButton("Register")
        self.register_button.clicked.connect(self.register_user)

        # Add Widgets to Layout
        layout.addWidget(self.username_label)
        layout.addWidget(self.username_input)
        layout.addWidget(self.password_label)
        layout.addWidget(self.password_input)
        layout.addWidget(self.register_button)

        self.setLayout(layout)

    def register_user(self):
        """ Register a new user in SQLite Database """
        username = self.username_input.text().strip()
        password = self.password_input.text().strip()

        if not username or not password:
            QMessageBox.warning(self, "Error", "Username and password cannot be empty!")
            return

        # Connect to Database
        conn = sqlite3.connect("users.db")
        cursor = conn.cursor()

        try:
            cursor.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, password))
            conn.commit()
            QMessageBox.information(self, "Success", "Registration successful! You can now log in.")
            self.close()
        except sqlite3.IntegrityError:
            QMessageBox.warning(self, "Error", "Username already exists. Choose a different one.")
        
        conn.close()

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = RegisterWindow()
    window.show()
    sys.exit(app.exec_())

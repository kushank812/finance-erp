import os
import smtplib
from email.message import EmailMessage
from pathlib import Path
from typing import Optional


class EmailService:
    def __init__(self):
        self.username = os.getenv("MAIL_USERNAME", "").strip()
        self.password = os.getenv("MAIL_APP_PASSWORD", "").strip()
        self.from_name = os.getenv("MAIL_FROM_NAME", "Finance AP/AR").strip()
        self.reply_to = os.getenv("MAIL_REPLY_TO", self.username).strip()

        if not self.username or not self.password:
            raise RuntimeError("Email settings missing. Set MAIL_USERNAME and MAIL_APP_PASSWORD.")

    def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        attachment_path: Optional[str] = None,
        attachment_name: Optional[str] = None,
    ):
        if not to_email:
            raise ValueError("Recipient email is missing.")

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = f"{self.from_name} <{self.username}>"
        msg["To"] = to_email
        msg["Reply-To"] = self.reply_to
        msg.set_content(body)

        if attachment_path:
            path = Path(attachment_path)

            if not path.exists():
                raise FileNotFoundError(f"Attachment not found: {attachment_path}")

            with open(path, "rb") as f:
                data = f.read()

            msg.add_attachment(
                data,
                maintype="application",
                subtype="pdf",
                filename=attachment_name or path.name,
            )

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(self.username, self.password)
            smtp.send_message(msg)
from __future__ import annotations

import base64
import os
from pathlib import Path
from typing import Optional

import resend


class EmailService:
    def __init__(self):
        self.api_key = os.getenv("RESEND_API_KEY", "").strip()
        self.from_name = os.getenv("MAIL_FROM_NAME", "Finance ERP").strip()
        self.from_email = os.getenv("MAIL_FROM_EMAIL", "onboarding@resend.dev").strip()
        self.reply_to = os.getenv("MAIL_REPLY_TO", "").strip()

        if not self.api_key:
            raise RuntimeError("RESEND_API_KEY is missing.")

        if not self.from_email:
            raise RuntimeError("MAIL_FROM_EMAIL is missing.")

        resend.api_key = self.api_key

    def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        attachment_path: Optional[str] = None,
        attachment_name: Optional[str] = None,
    ):
        if not to_email or not str(to_email).strip():
            raise ValueError("Recipient email is missing.")

        params = {
            "from": f"{self.from_name} <{self.from_email}>",
            "to": [str(to_email).strip()],
            "subject": subject,
            "html": self._to_html(body),
        }

        if self.reply_to:
            params["reply_to"] = self.reply_to

        if attachment_path:
            path = Path(attachment_path)

            if not path.exists():
                raise FileNotFoundError(f"Attachment not found: {attachment_path}")

            file_bytes = path.read_bytes()
            encoded = base64.b64encode(file_bytes).decode("utf-8")

            params["attachments"] = [
                {
                    "filename": attachment_name or path.name,
                    "content": encoded,
                }
            ]

        return resend.Emails.send(params)

    def _to_html(self, text: str) -> str:
        safe = (
            str(text or "")
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\n", "<br>")
        )

        return f"""
        <div style="font-family: Arial, sans-serif; font-size: 14px; color: #111827; line-height: 1.6;">
            {safe}
        </div>
        """
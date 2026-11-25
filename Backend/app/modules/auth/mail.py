import smtplib
import ssl
from email.message import EmailMessage
from urllib.parse import urlsplit

from app.core.config import settings


def send_auth_email(recipient, subject, text):
    host = settings.get("SMTP_HOST", "").strip()
    sender = settings.get("SMTP_FROM", "").strip()
    if not host or not sender:
        raise RuntimeError("SMTP_HOST and SMTP_FROM are required for authentication email.")
    mode = settings.get("SMTP_SECURITY", "starttls").lower()
    if mode not in {"starttls", "ssl"}:
        raise RuntimeError("SMTP_SECURITY must be starttls or ssl.")
    port = int(settings.get("SMTP_PORT") or (465 if mode == "ssl" else 587))
    message = EmailMessage()
    message["From"] = sender
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(text)
    context = ssl.create_default_context()
    client = smtplib.SMTP_SSL(host, port, timeout=10, context=context) if mode == "ssl" else smtplib.SMTP(host, port, timeout=10)
    with client:
        if mode == "starttls":
            client.starttls(context=context)
        if settings.get("SMTP_USERNAME"):
            client.login(settings["SMTP_USERNAME"], settings.get("SMTP_PASSWORD", ""))
        if client.send_message(message):
            raise RuntimeError("Authentication email was rejected.")


def account_link(path, token):
    base = settings.get("ADMIN_PUBLIC_URL", "").rstrip("/")
    parsed = urlsplit(base)
    local = parsed.hostname in {"localhost", "127.0.0.1", "::1"}
    if not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or (parsed.scheme != "https" and not (local and parsed.scheme == "http")):
        raise RuntimeError("ADMIN_PUBLIC_URL must be a trusted HTTPS Admin URL (HTTP allowed only on loopback).")
    return f"{base}{path}?token={token}"


def password_reset_url(token):
    return account_link("/reset-password", token)

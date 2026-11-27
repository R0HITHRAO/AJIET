from __future__ import annotations

import base64
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from email.utils import parseaddr
import hashlib
import hmac
import json
import secrets
import smtplib
from typing import Any
import requests

from .config import (
    ACCESS_TOKEN_EXPIRE_HOURS,
    AUTH_SECRET,
    BASE_DIR,
    OTP_EXPIRY_MINUTES,
    get_email_settings,
)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, expected_digest = stored_hash.split("$", 1)
    except ValueError:
        return False
    computed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000).hex()
    return hmac.compare_digest(computed, expected_digest)


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def create_access_token(user: dict[str, Any]) -> str:
    exp = int((datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)).timestamp())
    payload = {
        "sub": user["user_id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "organization": user.get("organization", ""),
        "exp": exp,
    }
    encoded_payload = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = hmac.new(AUTH_SECRET.encode("utf-8"), encoded_payload.encode("ascii"), hashlib.sha256).digest()
    return f"{encoded_payload}.{_b64url_encode(sig)}"


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        encoded_payload, encoded_sig = token.split(".", 1)
        expected_sig = hmac.new(AUTH_SECRET.encode("utf-8"), encoded_payload.encode("ascii"), hashlib.sha256).digest()
        if not hmac.compare_digest(_b64url_decode(encoded_sig), expected_sig):
            return None
        payload = json.loads(_b64url_decode(encoded_payload).decode("utf-8"))
        if int(payload.get("exp", 0)) < int(datetime.now(timezone.utc).timestamp()):
            return None
        return payload
    except Exception:
        return None


def public_user(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "user_id": user["user_id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "organization": user.get("organization", ""),
        "created_at": user.get("created_at"),
    }


def generate_otp() -> str:
    return f"{secrets.randbelow(900000) + 100000}"


def hash_otp(email: str, otp: str) -> str:
    msg = f"{normalize_email(email)}:{otp.strip()}".encode("utf-8")
    return hmac.new(AUTH_SECRET.encode("utf-8"), msg, hashlib.sha256).hexdigest()


def email_provider_status() -> dict[str, Any]:
    cfg = get_email_settings()
    if cfg["brevo_api_key"]:
        return {
            "configured": True,
            "provider": "brevo_api",
            "label": "Brevo Email API (Live)",
            "sender": cfg["smtp_from"],
        }
    if cfg["resend_api_key"]:
        return {
            "configured": True,
            "provider": "resend_api",
            "label": "Resend Email API (Live)",
            "sender": cfg["smtp_from"],
        }
    if cfg["smtp_host"] and cfg["smtp_user"] and cfg["smtp_pass"]:
        return {
            "configured": True,
            "provider": "smtp_ssl" if cfg["smtp_use_ssl"] else "smtp_starttls",
            "label": f"SMTP {cfg['smtp_host']}:{cfg['smtp_port']} (Live)",
            "sender": cfg["smtp_from"],
        }
    return {
        "configured": False,
        "provider": "unconfigured",
        "label": "Not Configured",
        "sender": None,
    }


def _clean_env_val(value: str) -> str:
    return value.replace("\r", "").replace("\n", "").strip()


def save_email_settings(
    provider: str,
    sender_email: str,
    secret: str,
    smtp_host: str = "smtp.gmail.com",
    smtp_port: int = 587,
    sender_name: str = "Nourish AI",
) -> dict[str, Any]:
    env_path = BASE_DIR / ".env"
    clean_email = _clean_env_val(sender_email)
    clean_secret = _clean_env_val(secret)
    clean_name = _clean_env_val(sender_name) or "Nourish AI"
    formatted_from = f"{clean_name} <{clean_email}>"

    lines = [
        "# Nourish AI Live Email Configuration (gitignored)",
        f"SMTP_FROM={formatted_from}",
    ]
    if provider == "brevo":
        lines.extend(
            [
                f"BREVO_API_KEY={clean_secret}",
                "RESEND_API_KEY=",
                "SMTP_HOST=",
                "SMTP_USER=",
                "SMTP_PASS=",
            ]
        )
    elif provider == "resend":
        lines.extend(
            [
                f"RESEND_API_KEY={clean_secret}",
                "BREVO_API_KEY=",
                "SMTP_HOST=",
                "SMTP_USER=",
                "SMTP_PASS=",
            ]
        )
    else:
        lines.extend(
            [
                f"SMTP_HOST={_clean_env_val(smtp_host) or 'smtp.gmail.com'}",
                f"SMTP_PORT={int(smtp_port)}",
                f"SMTP_USER={clean_email}",
                f"SMTP_PASS={clean_secret}",
                "BREVO_API_KEY=",
                "RESEND_API_KEY=",
            ]
        )

    env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return email_provider_status()


def _otp_email_bodies(recipient_name: str, otp: str) -> tuple[str, str]:
    text = (
        f"Hello {recipient_name},\n\n"
        f"Your Nourish AI password reset OTP is: {otp}\n"
        f"This code expires in {OTP_EXPIRY_MINUTES} minutes.\n\n"
        "If you did not request this reset, please ignore this email.\n\n"
        "— Nourish AI (Team Codeverse)"
    )
    html = f"""
    <div style="font-family: Inter, Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="color: #064e3b; margin-top: 0;">Nourish AI Password Reset</h2>
      <p style="color: #334155;">Hello <strong>{recipient_name}</strong>,</p>
      <p style="color: #334155;">Use the verification code below to reset your password:</p>
      <div style="font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #065f46; background: #ecfdf5; padding: 14px 20px; border-radius: 10px; text-align: center; margin: 18px 0;">
        {otp}
      </div>
      <p style="color: #64748b; font-size: 13px;">This OTP expires in {OTP_EXPIRY_MINUTES} minutes.</p>
    </div>
    """
    return text, html


def send_otp_email(recipient_email: str, recipient_name: str, otp: str) -> dict[str, Any]:
    cfg = get_email_settings()
    status = email_provider_status()
    if not status["configured"]:
        raise RuntimeError(
            "Live email delivery is not configured. Connect your Gmail SMTP, Brevo API, or Resend API first."
        )

    text_body, html_body = _otp_email_bodies(recipient_name, otp)
    subject = "Nourish AI — Password Reset Verification OTP"

    if cfg["brevo_api_key"]:
        sender_name, sender_email = parseaddr(cfg["smtp_from"])
        resp = requests.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={
                "api-key": cfg["brevo_api_key"],
                "Content-Type": "application/json",
            },
            json={
                "sender": {"name": sender_name or "Nourish AI", "email": sender_email or cfg["smtp_user"]},
                "to": [{"email": recipient_email, "name": recipient_name}],
                "subject": subject,
                "textContent": text_body,
                "htmlContent": html_body,
            },
            timeout=12,
        )
        if not resp.ok:
            raise RuntimeError(f"Brevo API error ({resp.status_code}): {resp.text}")
        return {
            "sent": True,
            "smtp_configured": True,
            "delivery_mode": "brevo_api",
            "message": f"A 6-digit verification OTP was sent to {recipient_email}.",
        }

    if cfg["resend_api_key"]:
        resp = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {cfg['resend_api_key']}",
                "Content-Type": "application/json",
            },
            json={
                "from": cfg["smtp_from"],
                "to": [recipient_email],
                "subject": subject,
                "text": text_body,
                "html": html_body,
            },
            timeout=12,
        )
        if not resp.ok:
            raise RuntimeError(f"Resend API error ({resp.status_code}): {resp.text}")
        return {
            "sent": True,
            "smtp_configured": True,
            "delivery_mode": "resend_api",
            "message": f"A 6-digit verification OTP was sent to {recipient_email}.",
        }

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = cfg["smtp_from"]
    msg["To"] = recipient_email
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    if cfg["smtp_use_ssl"]:
        with smtplib.SMTP_SSL(cfg["smtp_host"], cfg["smtp_port"], timeout=12) as server:
            server.login(cfg["smtp_user"], cfg["smtp_pass"])
            server.send_message(msg)
    else:
        with smtplib.SMTP(cfg["smtp_host"], cfg["smtp_port"], timeout=12) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(cfg["smtp_user"], cfg["smtp_pass"])
            server.send_message(msg)

    return {
        "sent": True,
        "smtp_configured": True,
        "delivery_mode": "smtp",
        "message": f"A 6-digit verification OTP was sent to {recipient_email}.",
    }

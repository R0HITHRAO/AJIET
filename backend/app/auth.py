from __future__ import annotations

import base64
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
import hashlib
import hmac
import json
import secrets
import smtplib
from typing import Any

from .config import (
    ACCESS_TOKEN_EXPIRE_HOURS,
    AUTH_SECRET,
    OTP_EXPIRY_MINUTES,
    SMTP_FROM,
    SMTP_HOST,
    SMTP_PASS,
    SMTP_PORT,
    SMTP_USER,
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


def is_smtp_configured() -> bool:
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASS)


def send_otp_email(recipient_email: str, recipient_name: str, otp: str) -> dict[str, Any]:
    if not is_smtp_configured():
        return {
            "sent": False,
            "smtp_configured": False,
            "delivery_mode": "demo_preview",
            "demo_otp": otp,
            "message": f"SMTP not configured — demo OTP preview generated for {recipient_email}.",
        }

    msg = EmailMessage()
    msg["Subject"] = "Nourish AI — Password Reset Verification OTP"
    msg["From"] = SMTP_FROM
    msg["To"] = recipient_email
    msg.set_content(
        f"Hello {recipient_name},\n\n"
        f"Your Nourish AI password reset OTP is: {otp}\n"
        f"This code expires in {OTP_EXPIRY_MINUTES} minutes.\n\n"
        "If you did not request this reset, please ignore this email.\n\n"
        "— Nourish AI (Team Codeverse)"
    )
    msg.add_alternative(
        f"""
        <div style="font-family: Inter, Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #064e3b; margin-top: 0;">Nourish AI Password Reset</h2>
          <p style="color: #334155;">Hello <strong>{recipient_name}</strong>,</p>
          <p style="color: #334155;">Use the verification code below to reset your password:</p>
          <div style="font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #065f46; background: #ecfdf5; padding: 14px 20px; border-radius: 10px; text-align: center; margin: 18px 0;">
            {otp}
          </div>
          <p style="color: #64748b; font-size: 13px;">This OTP expires in {OTP_EXPIRY_MINUTES} minutes.</p>
        </div>
        """,
        subtype="html",
    )

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=12) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.send_message(msg)

    return {
        "sent": True,
        "smtp_configured": True,
        "delivery_mode": "smtp",
        "message": f"A 6-digit verification OTP was sent to {recipient_email}.",
    }

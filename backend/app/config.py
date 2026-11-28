from __future__ import annotations

import os
from pathlib import Path
from typing import Any
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")

DATA_DIR = Path(os.getenv("NOURISH_DATA_DIR", str(BASE_DIR / "data")))
ARTIFACTS_DIR = Path(os.getenv("NOURISH_ARTIFACTS_DIR", str(BASE_DIR / "artifacts")))
STORE_DIR = DATA_DIR / "store"

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "nourish_ai")
MONGODB_TIMEOUT_MS = int(os.getenv("MONGODB_TIMEOUT_MS", "800"))

AUTH_SECRET = os.getenv("NOURISH_AUTH_SECRET", "").strip()
if len(AUTH_SECRET) < 32:
    raise RuntimeError(
        "NOURISH_AUTH_SECRET must be configured with a random value of at least 32 characters."
    )
ACCESS_TOKEN_EXPIRE_HOURS = int(os.getenv("ACCESS_TOKEN_EXPIRE_HOURS", "24"))
OTP_EXPIRY_MINUTES = int(os.getenv("OTP_EXPIRY_MINUTES", "10"))


def get_email_settings() -> dict[str, Any]:
    """Loads email settings dynamically from .env so credential updates apply without restarting."""
    load_dotenv(BASE_DIR / ".env", override=True)
    load_dotenv(BASE_DIR.parent / ".env", override=True)
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587") or "587")
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_pass = os.getenv("SMTP_PASS", "").strip()
    smtp_from = os.getenv("SMTP_FROM", "").strip() or smtp_user or "noreply@nourish-ai.local"
    smtp_use_ssl = os.getenv("SMTP_USE_SSL", "").strip().lower() in ("1", "true", "yes") or smtp_port == 465
    brevo_api_key = os.getenv("BREVO_API_KEY", "").strip()
    resend_api_key = os.getenv("RESEND_API_KEY", "").strip()
    return {
        "smtp_host": smtp_host,
        "smtp_port": smtp_port,
        "smtp_user": smtp_user,
        "smtp_pass": smtp_pass,
        "smtp_from": smtp_from,
        "smtp_use_ssl": smtp_use_ssl,
        "brevo_api_key": brevo_api_key,
        "resend_api_key": resend_api_key,
    }


KITCHEN_NAME = os.getenv("KITCHEN_NAME", "Central Hostel & Canteen Kitchen")
KITCHEN_LAT = float(os.getenv("KITCHEN_LAT", "13.2557"))
KITCHEN_LON = float(os.getenv("KITCHEN_LON", "74.7850"))
KITCHEN_LOCATION = os.getenv("KITCHEN_LOCATION", "Bantakal, Udupi, Karnataka")

# Food safety thresholds (FSSAI-aligned institutional cooked-food redistribution rules)
MAX_AMBIENT_HOLD_HOURS = 2.0
MAX_HOT_HOLD_HOURS = 4.0
MAX_CHILLED_HOLD_HOURS = 24.0
SAFE_HOT_TEMP_C = 60.0
SAFE_CHILLED_TEMP_C = 5.0
CO2_KG_PER_KG_FOOD_SAVED = 2.5
KCAL_PER_SERVING_AVG = 420
KG_PER_SERVING_AVG = 0.32

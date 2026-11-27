from __future__ import annotations

import os
from pathlib import Path
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

AUTH_SECRET = os.getenv("NOURISH_AUTH_SECRET", "nourish-ai-hackathon-secret-key")
ACCESS_TOKEN_EXPIRE_HOURS = int(os.getenv("ACCESS_TOKEN_EXPIRE_HOURS", "24"))
OTP_EXPIRY_MINUTES = int(os.getenv("OTP_EXPIRY_MINUTES", "10"))

SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASS = os.getenv("SMTP_PASS", "").strip()
SMTP_FROM = os.getenv("SMTP_FROM", "").strip() or SMTP_USER or "noreply@nourish-ai.local"

KITCHEN_NAME = os.getenv("KITCHEN_NAME", "SMVITM Central Hostel & Canteen Kitchen")
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

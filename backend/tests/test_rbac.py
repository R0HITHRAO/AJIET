from __future__ import annotations

import os
from pathlib import Path
import sys

from fastapi.testclient import TestClient

os.environ.setdefault("NOURISH_AUTH_SECRET", "test-only-secret-not-for-production-2026")

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.db import db_manager  # noqa: E402
from app.main import app  # noqa: E402


def test_rbac_restricts_kitchen_mutations_for_ngo_coordinator():
    test_email = "ngo_rbac_check@example.org"
    db_manager.collection("users").delete_many({"email": test_email})
    try:
        with TestClient(app) as client:
            reg = client.post(
                "/api/auth/register",
                json={
                    "name": "NGO Dispatch Lead",
                    "email": test_email,
                    "password": "SafePassword123",
                    "role": "NGO Coordinator",
                    "organization": "Community Shelter Network",
                },
            )
            assert reg.status_code == 200
            headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

            # NGO Coordinator retains access to overview, surplus queue, and NGO endpoints
            assert client.get("/api/dashboard/overview", headers=headers).status_code == 200
            assert client.get("/api/surplus", headers=headers).status_code == 200
            assert client.get("/api/ngos", headers=headers).status_code == 200

            # NGO Coordinator receives 403 on Kitchen Manager / Admin mutations
            assert client.patch("/api/ingredients/ing_rice", json={"stock_qty": 120}, headers=headers).status_code == 403
            assert client.delete("/api/menu/item_steamed_rice", headers=headers).status_code == 403
            assert client.post("/api/models/retrain", headers=headers).status_code == 403
            assert client.post("/api/admin/reset-demo", headers=headers).status_code == 403
    finally:
        db_manager.collection("users").delete_many({"email": test_email})

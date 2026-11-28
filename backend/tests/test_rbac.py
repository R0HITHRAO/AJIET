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

            # NGO Coordinator receives 403 on Kitchen Manager / Admin mutations & kitchen alerts
            assert client.patch("/api/ingredients/ing_rice", json={"stock_qty": 120}, headers=headers).status_code == 403
            assert client.delete("/api/menu/item_steamed_rice", headers=headers).status_code == 403
            assert client.post("/api/models/retrain", headers=headers).status_code == 403
            assert client.post("/api/admin/reset-demo", headers=headers).status_code == 403
            assert (
                client.post(
                    "/api/kitchen-alerts",
                    json={"menu_item_id": "item_steamed_rice", "menu_item_name": "Steamed Rice", "remaining_servings": 10},
                    headers=headers,
                ).status_code
                == 403
            )
    finally:
        db_manager.collection("users").delete_many({"email": test_email})


def test_rbac_allows_chef_handover_logs_and_blocks_admin_mutations():
    chef_email = "chef_rbac_check@example.org"
    mgr_email = "temp_mgr_cleanup@example.org"
    db_manager.collection("users").delete_many({"email": chef_email})
    try:
        with TestClient(app) as client:
            reg = client.post(
                "/api/auth/register",
                json={
                    "name": "Head Chef",
                    "email": chef_email,
                    "password": "SafePassword123",
                    "role": "Chef",
                    "organization": "Central Kitchen",
                },
            )
            assert reg.status_code == 200
            headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

            assert client.get("/api/ingredients", headers=headers).status_code == 200
            opt = client.post(
                "/api/optimize-batch",
                json={"date": "2026-11-28", "meal_slot": "Lunch", "expected_attendance": 700},
                headers=headers,
            )
            assert opt.status_code == 200

            log_res = client.post(
                "/api/meal-logs",
                json={
                    "date": "2026-11-28",
                    "meal_slot": "Lunch",
                    "expected_attendance": 700,
                    "actual_attendance": 680,
                    "auto_retrain": False,
                    "items": [
                        {
                            "menu_item_id": "item_steamed_rice",
                            "prepared_servings": 650,
                            "served_servings": 640,
                            "holding_temp_c": 65.0,
                            "hours_since_cooked": 1.0,
                            "storage_type": "hot_hold",
                            "is_sealed": True,
                            "register_surplus": False,
                        }
                    ],
                },
                headers=headers,
            )
            assert log_res.status_code == 200

            assert client.delete("/api/menu/item_steamed_rice", headers=headers).status_code == 403
            assert client.post("/api/admin/reset-demo", headers=headers).status_code == 403
            assert client.post("/api/models/retrain", headers=headers).status_code == 403

            # Chef creates low-stock alert for Kitchen Manager, cannot reply as Manager
            al = client.post(
                "/api/kitchen-alerts",
                json={
                    "menu_item_id": "item_steamed_rice",
                    "menu_item_name": "Steamed Sona Masoori Rice",
                    "meal_slot": "Lunch",
                    "remaining_servings": 22,
                    "batch_size": 50,
                    "alert_level": "Running Low",
                    "note": "Last tray on serving line",
                },
                headers=headers,
            )
            assert al.status_code == 200
            alert_id = al.json()["alert"]["alert_id"]
            assert al.json()["alert"]["status"] == "Pending Manager"

            assert (
                client.patch(
                    f"/api/kitchen-alerts/{alert_id}/respond",
                    json={"remaining_customers": 85, "decision": "Prepare Additional Batch", "batches_requested": 2},
                    headers=headers,
                ).status_code
                == 403
            )

            # Kitchen Manager replies with remaining customer count -> Chef sees & resolves alert
            mgr_reg = client.post(
                "/api/auth/register",
                json={
                    "name": "Duty Manager",
                    "email": mgr_email,
                    "password": "SafePassword123",
                    "role": "Kitchen Manager",
                },
            )
            assert mgr_reg.status_code == 200
            mgr_headers = {"Authorization": f"Bearer {mgr_reg.json()['access_token']}"}
            resp = client.patch(
                f"/api/kitchen-alerts/{alert_id}/respond",
                json={
                    "remaining_customers": 85,
                    "decision": "Prepare Additional Batch",
                    "batches_requested": 2,
                    "manager_note": "Hostel B still incoming",
                },
                headers=mgr_headers,
            )
            assert resp.status_code == 200
            assert resp.json()["alert"]["status"] == "Responded"
            assert resp.json()["alert"]["remaining_customers"] == 85

            chef_list = client.get("/api/kitchen-alerts", headers=headers).json()["alerts"]
            matched = next(a for a in chef_list if a["alert_id"] == alert_id)
            assert matched["remaining_customers"] == 85
            assert matched["batches_requested"] == 2

            res_resolve = client.patch(f"/api/kitchen-alerts/{alert_id}/resolve", headers=headers)
            assert res_resolve.status_code == 200
            assert res_resolve.json()["alert"]["status"] == "Resolved"
    finally:
        db_manager.collection("users").delete_many({"email": chef_email})
        with TestClient(app) as cleanup_client:
            mgr_reg = cleanup_client.post(
                "/api/auth/register",
                json={
                    "name": "Temp Cleanup Manager",
                    "email": mgr_email,
                    "password": "SafePassword123",
                    "role": "Kitchen Manager",
                },
            )
            if mgr_reg.status_code == 200:
                cleanup_client.post(
                    "/api/admin/reset-demo",
                    headers={"Authorization": f"Bearer {mgr_reg.json()['access_token']}"},
                )
            db_manager.collection("users").delete_many({"email": mgr_email})

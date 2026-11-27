from __future__ import annotations

import sys
from pathlib import Path

from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.main import app  # noqa: E402


def test_end_to_end_nourish_ai_workflow():
    with TestClient(app) as client:
        # 1. Health & startup ML training check
        health = client.get("/api/health")
        assert health.status_code == 200
        h_data = health.json()
        assert h_data["status"] == "ok"
        assert h_data["ml_engine"]["training_samples"] >= 1000
        assert "random_forest" in h_data["ml_engine"]["metrics"]
        assert "xgboost" in h_data["ml_engine"]["metrics"]

        # 2. Dashboard overview
        dash = client.get("/api/dashboard/overview")
        assert dash.status_code == 200
        d_data = dash.json()
        assert d_data["kpis"]["monthly_waste_prevented_kg"] > 0
        assert len(d_data["daily_trend"]) > 0

        # 3. Demand Forecast (Random Forest, XGBoost, Ensemble)
        for model_choice in ("ensemble", "xgboost", "random_forest"):
            fc = client.post(
                "/api/forecast",
                json={
                    "date": "2026-11-28",
                    "meal_slot": "Lunch",
                    "expected_attendance": 720,
                    "weather": "Rainy",
                    "temperature_c": 24.5,
                    "model_choice": model_choice,
                },
            )
            assert fc.status_code == 200
            fc_data = fc.json()
            assert fc_data["total_predicted_servings"] > 0
            assert all(it["p10_servings"] <= it["predicted_servings"] <= it["p90_servings"] for it in fc_data["items"])

        # 4. Google OR-Tools Batch Optimization
        opt = client.post(
            "/api/optimize-batch",
            json={
                "date": "2026-11-28",
                "meal_slot": "Lunch",
                "expected_attendance": 740,
                "batch_cooking_enabled": True,
            },
        )
        assert opt.status_code == 200
        opt_data = opt.json()["optimization"]
        assert opt_data["solver_status"] in ("OPTIMAL", "FEASIBLE")
        assert opt_data["summary"]["waste_saved_kg"] >= 0
        assert opt_data["summary"]["total_initial_servings"] > 0

        # 5. What-if Kitchen Simulator (simulate ingredient shortage & attendance drop)
        sim = client.post(
            "/api/simulate",
            json={
                "date": "2026-11-28",
                "meal_slot": "Lunch",
                "base_attendance": 740,
                "attendance_delta_pct": -25.0,
                "weather": "Rainy",
                "temperature_c": 24.0,
                "ingredient_stock_pct_overrides": {"ing_paneer": 10.0},
            },
        )
        assert sim.status_code == 200
        sim_data = sim.json()
        assert sim_data["deltas"]["predicted_servings_delta"] < 0
        assert len(sim_data["advisories"]) >= 1

        # 6. Post-meal feedback + automatic surplus safety evaluation
        fb = client.post(
            "/api/meal-logs",
            json={
                "date": "2026-11-27",
                "meal_slot": "Lunch",
                "expected_attendance": 720,
                "actual_attendance": 640,
                "items": [
                    {
                        "menu_item_id": "item_steamed_rice",
                        "prepared_servings": 690,
                        "served_servings": 610,
                        "predicted_servings": 625,
                        "holding_temp_c": 65.0,
                        "hours_since_cooked": 1.0,
                        "storage_type": "hot_hold",
                        "is_sealed": True,
                        "register_surplus": True,
                    }
                ],
                "auto_retrain": False,
            },
        )
        assert fb.status_code == 200
        fb_data = fb.json()
        assert len(fb_data["detected_surplus"]) == 1
        new_surplus = fb_data["detected_surplus"][0]
        assert new_surplus["safety_passed"] is True

        # 7. Surplus matching & dispatch to compatible NGO
        surplus_list = client.get("/api/surplus").json()["surplus_items"]
        target = next(s for s in surplus_list if s["surplus_id"] == new_surplus["surplus_id"])
        assert len(target["top_matches"]) >= 1
        top_ngo = target["top_matches"][0]

        disp = client.post(
            "/api/redistributions/dispatch",
            json={
                "surplus_id": target["surplus_id"],
                "ngo_id": top_ngo["ngo_id"],
                "transport_mode": "NGO Pickup Van",
            },
        )
        assert disp.status_code == 200
        redist = disp.json()["redistribution"]
        assert redist["status"] == "Dispatched"

        # 8. Confirm delivery status update
        upd = client.patch(f"/api/redistributions/{redist['redistribution_id']}", json={"status": "Delivered"})
        assert upd.status_code == 200
        assert upd.json()["redistribution"]["status"] == "Delivered"

        # 9. Retrain models endpoint
        ret = client.post("/api/models/retrain")
        assert ret.status_code == 200
        assert ret.json()["current_run"]["version"] >= 2

        # 10. Reset demo cleanly
        rst = client.post("/api/admin/reset-demo")
        assert rst.status_code == 200
        assert rst.json()["status"] == "reset_complete"

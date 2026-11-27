from __future__ import annotations

from typing import Any

from .db import DatabaseManager
from .ml_engine import forecast_engine
from .models import WhatIfSimulationRequest
from .optimizer import optimize_batch_preparation


def run_whatif_simulation(req: WhatIfSimulationRequest, db: DatabaseManager) -> dict[str, Any]:
    """
    Re-runs ML demand forecasting and Google OR-Tools batch optimization under both
    baseline and user-modified kitchen conditions (attendance shifts, menu swaps,
    ingredient shortages, weather/events, and batch-wise toggle).
    """
    # 1. Baseline forecast & OR-Tools optimization
    baseline_forecast = forecast_engine.predict(
        db=db,
        target_date=req.date,
        meal_slot=req.meal_slot,
        expected_attendance=req.base_attendance,
        is_holiday=False,
        special_event="None",
        weather="Cloudy",
        temperature_c=28.0,
        model_choice=req.model_choice,
    )
    baseline_opt = optimize_batch_preparation(
        forecast_result=baseline_forecast,
        db=db,
        waste_penalty_per_serving=req.waste_penalty_per_serving,
        shortage_penalty_per_serving=req.shortage_penalty_per_serving,
        batch_cooking_enabled=True,
    )

    # 2. Simulated scenario overrides
    slot_items = db.collection("menu_items").find({"meal_slot": req.meal_slot})
    sim_menu_ids = []
    for item in slot_items:
        mid = item["menu_item_id"]
        swapped = req.menu_swaps.get(mid, mid)
        if swapped not in sim_menu_ids:
            sim_menu_ids.append(swapped)

    sim_attendance = max(20, int(round(req.base_attendance * (1.0 + req.attendance_delta_pct / 100.0))))

    # Apply percentage overrides to current ingredient stocks
    ingredients = db.collection("ingredients").find()
    stock_overrides: dict[str, float] = {}
    for ing in ingredients:
        ing_id = ing["ingredient_id"]
        if ing_id in req.ingredient_stock_pct_overrides:
            pct = max(0.0, float(req.ingredient_stock_pct_overrides[ing_id])) / 100.0
            stock_overrides[ing_id] = round(float(ing["stock_qty"]) * pct, 2)

    sim_forecast = forecast_engine.predict(
        db=db,
        target_date=req.date,
        meal_slot=req.meal_slot,
        expected_attendance=sim_attendance,
        is_holiday=req.is_holiday,
        special_event=req.special_event,
        weather=req.weather,
        temperature_c=req.temperature_c,
        model_choice=req.model_choice,
        menu_item_ids=sim_menu_ids,
    )
    sim_opt = optimize_batch_preparation(
        forecast_result=sim_forecast,
        db=db,
        waste_penalty_per_serving=req.waste_penalty_per_serving,
        shortage_penalty_per_serving=req.shortage_penalty_per_serving,
        batch_cooking_enabled=req.batch_cooking_enabled,
        ingredient_stock_overrides=stock_overrides or None,
    )

    base_sum = baseline_opt["summary"]
    sim_sum = sim_opt["summary"]

    deltas = {
        "attendance_delta": sim_attendance - req.base_attendance,
        "predicted_servings_delta": sim_sum.get("total_predicted_servings", 0) - base_sum.get("total_predicted_servings", 0),
        "initial_prep_delta": sim_sum.get("total_initial_servings", 0) - base_sum.get("total_initial_servings", 0),
        "waste_kg_delta": round(
            sim_sum.get("expected_waste_kg_optimized", 0.0) - base_sum.get("expected_waste_kg_optimized", 0.0), 2
        ),
        "cost_inr_delta": round(
            sim_sum.get("estimated_cost_optimized_inr", 0.0) - base_sum.get("estimated_cost_optimized_inr", 0.0), 2
        ),
        "shortage_risk_delta": sim_sum.get("shortage_risk_servings", 0) - base_sum.get("shortage_risk_servings", 0),
    }

    advisories: list[str] = []
    if sim_opt["bottleneck_ingredients"]:
        advisories.append(
            f"Ingredient constraint triggered for: {', '.join(sim_opt['bottleneck_ingredients'])}. OR-Tools rebalanced batches within remaining stock."
        )
    if sim_sum.get("shortage_risk_servings", 0) > 0:
        advisories.append(
            f"Shortage alert: {sim_sum['shortage_risk_servings']} predicted servings cannot be covered under current stock/batch caps—consider menu substitution."
        )
    if req.attendance_delta_pct <= -15:
        advisories.append(
            "Significant attendance drop detected: reduce initial batch and pre-alert nearby NGOs if prep is already underway."
        )
    if not req.batch_cooking_enabled:
        advisories.append(
            "Batch-wise cooking is OFF: expected waste increased because all servings are cooked upfront in a single batch."
        )
    if not advisories:
        advisories.append("Simulated kitchen plan is well balanced with high meal sufficiency and low waste risk.")

    return {
        "scenario": {
            "date": req.date,
            "meal_slot": req.meal_slot,
            "base_attendance": req.base_attendance,
            "simulated_attendance": sim_attendance,
            "attendance_delta_pct": req.attendance_delta_pct,
            "is_holiday": req.is_holiday,
            "special_event": req.special_event,
            "weather": req.weather,
            "temperature_c": req.temperature_c,
            "batch_cooking_enabled": req.batch_cooking_enabled,
            "menu_swaps": req.menu_swaps,
            "ingredient_stock_pct_overrides": req.ingredient_stock_pct_overrides,
        },
        "baseline": {
            "forecast": baseline_forecast,
            "optimization": baseline_opt,
        },
        "simulated": {
            "forecast": sim_forecast,
            "optimization": sim_opt,
        },
        "deltas": deltas,
        "advisories": advisories,
    }

from __future__ import annotations

import math
from typing import Any
try:
    from ortools.linear_solver.python import pywraplp
except ImportError:  # OR-Tools <= 9.x compatibility
    from ortools.linear_solver import pywraplp

from .config import (
    CO2_KG_PER_KG_FOOD_SAVED,
    KITCHEN_LAT,
    KITCHEN_LON,
    MAX_AMBIENT_HOLD_HOURS,
    MAX_CHILLED_HOLD_HOURS,
    MAX_HOT_HOLD_HOURS,
    SAFE_CHILLED_TEMP_C,
    SAFE_HOT_TEMP_C,
)
from .db import DatabaseManager


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 2)


def optimize_batch_preparation(
    forecast_result: dict[str, Any],
    db: DatabaseManager,
    waste_penalty_per_serving: float = 28.0,
    shortage_penalty_per_serving: float = 55.0,
    batch_cooking_enabled: bool = True,
    max_initial_ratio: float = 0.80,
    ingredient_stock_overrides: dict[str, float] | None = None,
) -> dict[str, Any]:
    """
    Google OR-Tools MILP solver for batch-wise kitchen preparation optimization.
    Balances prep cost, expected waste penalty, shortage risk, and ingredient stock constraints.
    """
    items = forecast_result.get("items", [])
    ingredients = db.collection("ingredients").find()
    ing_map = {ing["ingredient_id"]: dict(ing) for ing in ingredients}
    if ingredient_stock_overrides:
        for ing_id, val in ingredient_stock_overrides.items():
            if ing_id in ing_map:
                ing_map[ing_id]["stock_qty"] = max(0.0, float(val))

    if not items:
        return {
            "solver_status": "EMPTY",
            "batch_cooking_enabled": batch_cooking_enabled,
            "items": [],
            "ingredient_utilization": [],
            "summary": {},
        }

    solver = pywraplp.Solver.CreateSolver("SCIP")
    if solver is None:
        solver = pywraplp.Solver.CreateSolver("CBC")

    init_batches: dict[str, Any] = {}
    reserve_batches: dict[str, Any] = {}
    shortfall_mid: dict[str, Any] = {}
    excess_mid: dict[str, Any] = {}
    shortfall_peak: dict[str, Any] = {}

    # Expected probability that on-demand reserve batch needs to be fired (~28% of days when turnout surges)
    reserve_trigger_prob = 0.28

    for item in items:
        mid = item["menu_item_id"]
        bsz = max(1, int(item["batch_size"]))
        p10 = float(item["p10_servings"])
        p50 = float(item["predicted_servings"])
        p90 = float(item["p90_servings"])
        max_batches = int(math.ceil((p90 * 1.25) / bsz)) + 2

        init_b = solver.IntVar(0, max_batches, f"init_{mid}")
        res_b = solver.IntVar(0, max_batches if batch_cooking_enabled else 0, f"res_{mid}")
        sf_mid = solver.NumVar(0.0, solver.infinity(), f"sf_mid_{mid}")
        ex_mid = solver.NumVar(0.0, solver.infinity(), f"ex_mid_{mid}")
        sf_peak = solver.NumVar(0.0, solver.infinity(), f"sf_peak_{mid}")

        init_batches[mid] = init_b
        reserve_batches[mid] = res_b
        shortfall_mid[mid] = sf_mid
        excess_mid[mid] = ex_mid
        shortfall_peak[mid] = sf_peak

        init_servings = bsz * init_b
        total_servings = bsz * (init_b + res_b)

        if batch_cooking_enabled:
            # Initial batch must comfortably open dining (at least min_initial_ratio * p50, capped so we don't overcook)
            # And capped at max_initial_ratio * p90 to force agile reserve batching
            cap_init = max(bsz, int(math.ceil(p90 * max_initial_ratio / bsz)) * bsz)
            solver.Add(init_servings <= cap_init)
            # Soft target around p50 for initial batch (adjusted by waste vs shortage trade-off)
            solver.Add(sf_mid >= p50 - init_servings)
            solver.Add(ex_mid >= init_servings - p50)
            solver.Add(sf_peak >= p90 - total_servings)
            # Ensure reserve is non-negative and meaningful when uncertainty spread exists
            if p90 > p50 and p50 >= bsz:
                min_init_floor = int(math.floor(p10 * 0.85 / bsz))
                if min_init_floor > 0:
                    solver.Add(init_b >= 1)
        else:
            # Single-batch mode: must satisfy demand in initial batch only
            solver.Add(sf_mid >= p50 - init_servings)
            solver.Add(ex_mid >= init_servings - p50)
            solver.Add(sf_peak >= p90 - init_servings)

    # Hard ingredient inventory constraints across ALL menu items in this meal slot
    relevant_ing_ids = sorted({ing_id for item in items for ing_id in item.get("recipe", {})})
    for ing_id in relevant_ing_ids:
        avail = float(ing_map.get(ing_id, {}).get("stock_qty", 0.0))
        expr = solver.Sum(
            float(item["recipe"][ing_id]) * int(item["batch_size"]) * (init_batches[item["menu_item_id"]] + reserve_batches[item["menu_item_id"]])
            for item in items
            if ing_id in item.get("recipe", {})
        )
        solver.Add(expr <= avail + 1e-6)

    # Objective: minimize expected production cost + waste penalty + shortage penalty
    objective = solver.Objective()
    for item in items:
        mid = item["menu_item_id"]
        bsz = int(item["batch_size"])
        c_serv = float(item["cost_per_serving"])
        w_pen = max(waste_penalty_per_serving, c_serv * 0.9)
        s_pen = max(shortage_penalty_per_serving, c_serv * 1.8)

        # Initial batch is always cooked; reserve batch is cooked only with reserve_trigger_prob
        objective.SetCoefficient(init_batches[mid], bsz * c_serv)
        objective.SetCoefficient(reserve_batches[mid], bsz * c_serv * reserve_trigger_prob + 18.0)
        objective.SetCoefficient(excess_mid[mid], w_pen)
        objective.SetCoefficient(shortfall_mid[mid], s_pen)
        objective.SetCoefficient(shortfall_peak[mid], s_pen * 0.35)

    objective.SetMinimization()
    status = solver.Solve()
    status_map = {
        pywraplp.Solver.OPTIMAL: "OPTIMAL",
        pywraplp.Solver.FEASIBLE: "FEASIBLE",
        pywraplp.Solver.INFEASIBLE: "INFEASIBLE",
        pywraplp.Solver.UNBOUNDED: "UNBOUNDED",
    }
    solver_status = status_map.get(status, "SUBOPTIMAL")

    plan_items: list[dict[str, Any]] = []
    ing_usage: dict[str, float] = {ing_id: 0.0 for ing_id in relevant_ing_ids}
    ing_init_usage: dict[str, float] = {ing_id: 0.0 for ing_id in relevant_ing_ids}

    total_predicted = 0
    total_trad_prep = 0
    total_opt_initial = 0
    total_opt_reserve = 0
    total_trad_waste_servings = 0.0
    total_opt_expected_waste_servings = 0.0
    total_trad_waste_kg = 0.0
    total_opt_waste_kg = 0.0
    total_trad_cost = 0.0
    total_opt_expected_cost = 0.0
    total_shortage_risk_servings = 0

    for item in items:
        mid = item["menu_item_id"]
        bsz = int(item["batch_size"])
        p50 = int(item["predicted_servings"])
        p90 = int(item["p90_servings"])
        c_serv = float(item["cost_per_serving"])
        w_kg = float(item["serving_weight_kg"])

        ib = int(round(init_batches[mid].solution_value())) if status in (pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE) else 0
        rb = int(round(reserve_batches[mid].solution_value())) if status in (pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE) else 0

        init_serv = ib * bsz
        res_serv = rb * bsz
        max_cap_serv = init_serv + res_serv

        # Traditional single-batch institutional prep cooks p90 + 10% safety buffer upfront
        trad_batches = int(math.ceil((p90 * 1.10) / bsz))
        trad_serv = trad_batches * bsz

        # Expected servings actually cooked with batch-wise strategy: initial + expected fraction of reserve fired
        expected_cooked_opt = init_serv + res_serv * reserve_trigger_prob
        trad_expected_waste = max(0.0, trad_serv - p50)
        # Account for both initial overshoot and expected residual when a reserve batch is triggered
        opt_expected_waste = (
            max(0.0, init_serv - p50)
            + (0.35 * bsz * reserve_trigger_prob if rb > 0 else 0.0)
            + max(0.0, init_serv - float(item["p10_servings"])) * 0.18
        )
        shortage_vs_p50 = max(0, p50 - max_cap_serv)

        for ing_id, per_serv in item.get("recipe", {}).items():
            ing_usage[ing_id] = ing_usage.get(ing_id, 0.0) + float(per_serv) * max_cap_serv
            ing_init_usage[ing_id] = ing_init_usage.get(ing_id, 0.0) + float(per_serv) * init_serv

        total_predicted += p50
        total_trad_prep += trad_serv
        total_opt_initial += init_serv
        total_opt_reserve += res_serv
        total_trad_waste_servings += trad_expected_waste
        total_opt_expected_waste_servings += opt_expected_waste
        total_trad_waste_kg += trad_expected_waste * w_kg
        total_opt_waste_kg += opt_expected_waste * w_kg
        total_trad_cost += trad_serv * c_serv
        total_opt_expected_cost += expected_cooked_opt * c_serv
        total_shortage_risk_servings += shortage_vs_p50

        plan_items.append(
            {
                "menu_item_id": mid,
                "name": item["name"],
                "category": item["category"],
                "predicted_servings": p50,
                "p10_servings": int(item["p10_servings"]),
                "p90_servings": p90,
                "batch_size": bsz,
                "initial_batches": ib,
                "initial_servings": init_serv,
                "reserve_batches": rb,
                "reserve_servings": res_serv,
                "max_capacity_servings": max_cap_serv,
                "traditional_prep_servings": trad_serv,
                "expected_waste_servings_opt": round(opt_expected_waste, 1),
                "expected_waste_servings_trad": round(trad_expected_waste, 1),
                "savings_inr": round((trad_serv - expected_cooked_opt) * c_serv, 2),
                "shortage_risk_servings": shortage_vs_p50,
                "stock_constrained": max_cap_serv < p50,
                "cost_per_serving": c_serv,
                "serving_weight_kg": w_kg,
            }
        )

    ing_report: list[dict[str, Any]] = []
    bottlenecks: list[str] = []
    for ing_id in relevant_ing_ids:
        ing = ing_map.get(ing_id, {"name": ing_id, "unit": "kg", "stock_qty": 0.0})
        avail = float(ing.get("stock_qty", 0.0))
        used_max = round(ing_usage[ing_id], 2)
        used_init = round(ing_init_usage[ing_id], 2)
        util_pct = round((used_max / avail) * 100.0, 1) if avail > 0 else (100.0 if used_max > 0 else 0.0)
        is_bottleneck = util_pct >= 92.0 or (avail <= 0.01 and any(ing_id in it.get("recipe", {}) for it in items))
        if is_bottleneck:
            bottlenecks.append(ing["name"])
        ing_report.append(
            {
                "ingredient_id": ing_id,
                "name": ing["name"],
                "unit": ing.get("unit", "kg"),
                "available_stock": round(avail, 2),
                "initial_batch_required": used_init,
                "max_with_reserve_required": used_max,
                "utilization_pct": min(100.0, util_pct),
                "is_bottleneck": is_bottleneck,
            }
        )
    ing_report.sort(key=lambda x: x["utilization_pct"], reverse=True)

    waste_saved_kg = max(0.0, total_trad_waste_kg - total_opt_waste_kg)
    waste_reduction_pct = (
        round((waste_saved_kg / total_trad_waste_kg) * 100.0, 1) if total_trad_waste_kg > 0 else 0.0
    )
    cost_saved_inr = round(max(0.0, total_trad_cost - total_opt_expected_cost), 2)
    sufficiency_pct = (
        round(min(100.0, ((total_predicted - total_shortage_risk_servings) / total_predicted) * 100.0), 1)
        if total_predicted > 0
        else 100.0
    )

    return {
        "solver_status": solver_status,
        "batch_cooking_enabled": batch_cooking_enabled,
        "items": plan_items,
        "ingredient_utilization": ing_report,
        "bottleneck_ingredients": bottlenecks,
        "summary": {
            "total_predicted_servings": total_predicted,
            "total_initial_servings": total_opt_initial,
            "total_reserve_servings": total_opt_reserve,
            "total_max_capacity_servings": total_opt_initial + total_opt_reserve,
            "traditional_prep_servings": total_trad_prep,
            "expected_waste_kg_optimized": round(total_opt_waste_kg, 2),
            "expected_waste_kg_traditional": round(total_trad_waste_kg, 2),
            "waste_saved_kg": round(waste_saved_kg, 2),
            "waste_reduction_pct": waste_reduction_pct,
            "estimated_cost_traditional_inr": round(total_trad_cost, 2),
            "estimated_cost_optimized_inr": round(total_opt_expected_cost, 2),
            "cost_saved_inr": cost_saved_inr,
            "co2_saved_kg": round(waste_saved_kg * CO2_KG_PER_KG_FOOD_SAVED, 2),
            "meal_sufficiency_pct": sufficiency_pct,
            "shortage_risk_servings": total_shortage_risk_servings,
        },
    }


def evaluate_food_safety(
    holding_temp_c: float,
    hours_since_cooked: float,
    storage_type: str,
    is_sealed: bool,
    requires_cold_chain: bool,
    item_max_safe_hours: float = 4.0,
) -> dict[str, Any]:
    """Deterministic FSSAI-aligned cooked food safety evaluator."""
    reasons: list[str] = []
    passed = True

    if not is_sealed:
        passed = False
        reasons.append("Container is unsealed / previously served on buffet line")

    if storage_type == "hot_hold":
        max_window = min(MAX_HOT_HOLD_HOURS, item_max_safe_hours)
        if holding_temp_c < SAFE_HOT_TEMP_C:
            passed = False
            reasons.append(f"Hot-hold temperature {holding_temp_c:.1f}°C is below safe 60.0°C threshold")
        else:
            reasons.append(f"Hot-held at {holding_temp_c:.1f}°C (>= {SAFE_HOT_TEMP_C:.0f}°C safe zone)")
    elif storage_type == "chilled":
        max_window = MAX_CHILLED_HOLD_HOURS
        if holding_temp_c > SAFE_CHILLED_TEMP_C:
            passed = False
            reasons.append(f"Chilled temperature {holding_temp_c:.1f}°C exceeds 5.0°C cold-chain limit")
        else:
            reasons.append(f"Chilled at {holding_temp_c:.1f}°C (<= {SAFE_CHILLED_TEMP_C:.0f}°C cold zone)")
    else:
        max_window = 0.5 if requires_cold_chain else MAX_AMBIENT_HOLD_HOURS
        if requires_cold_chain:
            passed = False
            reasons.append("Perishable dairy/chilled dish stored at ambient temperature")

    remaining_hours = round(max(0.0, max_window - hours_since_cooked), 2)
    if hours_since_cooked > max_window:
        passed = False
        reasons.append(
            f"{hours_since_cooked:.1f}h elapsed exceeds {max_window:.1f}h safe window for {storage_type}"
        )
    else:
        reasons.append(f"{remaining_hours:.1f}h remaining in {max_window:.1f}h safe redistribution window")

    if requires_cold_chain and passed:
        reasons.append("Requires cold-chain insulated transport to NGO")

    return {
        "safety_passed": passed,
        "safety_status": "SAFE_FOR_REDISTRIBUTION" if passed else "SAFETY_REJECTED",
        "max_safe_hold_hours": max_window,
        "remaining_safe_hours": remaining_hours,
        "safety_reasons": reasons,
    }


def match_surplus_to_ngos(
    surplus: dict[str, Any],
    ngos: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Scores and ranks NGOs for a given surplus lot based on safety, distance, capacity & reliability."""
    servings = int(surplus.get("servings_available", 0))
    requires_cold = bool(surplus.get("requires_cold_chain", False))
    dietary = surplus.get("dietary_tag", "Veg")
    max_hold = float(surplus.get("max_safe_hold_hours", 4.0))
    elapsed = float(surplus.get("hours_since_cooked", 0.0))
    remaining_h = max(0.0, max_hold - elapsed)
    safety_passed = bool(surplus.get("safety_passed", False))

    candidates: list[dict[str, Any]] = []
    for ngo in ngos:
        dist_km = haversine_km(KITCHEN_LAT, KITCHEN_LON, float(ngo["lat"]), float(ngo["lon"]))
        eta_min = int(round((dist_km / 24.0) * 60.0 + 10))
        eta_hours = eta_min / 60.0

        blockers: list[str] = []
        if not safety_passed:
            blockers.append("Surplus lot failed food-safety inspection")
        if not ngo.get("is_available", False):
            blockers.append("NGO currently unavailable for pickup")
        if servings < int(ngo.get("min_servings", 1)):
            blockers.append(f"Below NGO minimum batch ({ngo['min_servings']} servings)")
        if requires_cold and not ngo.get("has_cold_chain", False):
            blockers.append("Requires cold-chain vehicle (NGO lacks cold chain)")
        if ngo.get("dietary_preference") == "Veg Only" and dietary != "Veg":
            blockers.append("NGO accepts vegetarian meals only")
        if eta_hours + 0.4 > remaining_h:
            blockers.append(f"Transit ETA ({eta_min}m) leaves insufficient safe window ({remaining_h:.1f}h left)")

        compatible = len(blockers) == 0
        allocatable = min(servings, int(ngo.get("max_capacity_servings", 100)))

        # Transparent multi-criteria score (0-100)
        proximity_score = max(0.0, 1.0 - min(dist_km, 25.0) / 25.0)
        coverage_ratio = allocatable / max(servings, 1)
        capacity_score = coverage_ratio * 0.75 + (allocatable / max(int(ngo.get("max_capacity_servings", 100)), 1)) * 0.25
        urgency_score = max(0.0, 1.0 - (eta_hours / max(remaining_h, 0.5))) if remaining_h > 0 else 0.0
        reliability_score = float(ngo.get("reliability_score", 0.9))

        match_score = round(
            (0.35 * proximity_score + 0.25 * capacity_score + 0.20 * urgency_score + 0.20 * reliability_score) * 100.0,
            1,
        )
        if not compatible:
            match_score = round(match_score * 0.25, 1)

        candidates.append(
            {
                "ngo_id": ngo["ngo_id"],
                "name": ngo["name"],
                "org_type": ngo["org_type"],
                "area": ngo["area"],
                "distance_km": dist_km,
                "eta_minutes": eta_min,
                "allocatable_servings": allocatable if compatible else 0,
                "max_capacity_servings": int(ngo["max_capacity_servings"]),
                "has_cold_chain": bool(ngo["has_cold_chain"]),
                "dietary_preference": ngo["dietary_preference"],
                "active_window": ngo["active_window"],
                "reliability_score": reliability_score,
                "contact_person": ngo["contact_person"],
                "phone": ngo["phone"],
                "compatible": compatible,
                "blockers": blockers,
                "match_score": match_score,
            }
        )

    candidates.sort(key=lambda c: (c["compatible"], c["match_score"]), reverse=True)
    return candidates


def optimize_redistribution_assignment(
    surplus_items: list[dict[str, Any]],
    ngos: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Google OR-Tools assignment solver across all active eligible surplus lots and NGOs
    so multiple concurrent surpluses do not overload a single NGO's capacity.
    """
    eligible = [s for s in surplus_items if s.get("status") == "Eligible" and s.get("safety_passed")]
    if not eligible or not ngos:
        return []

    solver = pywraplp.Solver.CreateSolver("SCIP") or pywraplp.Solver.CreateSolver("CBC")
    x: dict[tuple[str, str], Any] = {}
    scores: dict[tuple[str, str], float] = {}
    cand_lookup: dict[tuple[str, str], dict[str, Any]] = {}

    for s in eligible:
        sid = s["surplus_id"]
        cands = match_surplus_to_ngos(s, ngos)
        for c in cands:
            if c["compatible"]:
                nid = c["ngo_id"]
                var = solver.BoolVar(f"assign_{sid}_{nid}")
                x[(sid, nid)] = var
                scores[(sid, nid)] = c["match_score"]
                cand_lookup[(sid, nid)] = c

    # Each surplus lot goes to at most 1 primary NGO
    for s in eligible:
        sid = s["surplus_id"]
        vars_for_s = [x[(sid, n["ngo_id"])] for n in ngos if (sid, n["ngo_id"]) in x]
        if vars_for_s:
            solver.Add(solver.Sum(vars_for_s) <= 1)

    # Respect each NGO's max daily capacity
    for n in ngos:
        nid = n["ngo_id"]
        cap = int(n["max_capacity_servings"])
        vars_for_n = [
            x[(s["surplus_id"], nid)] * min(int(s["servings_available"]), cap)
            for s in eligible
            if (s["surplus_id"], nid) in x
        ]
        if vars_for_n:
            solver.Add(solver.Sum(vars_for_n) <= cap)

    objective = solver.Objective()
    for key, var in x.items():
        objective.SetCoefficient(var, scores[key])
    objective.SetMaximization()
    solver.Solve()

    recommendations: list[dict[str, Any]] = []
    for s in eligible:
        sid = s["surplus_id"]
        chosen_cand = None
        for n in ngos:
            nid = n["ngo_id"]
            if (sid, nid) in x and x[(sid, nid)].solution_value() > 0.5:
                chosen_cand = cand_lookup[(sid, nid)]
                break
        if chosen_cand is not None:
            recommendations.append(
                {
                    "surplus_id": sid,
                    "menu_item_name": s["menu_item_name"],
                    "servings_available": s["servings_available"],
                    "recommended_ngo": chosen_cand,
                }
            )
    return recommendations

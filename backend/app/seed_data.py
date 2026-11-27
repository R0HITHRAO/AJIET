from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any
import numpy as np

from .auth import hash_password
from .config import KITCHEN_LAT, KITCHEN_LON, KG_PER_SERVING_AVG
from .db import DatabaseManager


INGREDIENTS_SEED: list[dict[str, Any]] = [
    {"ingredient_id": "ing_rice", "name": "Sona Masoori Rice", "unit": "kg", "stock_qty": 240.0, "reorder_level": 60.0, "unit_cost": 54.0, "perishability_days": 180},
    {"ingredient_id": "ing_toor_dal", "name": "Toor Dal", "unit": "kg", "stock_qty": 75.0, "reorder_level": 20.0, "unit_cost": 135.0, "perishability_days": 120},
    {"ingredient_id": "ing_wheat", "name": "Whole Wheat Atta", "unit": "kg", "stock_qty": 160.0, "reorder_level": 40.0, "unit_cost": 46.0, "perishability_days": 90},
    {"ingredient_id": "ing_paneer", "name": "Fresh Paneer", "unit": "kg", "stock_qty": 55.0, "reorder_level": 15.0, "unit_cost": 360.0, "perishability_days": 4},
    {"ingredient_id": "ing_potato", "name": "Potatoes", "unit": "kg", "stock_qty": 110.0, "reorder_level": 25.0, "unit_cost": 34.0, "perishability_days": 21},
    {"ingredient_id": "ing_onion", "name": "Onions", "unit": "kg", "stock_qty": 110.0, "reorder_level": 25.0, "unit_cost": 38.0, "perishability_days": 21},
    {"ingredient_id": "ing_tomato", "name": "Tomatoes", "unit": "kg", "stock_qty": 90.0, "reorder_level": 22.0, "unit_cost": 42.0, "perishability_days": 6},
    {"ingredient_id": "ing_mixed_veg", "name": "Seasonal Mixed Vegetables", "unit": "kg", "stock_qty": 120.0, "reorder_level": 28.0, "unit_cost": 65.0, "perishability_days": 4},
    {"ingredient_id": "ing_oil", "name": "Cold-Pressed Cooking Oil", "unit": "L", "stock_qty": 68.0, "reorder_level": 18.0, "unit_cost": 148.0, "perishability_days": 180},
    {"ingredient_id": "ing_curd", "name": "Fresh Curd / Yogurt", "unit": "L", "stock_qty": 85.0, "reorder_level": 18.0, "unit_cost": 62.0, "perishability_days": 3},
    {"ingredient_id": "ing_idli_batter", "name": "Fermented Idli/Dosa Batter", "unit": "kg", "stock_qty": 150.0, "reorder_level": 35.0, "unit_cost": 58.0, "perishability_days": 2},
    {"ingredient_id": "ing_poha", "name": "Flattened Rice (Poha)", "unit": "kg", "stock_qty": 55.0, "reorder_level": 15.0, "unit_cost": 52.0, "perishability_days": 90},
    {"ingredient_id": "ing_rava", "name": "Bombay Rava (Sooji)", "unit": "kg", "stock_qty": 50.0, "reorder_level": 15.0, "unit_cost": 56.0, "perishability_days": 90},
    {"ingredient_id": "ing_coconut", "name": "Grated Coconut", "unit": "kg", "stock_qty": 45.0, "reorder_level": 12.0, "unit_cost": 120.0, "perishability_days": 3},
    {"ingredient_id": "ing_spices", "name": "Masala & Whole Spices", "unit": "kg", "stock_qty": 28.0, "reorder_level": 6.0, "unit_cost": 420.0, "perishability_days": 180},
    {"ingredient_id": "ing_milk", "name": "Toned Milk", "unit": "L", "stock_qty": 115.0, "reorder_level": 25.0, "unit_cost": 54.0, "perishability_days": 2},
    {"ingredient_id": "ing_sugar", "name": "Cane Sugar / Jaggery", "unit": "kg", "stock_qty": 45.0, "reorder_level": 12.0, "unit_cost": 48.0, "perishability_days": 180},
    {"ingredient_id": "ing_besan", "name": "Gram Flour (Besan)", "unit": "kg", "stock_qty": 42.0, "reorder_level": 10.0, "unit_cost": 88.0, "perishability_days": 90},
]

MENU_ITEMS_SEED: list[dict[str, Any]] = [
    {
        "menu_item_id": "item_idli_sambar",
        "name": "Idli & Udupi Sambar",
        "meal_slot": "Breakfast",
        "category": "South Indian Staple",
        "dietary_tag": "Veg",
        "popularity_score": 0.86,
        "uptake_rate": 0.84,
        "batch_size": 40,
        "min_initial_ratio": 0.65,
        "cost_per_serving": 22.0,
        "waste_penalty": 26.0,
        "shortage_penalty": 48.0,
        "serving_weight_kg": 0.28,
        "requires_cold_chain": False,
        "max_safe_hold_hours": 4.0,
        "rain_affinity": 1.08,
        "heat_affinity": 0.96,
        "recipe": {"ing_idli_batter": 0.14, "ing_toor_dal": 0.03, "ing_mixed_veg": 0.04, "ing_coconut": 0.02, "ing_spices": 0.006},
    },
    {
        "menu_item_id": "item_masala_dosa",
        "name": "Crispy Masala Dosa",
        "meal_slot": "Breakfast",
        "category": "South Indian Special",
        "dietary_tag": "Veg",
        "popularity_score": 0.92,
        "uptake_rate": 0.89,
        "batch_size": 30,
        "min_initial_ratio": 0.60,
        "cost_per_serving": 28.0,
        "waste_penalty": 30.0,
        "shortage_penalty": 56.0,
        "serving_weight_kg": 0.26,
        "requires_cold_chain": False,
        "max_safe_hold_hours": 3.5,
        "rain_affinity": 1.12,
        "heat_affinity": 0.95,
        "recipe": {"ing_idli_batter": 0.13, "ing_potato": 0.08, "ing_onion": 0.03, "ing_oil": 0.015, "ing_coconut": 0.02},
    },
    {
        "menu_item_id": "item_poha",
        "name": "Kanda Poha & Chutney",
        "meal_slot": "Breakfast",
        "category": "Light Breakfast",
        "dietary_tag": "Veg",
        "popularity_score": 0.72,
        "uptake_rate": 0.68,
        "batch_size": 35,
        "min_initial_ratio": 0.65,
        "cost_per_serving": 18.0,
        "waste_penalty": 22.0,
        "shortage_penalty": 40.0,
        "serving_weight_kg": 0.24,
        "requires_cold_chain": False,
        "max_safe_hold_hours": 4.0,
        "rain_affinity": 1.03,
        "heat_affinity": 1.02,
        "recipe": {"ing_poha": 0.09, "ing_onion": 0.03, "ing_potato": 0.03, "ing_oil": 0.01, "ing_coconut": 0.015},
    },
    {
        "menu_item_id": "item_upma",
        "name": "Veg Rava Upma",
        "meal_slot": "Breakfast",
        "category": "Light Breakfast",
        "dietary_tag": "Veg",
        "popularity_score": 0.64,
        "uptake_rate": 0.59,
        "batch_size": 35,
        "min_initial_ratio": 0.60,
        "cost_per_serving": 19.0,
        "waste_penalty": 23.0,
        "shortage_penalty": 38.0,
        "serving_weight_kg": 0.25,
        "requires_cold_chain": False,
        "max_safe_hold_hours": 4.0,
        "rain_affinity": 1.04,
        "heat_affinity": 0.94,
        "recipe": {"ing_rava": 0.09, "ing_mixed_veg": 0.05, "ing_onion": 0.025, "ing_oil": 0.012, "ing_coconut": 0.015},
    },
    {
        "menu_item_id": "item_steamed_rice",
        "name": "Steamed Sona Masoori Rice",
        "meal_slot": "Lunch",
        "category": "Main Grain",
        "dietary_tag": "Veg",
        "popularity_score": 0.94,
        "uptake_rate": 0.91,
        "batch_size": 50,
        "min_initial_ratio": 0.70,
        "cost_per_serving": 16.0,
        "waste_penalty": 20.0,
        "shortage_penalty": 52.0,
        "serving_weight_kg": 0.32,
        "requires_cold_chain": False,
        "max_safe_hold_hours": 4.5,
        "rain_affinity": 1.01,
        "heat_affinity": 1.00,
        "recipe": {"ing_rice": 0.11},
    },
    {
        "menu_item_id": "item_dal_sambar",
        "name": "Dal Tadka & Drumstick Sambar",
        "meal_slot": "Lunch",
        "category": "Protein Gravy",
        "dietary_tag": "Veg",
        "popularity_score": 0.89,
        "uptake_rate": 0.85,
        "batch_size": 45,
        "min_initial_ratio": 0.68,
        "cost_per_serving": 24.0,
        "waste_penalty": 26.0,
        "shortage_penalty": 52.0,
        "serving_weight_kg": 0.28,
        "requires_cold_chain": False,
        "max_safe_hold_hours": 4.0,
        "rain_affinity": 1.09,
        "heat_affinity": 0.96,
        "recipe": {"ing_toor_dal": 0.055, "ing_tomato": 0.04, "ing_onion": 0.03, "ing_mixed_veg": 0.04, "ing_spices": 0.008},
    },
    {
        "menu_item_id": "item_paneer_curry",
        "name": "Paneer Butter Masala",
        "meal_slot": "Lunch",
        "category": "Special Curry",
        "dietary_tag": "Veg",
        "popularity_score": 0.93,
        "uptake_rate": 0.88,
        "batch_size": 30,
        "min_initial_ratio": 0.62,
        "cost_per_serving": 46.0,
        "waste_penalty": 48.0,
        "shortage_penalty": 72.0,
        "serving_weight_kg": 0.25,
        "requires_cold_chain": True,
        "max_safe_hold_hours": 4.0,
        "rain_affinity": 1.06,
        "heat_affinity": 0.97,
        "recipe": {"ing_paneer": 0.065, "ing_tomato": 0.06, "ing_onion": 0.04, "ing_oil": 0.015, "ing_spices": 0.01},
    },
    {
        "menu_item_id": "item_curd_rice",
        "name": "Tempered Curd Rice",
        "meal_slot": "Lunch",
        "category": "Cooling Staple",
        "dietary_tag": "Veg",
        "popularity_score": 0.78,
        "uptake_rate": 0.72,
        "batch_size": 35,
        "min_initial_ratio": 0.60,
        "cost_per_serving": 21.0,
        "waste_penalty": 25.0,
        "shortage_penalty": 42.0,
        "serving_weight_kg": 0.29,
        "requires_cold_chain": True,
        "max_safe_hold_hours": 6.0,
        "rain_affinity": 0.84,
        "heat_affinity": 1.18,
        "recipe": {"ing_rice": 0.08, "ing_curd": 0.09, "ing_oil": 0.006, "ing_spices": 0.003},
    },
    {
        "menu_item_id": "item_veg_biryani",
        "name": "Hyderabadi Veg Biryani",
        "meal_slot": "Lunch",
        "category": "One-Pot Special",
        "dietary_tag": "Veg",
        "popularity_score": 0.95,
        "uptake_rate": 0.92,
        "batch_size": 40,
        "min_initial_ratio": 0.65,
        "cost_per_serving": 38.0,
        "waste_penalty": 40.0,
        "shortage_penalty": 68.0,
        "serving_weight_kg": 0.36,
        "requires_cold_chain": False,
        "max_safe_hold_hours": 4.0,
        "rain_affinity": 1.11,
        "heat_affinity": 0.96,
        "recipe": {"ing_rice": 0.11, "ing_mixed_veg": 0.09, "ing_onion": 0.04, "ing_curd": 0.03, "ing_spices": 0.012},
    },
    {
        "menu_item_id": "item_veg_cutlet",
        "name": "Crispy Veg Cutlet & Mint Dip",
        "meal_slot": "Snacks",
        "category": "Evening Snack",
        "dietary_tag": "Veg",
        "popularity_score": 0.82,
        "uptake_rate": 0.74,
        "batch_size": 30,
        "min_initial_ratio": 0.60,
        "cost_per_serving": 20.0,
        "waste_penalty": 24.0,
        "shortage_penalty": 40.0,
        "serving_weight_kg": 0.18,
        "requires_cold_chain": False,
        "max_safe_hold_hours": 4.0,
        "rain_affinity": 1.18,
        "heat_affinity": 0.90,
        "recipe": {"ing_potato": 0.08, "ing_mixed_veg": 0.05, "ing_besan": 0.03, "ing_oil": 0.018, "ing_spices": 0.005},
    },
    {
        "menu_item_id": "item_buns_tea",
        "name": "Mangalore Buns & Filter Chai",
        "meal_slot": "Snacks",
        "category": "Regional Snack",
        "dietary_tag": "Veg",
        "popularity_score": 0.88,
        "uptake_rate": 0.80,
        "batch_size": 35,
        "min_initial_ratio": 0.60,
        "cost_per_serving": 22.0,
        "waste_penalty": 24.0,
        "shortage_penalty": 44.0,
        "serving_weight_kg": 0.22,
        "requires_cold_chain": False,
        "max_safe_hold_hours": 5.0,
        "rain_affinity": 1.16,
        "heat_affinity": 0.92,
        "recipe": {"ing_wheat": 0.07, "ing_milk": 0.09, "ing_sugar": 0.025, "ing_oil": 0.015},
    },
    {
        "menu_item_id": "item_pakora",
        "name": "Onion Pakora & Tamarind Chutney",
        "meal_slot": "Snacks",
        "category": "Evening Snack",
        "dietary_tag": "Veg",
        "popularity_score": 0.79,
        "uptake_rate": 0.71,
        "batch_size": 30,
        "min_initial_ratio": 0.58,
        "cost_per_serving": 18.0,
        "waste_penalty": 22.0,
        "shortage_penalty": 38.0,
        "serving_weight_kg": 0.17,
        "requires_cold_chain": False,
        "max_safe_hold_hours": 4.0,
        "rain_affinity": 1.24,
        "heat_affinity": 0.86,
        "recipe": {"ing_besan": 0.06, "ing_onion": 0.07, "ing_oil": 0.02, "ing_spices": 0.005},
    },
    {
        "menu_item_id": "item_chapati",
        "name": "Soft Whole-Wheat Chapati",
        "meal_slot": "Dinner",
        "category": "Main Grain",
        "dietary_tag": "Veg",
        "popularity_score": 0.90,
        "uptake_rate": 0.86,
        "batch_size": 45,
        "min_initial_ratio": 0.65,
        "cost_per_serving": 17.0,
        "waste_penalty": 20.0,
        "shortage_penalty": 48.0,
        "serving_weight_kg": 0.24,
        "requires_cold_chain": False,
        "max_safe_hold_hours": 4.5,
        "rain_affinity": 1.04,
        "heat_affinity": 0.98,
        "recipe": {"ing_wheat": 0.10, "ing_oil": 0.006},
    },
    {
        "menu_item_id": "item_mixed_veg_curry",
        "name": "Kadai Mixed Veg Curry",
        "meal_slot": "Dinner",
        "category": "Vegetable Side",
        "dietary_tag": "Veg",
        "popularity_score": 0.81,
        "uptake_rate": 0.77,
        "batch_size": 40,
        "min_initial_ratio": 0.65,
        "cost_per_serving": 28.0,
        "waste_penalty": 30.0,
        "shortage_penalty": 54.0,
        "serving_weight_kg": 0.26,
        "requires_cold_chain": False,
        "max_safe_hold_hours": 4.0,
        "rain_affinity": 1.05,
        "heat_affinity": 0.97,
        "recipe": {"ing_mixed_veg": 0.11, "ing_tomato": 0.045, "ing_onion": 0.035, "ing_oil": 0.012, "ing_spices": 0.008},
    },
    {
        "menu_item_id": "item_veg_pulao",
        "name": "Jeera Peas Veg Pulao",
        "meal_slot": "Dinner",
        "category": "Rice Special",
        "dietary_tag": "Veg",
        "popularity_score": 0.85,
        "uptake_rate": 0.82,
        "batch_size": 40,
        "min_initial_ratio": 0.65,
        "cost_per_serving": 30.0,
        "waste_penalty": 32.0,
        "shortage_penalty": 58.0,
        "serving_weight_kg": 0.33,
        "requires_cold_chain": False,
        "max_safe_hold_hours": 4.0,
        "rain_affinity": 1.07,
        "heat_affinity": 0.97,
        "recipe": {"ing_rice": 0.10, "ing_mixed_veg": 0.06, "ing_onion": 0.025, "ing_oil": 0.01, "ing_spices": 0.007},
    },
    {
        "menu_item_id": "item_kheer",
        "name": "Vermicelli Payasam / Kheer",
        "meal_slot": "Dinner",
        "category": "Dessert",
        "dietary_tag": "Veg",
        "popularity_score": 0.87,
        "uptake_rate": 0.79,
        "batch_size": 30,
        "min_initial_ratio": 0.60,
        "cost_per_serving": 25.0,
        "waste_penalty": 30.0,
        "shortage_penalty": 45.0,
        "serving_weight_kg": 0.18,
        "requires_cold_chain": True,
        "max_safe_hold_hours": 8.0,
        "rain_affinity": 1.02,
        "heat_affinity": 1.08,
        "recipe": {"ing_milk": 0.12, "ing_sugar": 0.035, "ing_rava": 0.025},
    },
]

NGOS_SEED: list[dict[str, Any]] = [
    {
        "ngo_id": "ngo_udupi_seva",
        "name": "Udupi Annakshetra Seva Trust",
        "org_type": "Charitable Trust",
        "area": "Udupi City",
        "lat": 13.3409,
        "lon": 74.7421,
        "min_servings": 25,
        "max_capacity_servings": 300,
        "has_cold_chain": True,
        "dietary_preference": "Veg Only",
        "active_window": "07:00 - 22:00",
        "is_available": True,
        "contact_person": "Raghavendra Bhat",
        "phone": "+91 98451 22310",
        "reliability_score": 0.97,
    },
    {
        "ngo_id": "ngo_bantakal_care",
        "name": "Bantakal Grama Sneha Shelter",
        "org_type": "Community Shelter",
        "area": "Bantakal",
        "lat": 13.2612,
        "lon": 74.7924,
        "min_servings": 15,
        "max_capacity_servings": 160,
        "has_cold_chain": False,
        "dietary_preference": "Any",
        "active_window": "08:00 - 21:30",
        "is_available": True,
        "contact_person": "Sunitha Shetty",
        "phone": "+91 99002 44812",
        "reliability_score": 0.95,
    },
    {
        "ngo_id": "ngo_manipal_robin",
        "name": "Manipal Robin Hood Food Brigade",
        "org_type": "NGO",
        "area": "Manipal",
        "lat": 13.3525,
        "lon": 74.7868,
        "min_servings": 30,
        "max_capacity_servings": 350,
        "has_cold_chain": True,
        "dietary_preference": "Any",
        "active_window": "09:00 - 23:00",
        "is_available": True,
        "contact_person": "Aarav Kamath",
        "phone": "+91 97412 66109",
        "reliability_score": 0.96,
    },
    {
        "ngo_id": "ngo_kaup_ashram",
        "name": "Kaup Senior Care & Orphanage",
        "org_type": "Charitable Trust",
        "area": "Kaup",
        "lat": 13.2230,
        "lon": 74.7458,
        "min_servings": 20,
        "max_capacity_servings": 180,
        "has_cold_chain": True,
        "dietary_preference": "Veg Only",
        "active_window": "07:30 - 20:30",
        "is_available": True,
        "contact_person": "Meenakshi Rao",
        "phone": "+91 94482 11904",
        "reliability_score": 0.94,
    },
    {
        "ngo_id": "ngo_shirva_foodbank",
        "name": "Shirva Coastal Food Bank",
        "org_type": "Food Bank",
        "area": "Shirva",
        "lat": 13.2371,
        "lon": 74.8194,
        "min_servings": 35,
        "max_capacity_servings": 420,
        "has_cold_chain": True,
        "dietary_preference": "Any",
        "active_window": "06:30 - 22:00",
        "is_available": True,
        "contact_person": "Joseph D'Souza",
        "phone": "+91 98804 77230",
        "reliability_score": 0.93,
    },
    {
        "ngo_id": "ngo_katapady_aid",
        "name": "Katapady Youth Hunger Relief",
        "org_type": "NGO",
        "area": "Katapady",
        "lat": 13.2748,
        "lon": 74.7486,
        "min_servings": 15,
        "max_capacity_servings": 140,
        "has_cold_chain": False,
        "dietary_preference": "Any",
        "active_window": "10:00 - 21:00",
        "is_available": True,
        "contact_person": "Prashanth Poojary",
        "phone": "+91 96118 33091",
        "reliability_score": 0.90,
    },
    {
        "ngo_id": "ngo_karkala_mission",
        "name": "Karkala Community Kitchen Network",
        "org_type": "Food Bank",
        "area": "Karkala",
        "lat": 13.2156,
        "lon": 74.9977,
        "min_servings": 50,
        "max_capacity_servings": 500,
        "has_cold_chain": True,
        "dietary_preference": "Any",
        "active_window": "08:00 - 20:00",
        "is_available": False,
        "contact_person": "Harish Hegde",
        "phone": "+91 94801 88512",
        "reliability_score": 0.89,
    },
]


def _weather_for_day(rng: np.random.Generator, day_idx: int) -> tuple[str, float]:
    r = rng.random()
    if r < 0.28:
        return "Rainy", float(round(24.0 + rng.normal(0, 1.5), 1))
    if r < 0.56:
        return "Cloudy", float(round(27.5 + rng.normal(0, 1.8), 1))
    if r < 0.80:
        return "Humid", float(round(30.5 + rng.normal(0, 1.6), 1))
    return "Sunny", float(round(33.0 + rng.normal(0, 1.8), 1))


def generate_historical_meal_logs(days: int = 90) -> list[dict[str, Any]]:
    rng = np.random.default_rng(42)
    today = date(2026, 11, 27)
    start = today - timedelta(days=days)

    slot_base_attendance = {
        "Breakfast": 610,
        "Lunch": 740,
        "Snacks": 520,
        "Dinner": 690,
    }
    special_events = ["None"] * 18 + ["Exam Week", "Tech Fest", "Sports Day", "Hackathon", "Parent Meet"]
    items_by_slot: dict[str, list[dict[str, Any]]] = {}
    for item in MENU_ITEMS_SEED:
        items_by_slot.setdefault(item["meal_slot"], []).append(item)

    logs: list[dict[str, Any]] = []
    # Track 7-day rolling served per menu item for realistic lag features
    rolling_history: dict[str, list[int]] = {m["menu_item_id"]: [] for m in MENU_ITEMS_SEED}

    for day_offset in range(days):
        curr_date = start + timedelta(days=day_offset)
        date_str = curr_date.isoformat()
        dow = curr_date.weekday()
        is_weekend = dow >= 5
        is_holiday = bool((dow == 6 and day_offset % 14 == 0) or day_offset in (18, 43, 67))
        event = "None"
        if not is_holiday and day_offset % 19 == 4:
            event = str(rng.choice(["Exam Week", "Tech Fest", "Sports Day", "Hackathon", "Parent Meet"]))

        weather, temp_c = _weather_for_day(rng, day_offset)

        for slot in ("Breakfast", "Lunch", "Snacks", "Dinner"):
            base_att = slot_base_attendance[slot]
            # Realistic attendance pattern
            day_factor = 0.78 if is_weekend else (0.95 if dow == 4 else 1.02)
            if is_holiday:
                day_factor *= 0.62
            if event in ("Tech Fest", "Hackathon", "Parent Meet"):
                day_factor *= 1.24
            elif event == "Sports Day":
                day_factor *= 1.14
            elif event == "Exam Week":
                day_factor *= 1.07

            expected_att = int(round(base_att * day_factor + rng.normal(0, 14)))
            weather_turnout = 0.93 if weather == "Rainy" and slot in ("Breakfast", "Snacks") else (1.03 if event != "None" else 1.0)
            actual_att = max(80, int(round(expected_att * weather_turnout + rng.normal(0, expected_att * 0.045))))

            slot_items = items_by_slot[slot]
            for item in slot_items:
                mid = item["menu_item_id"]
                aff = 1.0
                if weather == "Rainy":
                    aff = item["rain_affinity"]
                elif temp_c >= 31.5:
                    aff = item["heat_affinity"]

                # Slight day-of-week & event effect on uptake
                event_boost = 1.08 if event in ("Tech Fest", "Hackathon") else (0.94 if event == "Exam Week" and slot == "Snacks" else 1.0)
                dow_wave = 1.0 + 0.04 * np.sin((dow + 1) * 0.9)
                demand_raw = actual_att * item["uptake_rate"] * aff * event_boost * dow_wave
                served = max(20, int(round(demand_raw + rng.normal(0, max(8.0, demand_raw * 0.035)))))

                # Traditional single-batch kitchens over-prepared by ~14% on average (higher waste on weekends/rain)
                traditional_buffer = 1.16 if not is_weekend else 1.24
                if weather == "Rainy":
                    traditional_buffer += 0.05
                prepared = int(round(expected_att * item["uptake_rate"] * traditional_buffer + rng.normal(0, 10)))
                prepared = max(served, prepared) if rng.random() > 0.08 else max(25, int(served * 0.94))
                leftover = max(0, prepared - served)
                shortage = max(0, served - prepared) if prepared < served else 0

                hist_list = rolling_history[mid]
                rolling_7d = float(np.mean(hist_list[-7:])) if hist_list else float(served)
                hist_list.append(served)

                logs.append(
                    {
                        "log_id": f"log_{date_str}_{slot.lower()}_{mid}",
                        "date": date_str,
                        "meal_slot": slot,
                        "menu_item_id": mid,
                        "menu_item_name": item["name"],
                        "day_of_week": dow,
                        "is_weekend": is_weekend,
                        "is_holiday": is_holiday,
                        "special_event": event,
                        "weather": weather,
                        "temperature_c": temp_c,
                        "expected_attendance": expected_att,
                        "actual_attendance": actual_att,
                        "prepared_servings": prepared,
                        "served_servings": served,
                        "leftover_servings": leftover,
                        "shortage_servings": shortage,
                        "rolling_7d_served": round(rolling_7d, 1),
                        "source": "historical_seed",
                    }
                )
    return logs


def generate_initial_surplus_and_redistributions() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    now = datetime(2026, 11, 27, 11, 0, 0)
    surplus = [
        {
            "surplus_id": "surp_veg_biryani_01",
            "menu_item_id": "item_veg_biryani",
            "menu_item_name": "Hyderabadi Veg Biryani",
            "meal_slot": "Lunch",
            "dietary_tag": "Veg",
            "servings_available": 110,
            "weight_kg": round(110 * 0.36, 1),
            "holding_temp_c": 66.5,
            "hours_since_cooked": 0.9,
            "max_safe_hold_hours": 4.0,
            "storage_type": "hot_hold",
            "requires_cold_chain": False,
            "is_sealed": True,
            "safety_passed": True,
            "safety_status": "SAFE_FOR_REDISTRIBUTION",
            "safety_reasons": [
                "Hot-held at 66.5°C (>= 60°C FSSAI safe zone)",
                "0.9h elapsed vs 4.0h max safe window (3.1h remaining)",
                "Unserved sealed gastronorm container",
            ],
            "status": "Eligible",
            "created_at": (now - timedelta(minutes=25)).isoformat(),
            "notes": "Excess reserve batch from Hostel Block B dining",
        },
        {
            "surplus_id": "surp_paneer_02",
            "menu_item_id": "item_paneer_curry",
            "menu_item_name": "Paneer Butter Masala",
            "meal_slot": "Lunch",
            "dietary_tag": "Veg",
            "servings_available": 65,
            "weight_kg": round(65 * 0.25, 1),
            "holding_temp_c": 3.8,
            "hours_since_cooked": 1.4,
            "max_safe_hold_hours": 24.0,
            "storage_type": "chilled",
            "requires_cold_chain": True,
            "is_sealed": True,
            "safety_passed": True,
            "safety_status": "SAFE_FOR_REDISTRIBUTION",
            "safety_reasons": [
                "Blast-chilled to 3.8°C (<= 5°C safe cold storage)",
                "Requires cold-chain vehicle during NGO transit",
                "Sealed food-grade cambro container",
            ],
            "status": "Eligible",
            "created_at": (now - timedelta(minutes=18)).isoformat(),
            "notes": "Dairy-rich gravy; prioritize cold-chain NGO within 15 km",
        },
        {
            "surplus_id": "surp_idli_sambar_03",
            "menu_item_id": "item_idli_sambar",
            "menu_item_name": "Idli & Udupi Sambar",
            "meal_slot": "Breakfast",
            "dietary_tag": "Veg",
            "servings_available": 85,
            "weight_kg": round(85 * 0.28, 1),
            "holding_temp_c": 62.0,
            "hours_since_cooked": 1.6,
            "max_safe_hold_hours": 4.0,
            "storage_type": "hot_hold",
            "requires_cold_chain": False,
            "is_sealed": True,
            "safety_passed": True,
            "safety_status": "SAFE_FOR_REDISTRIBUTION",
            "safety_reasons": [
                "Hot-held at 62.0°C (>= 60°C safe threshold)",
                "2.4h remaining in safe distribution window",
                "Sealed stainless steel catering pan",
            ],
            "status": "Eligible",
            "created_at": (now - timedelta(minutes=12)).isoformat(),
            "notes": "Morning breakfast surplus due to rainy-day drop in turnout",
        },
        {
            "surplus_id": "surp_curd_rice_unsafe",
            "menu_item_id": "item_curd_rice",
            "menu_item_name": "Tempered Curd Rice",
            "meal_slot": "Dinner",
            "dietary_tag": "Veg",
            "servings_available": 45,
            "weight_kg": round(45 * 0.29, 1),
            "holding_temp_c": 29.5,
            "hours_since_cooked": 5.2,
            "max_safe_hold_hours": 2.0,
            "storage_type": "ambient",
            "requires_cold_chain": True,
            "is_sealed": False,
            "safety_passed": False,
            "safety_status": "SAFETY_REJECTED",
            "safety_reasons": [
                "Held at ambient 29.5°C for 5.2h (exceeds 2.0h danger-zone limit)",
                "Unsealed dairy dish — blocked from human redistribution (compost/biogas route)",
            ],
            "status": "Rejected (Safety)",
            "created_at": (now - timedelta(hours=1)).isoformat(),
            "notes": "Automatically diverted to campus biogas digester",
        },
    ]

    redistributions = [
        {
            "redistribution_id": "redist_hist_01",
            "surplus_id": "surp_hist_01",
            "menu_item_name": "Dal Tadka & Drumstick Sambar",
            "ngo_id": "ngo_bantakal_care",
            "ngo_name": "Bantakal Grama Sneha Shelter",
            "servings_delivered": 95,
            "weight_kg": round(95 * 0.28, 1),
            "distance_km": 1.0,
            "match_score": 96.4,
            "transport_mode": "Kitchen E-Cargo",
            "status": "Delivered",
            "created_at": (now - timedelta(days=1)).isoformat(),
        },
        {
            "redistribution_id": "redist_hist_02",
            "surplus_id": "surp_hist_02",
            "menu_item_name": "Steamed Sona Masoori Rice",
            "ngo_id": "ngo_udupi_seva",
            "ngo_name": "Udupi Annakshetra Seva Trust",
            "servings_delivered": 140,
            "weight_kg": round(140 * 0.32, 1),
            "distance_km": 10.6,
            "match_score": 91.2,
            "transport_mode": "NGO Pickup Van",
            "status": "Delivered",
            "created_at": (now - timedelta(days=2)).isoformat(),
        },
        {
            "redistribution_id": "redist_hist_03",
            "surplus_id": "surp_hist_03",
            "menu_item_name": "Jeera Peas Veg Pulao",
            "ngo_id": "ngo_manipal_robin",
            "ngo_name": "Manipal Robin Hood Food Brigade",
            "servings_delivered": 120,
            "weight_kg": round(120 * 0.33, 1),
            "distance_km": 10.8,
            "match_score": 92.5,
            "transport_mode": "NGO Pickup Van",
            "status": "Delivered",
            "created_at": (now - timedelta(days=3)).isoformat(),
        },
        {
            "redistribution_id": "redist_hist_04",
            "surplus_id": "surp_hist_04",
            "menu_item_name": "Soft Whole-Wheat Chapati",
            "ngo_id": "ngo_katapady_aid",
            "ngo_name": "Katapady Youth Hunger Relief",
            "servings_delivered": 75,
            "weight_kg": round(75 * 0.24, 1),
            "distance_km": 4.5,
            "match_score": 93.8,
            "transport_mode": "Volunteer Cold-Box",
            "status": "Delivered",
            "created_at": (now - timedelta(days=4)).isoformat(),
        },
        {
            "redistribution_id": "redist_hist_05",
            "surplus_id": "surp_hist_05",
            "menu_item_name": "Hyderabadi Veg Biryani",
            "ngo_id": "ngo_shirva_foodbank",
            "ngo_name": "Shirva Coastal Food Bank",
            "servings_delivered": 180,
            "weight_kg": round(180 * 0.36, 1),
            "distance_km": 4.3,
            "match_score": 94.7,
            "transport_mode": "NGO Pickup Van",
            "status": "Delivered",
            "created_at": (now - timedelta(days=5)).isoformat(),
        },
    ]
    return surplus, redistributions


def ensure_seeded(db: DatabaseManager, force: bool = False) -> dict[str, int]:
    if force:
        for name in db.COLLECTIONS:
            db.collection(name).delete_many({})

    counts: dict[str, int] = {}
    if db.collection("ingredients").count_documents() == 0:
        db.collection("ingredients").insert_many(INGREDIENTS_SEED)
    counts["ingredients"] = db.collection("ingredients").count_documents()

    if db.collection("menu_items").count_documents() == 0:
        db.collection("menu_items").insert_many(MENU_ITEMS_SEED)
    counts["menu_items"] = db.collection("menu_items").count_documents()

    if db.collection("ngos").count_documents() == 0:
        db.collection("ngos").insert_many(NGOS_SEED)
    counts["ngos"] = db.collection("ngos").count_documents()

    if db.collection("meal_logs").count_documents() == 0:
        db.collection("meal_logs").insert_many(generate_historical_meal_logs(days=90))
    counts["meal_logs"] = db.collection("meal_logs").count_documents()

    if db.collection("surplus_items").count_documents() == 0 and db.collection("redistributions").count_documents() == 0:
        surplus, redistributions = generate_initial_surplus_and_redistributions()
        db.collection("surplus_items").insert_many(surplus)
        db.collection("redistributions").insert_many(redistributions)
    counts["surplus_items"] = db.collection("surplus_items").count_documents()
    counts["redistributions"] = db.collection("redistributions").count_documents()

    if db.collection("users").count_documents() == 0:
        db.collection("users").insert_many(
            [
                {
                    "user_id": "user_demo_manager",
                    "name": "Rohith Rao",
                    "email": "manager@nourishai.edu",
                    "password_hash": hash_password("Codeverse@2026"),
                    "role": "Kitchen Manager",
                    "organization": "SMVITM Central Kitchen",
                    "created_at": "2026-11-27T09:00:00",
                }
            ]
        )
    counts["users"] = db.collection("users").count_documents()
    return counts

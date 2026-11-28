from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.ml_engine import DemandForecastEngine


def test_rolling_feature_uses_only_prior_dates():
    engine = DemandForecastEngine()
    logs = [
        {
            "date": "2026-01-05",
            "meal_slot": "Lunch",
            "menu_item_id": "dish_a",
            "expected_attendance": 100,
            "served_servings": 70,
        },
        {
            "date": "2026-01-05",
            "meal_slot": "Lunch",
            "menu_item_id": "dish_b",
            "expected_attendance": 100,
            "served_servings": 80,
        },
        {
            "date": "2026-01-12",
            "meal_slot": "Lunch",
            "menu_item_id": "dish_a",
            "expected_attendance": 200,
            "served_servings": 150,
        },
    ]
    menu = {
        "dish_a": {"uptake_rate": 0.5},
        "dish_b": {"uptake_rate": 0.6},
    }

    frame = engine._build_dataframe(logs, menu)

    assert frame.loc[0, "rolling_7d_served"] == 50
    assert frame.loc[1, "rolling_7d_served"] == 60
    assert frame.loc[2, "rolling_7d_served"] == 70


def test_expanding_splits_keep_all_rows_from_a_date_together():
    splits = DemandForecastEngine._date_splits([f"2026-01-{day:02d}" for day in range(1, 13)])

    assert len(splits) == 5
    for train_dates, validation_dates in splits:
        assert set(train_dates).isdisjoint(validation_dates)
        assert max(train_dates) < min(validation_dates)


def test_baseline_uses_recent_same_dish_and_weekday_average():
    train = pd.DataFrame(
        [
            {"date": "2026-01-05", "menu_item_id": "dish_a", "day_of_week": 0, "expected_attendance": 100, "served_servings": 100},
            {"date": "2026-01-06", "menu_item_id": "dish_a", "day_of_week": 1, "expected_attendance": 100, "served_servings": 500},
            {"date": "2026-01-12", "menu_item_id": "dish_a", "day_of_week": 0, "expected_attendance": 100, "served_servings": 120},
        ]
    )
    test = pd.DataFrame(
        [{"date": "2026-01-19", "menu_item_id": "dish_a", "day_of_week": 0, "expected_attendance": 200}]
    )

    prediction = DemandForecastEngine._baseline_predictions(train, test)

    assert prediction.tolist() == [220.0]


def test_optimal_model_choice_picks_best_reliable_slot_model():
    engine = DemandForecastEngine()
    engine.metrics = {
        "ensemble": {"mae": 25.0},
        "xgboost": {"mae": 25.5},
        "random_forest": {"mae": 25.8},
        "validation": {
            "selected_model": "ensemble",
            "reliable_ml_models": {"ensemble": True, "xgboost": True, "random_forest": True},
            "by_meal_slot": {
                "ensemble": {"Lunch": {"mae": 27.2}, "Dinner": {"mae": 23.5}, "Snacks": {"mae": 25.8}},
                "xgboost": {"Lunch": {"mae": 27.3}, "Dinner": {"mae": 24.8}, "Snacks": {"mae": 25.2}},
                "random_forest": {"Lunch": {"mae": 28.5}, "Dinner": {"mae": 23.2}, "Snacks": {"mae": 28.4}},
            },
        },
    }

    assert engine._resolve_model_choice("optimal", "Lunch") == "ensemble"
    assert engine._resolve_model_choice("optimal", "Dinner") == "random_forest"
    assert engine._resolve_model_choice("optimal", "Snacks") == "xgboost"

    engine.metrics["validation"]["reliable_ml_models"] = {"ensemble": False, "xgboost": False, "random_forest": False}
    assert engine._resolve_model_choice("optimal", "Lunch") == "baseline"


def test_scenario_impacts_reports_holiday_and_event_deltas():
    logs = [
        {"is_holiday": False, "is_weekend": False, "special_event": "None", "weather": "Sunny", "expected_attendance": 100, "actual_attendance": 100, "served_servings": 100},
        {"is_holiday": True, "is_weekend": False, "special_event": "None", "weather": "Sunny", "expected_attendance": 100, "actual_attendance": 70, "served_servings": 65},
        {"is_holiday": False, "is_weekend": False, "special_event": "Tech Fest", "weather": "Cloudy", "expected_attendance": 100, "actual_attendance": 120, "served_servings": 125},
    ]
    impacts = DemandForecastEngine._compute_scenario_impacts(logs)
    by_name = {item["scenario"]: item for item in impacts}
    assert by_name["Campus Events & Exams"]["delta_label"] == "+25.0% servings"
    assert by_name["Public & Campus Holidays"]["delta_label"] == "-35.0% servings"

from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field


MealSlot = Literal["Breakfast", "Lunch", "Snacks", "Dinner"]
WeatherCondition = Literal["Sunny", "Cloudy", "Rainy", "Humid"]
SpecialEvent = Literal["None", "Exam Week", "Tech Fest", "Sports Day", "Hackathon", "Parent Meet"]
ModelChoice = Literal["ensemble", "xgboost", "random_forest"]
StorageType = Literal["hot_hold", "chilled", "ambient"]


class ForecastRequest(BaseModel):
    date: str = Field(..., description="Target date YYYY-MM-DD")
    meal_slot: MealSlot = "Lunch"
    expected_attendance: int = Field(default=680, ge=20, le=5000)
    is_holiday: bool = False
    special_event: SpecialEvent = "None"
    weather: WeatherCondition = "Cloudy"
    temperature_c: float = Field(default=28.0, ge=5.0, le=48.0)
    model_choice: ModelChoice = "ensemble"
    menu_item_ids: list[str] | None = None


class BatchOptimizationRequest(ForecastRequest):
    waste_penalty_per_serving: float = Field(default=28.0, ge=0.0, le=500.0)
    shortage_penalty_per_serving: float = Field(default=55.0, ge=0.0, le=500.0)
    batch_cooking_enabled: bool = True
    max_initial_ratio: float = Field(default=0.80, ge=0.4, le=1.0)
    ingredient_stock_overrides: dict[str, float] | None = None


class WhatIfSimulationRequest(BaseModel):
    date: str = Field(..., description="Target date YYYY-MM-DD")
    meal_slot: MealSlot = "Lunch"
    base_attendance: int = Field(default=680, ge=20, le=5000)
    attendance_delta_pct: float = Field(default=0.0, ge=-70.0, le=100.0)
    is_holiday: bool = False
    special_event: SpecialEvent = "None"
    weather: WeatherCondition = "Cloudy"
    temperature_c: float = Field(default=28.0, ge=5.0, le=48.0)
    model_choice: ModelChoice = "ensemble"
    batch_cooking_enabled: bool = True
    waste_penalty_per_serving: float = Field(default=28.0, ge=0.0, le=500.0)
    shortage_penalty_per_serving: float = Field(default=55.0, ge=0.0, le=500.0)
    menu_swaps: dict[str, str] = Field(
        default_factory=dict,
        description="Map of original menu_item_id -> replacement menu_item_id",
    )
    ingredient_stock_pct_overrides: dict[str, float] = Field(
        default_factory=dict,
        description="Map of ingredient_id -> percentage of current stock available (0-200)",
    )


class PostMealLogItem(BaseModel):
    menu_item_id: str
    prepared_servings: int = Field(..., ge=0, le=10000)
    served_servings: int = Field(..., ge=0, le=10000)
    predicted_servings: int | None = Field(default=None, ge=0, le=10000)
    holding_temp_c: float = Field(default=64.0, ge=-10.0, le=120.0)
    hours_since_cooked: float = Field(default=1.0, ge=0.0, le=72.0)
    storage_type: StorageType = "hot_hold"
    is_sealed: bool = True
    register_surplus: bool = True


class PostMealLogRequest(BaseModel):
    date: str
    meal_slot: MealSlot
    expected_attendance: int = Field(..., ge=1, le=5000)
    actual_attendance: int = Field(..., ge=1, le=5000)
    is_holiday: bool = False
    special_event: SpecialEvent = "None"
    weather: WeatherCondition = "Cloudy"
    temperature_c: float = Field(default=28.0, ge=5.0, le=48.0)
    items: list[PostMealLogItem]
    auto_retrain: bool = False


class SurplusManualCreateRequest(BaseModel):
    menu_item_id: str
    meal_slot: MealSlot = "Lunch"
    servings_available: int = Field(..., ge=5, le=5000)
    holding_temp_c: float = Field(default=65.0, ge=-10.0, le=120.0)
    hours_since_cooked: float = Field(default=0.8, ge=0.0, le=72.0)
    storage_type: StorageType = "hot_hold"
    is_sealed: bool = True
    notes: str = ""


class RedistributionDispatchRequest(BaseModel):
    surplus_id: str
    ngo_id: str
    servings_allocated: int | None = Field(default=None, ge=1)
    transport_mode: Literal["NGO Pickup Van", "Kitchen E-Cargo", "Volunteer Cold-Box"] = "NGO Pickup Van"
    notes: str = ""


class RedistributionStatusUpdateRequest(BaseModel):
    status: Literal["Dispatched", "In Transit", "Delivered", "Cancelled"]


class IngredientUpdateRequest(BaseModel):
    stock_qty: float = Field(..., ge=0.0, le=100000.0)


class MenuItemCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    meal_slot: MealSlot = "Lunch"
    category: str = Field(default="Custom Special", min_length=2, max_length=60)
    dietary_tag: Literal["Veg", "Non-Veg"] = "Veg"
    batch_size: int = Field(default=35, ge=5, le=500)
    cost_per_serving: float = Field(default=26.0, ge=5.0, le=500.0)
    uptake_rate: float = Field(default=0.75, ge=0.1, le=1.0)
    serving_weight_kg: float = Field(default=0.28, ge=0.05, le=2.0)
    requires_cold_chain: bool = False
    max_safe_hold_hours: float = Field(default=4.0, ge=0.5, le=24.0)
    recipe: dict[str, float] = Field(default_factory=dict)


class NGOCreateRequest(BaseModel):
    name: str
    org_type: Literal["NGO", "Food Bank", "Charitable Trust", "Community Shelter"] = "NGO"
    area: str
    lat: float = Field(..., ge=-90.0, le=90.0)
    lon: float = Field(..., ge=-180.0, le=180.0)
    min_servings: int = Field(default=20, ge=5, le=2000)
    max_capacity_servings: int = Field(default=250, ge=10, le=5000)
    has_cold_chain: bool = False
    dietary_preference: Literal["Any", "Veg Only"] = "Any"
    active_window: str = "08:00 - 21:00"
    is_available: bool = True
    contact_person: str
    phone: str
    reliability_score: float = Field(default=0.92, ge=0.5, le=1.0)

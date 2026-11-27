from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any
import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBRegressor

from .config import ARTIFACTS_DIR
from .db import DatabaseManager

CATEGORICAL_COLS = ["meal_slot", "menu_item_id", "special_event", "weather"]
NUMERIC_COLS = [
    "day_of_week",
    "is_weekend",
    "is_holiday",
    "expected_attendance",
    "temperature_c",
    "rolling_7d_served",
    "popularity_score",
    "uptake_rate",
]

FRIENDLY_FEATURE_MAP = {
    "expected_attendance": "Expected Attendance",
    "uptake_rate": "Dish Uptake Rate",
    "rolling_7d_served": "7-Day Rolling Consumption",
    "popularity_score": "Menu Popularity Score",
    "temperature_c": "Ambient Temperature (°C)",
    "day_of_week": "Day of Week",
    "is_weekend": "Weekend Pattern",
    "is_holiday": "Holiday Indicator",
    "meal_slot": "Meal Slot",
    "menu_item_id": "Menu Item",
    "special_event": "Campus / Special Event",
    "weather": "Weather Condition",
}


class DemandForecastEngine:
    """Dual ML demand forecaster using Scikit-learn Random Forest & XGBoost."""

    def __init__(self, artifacts_dir: Path | None = None) -> None:
        self.artifacts_dir = artifacts_dir or ARTIFACTS_DIR
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)
        self.bundle_path = self.artifacts_dir / "demand_models.joblib"

        self.preprocessor: ColumnTransformer | None = None
        self.rf_model: RandomForestRegressor | None = None
        self.xgb_model: XGBRegressor | None = None
        self.metrics: dict[str, Any] = {}
        self.feature_importances: list[dict[str, Any]] = []
        self.weights: dict[str, float] = {"random_forest": 0.45, "xgboost": 0.55}
        self.model_version: int = 0
        self.trained_at: str | None = None
        self.training_samples: int = 0

    def _build_dataframe(
        self,
        logs: list[dict[str, Any]],
        menu_map: dict[str, dict[str, Any]],
    ) -> pd.DataFrame:
        rows = []
        for log in logs:
            mid = log["menu_item_id"]
            item = menu_map.get(mid, {})
            rows.append(
                {
                    "date": log["date"],
                    "meal_slot": log["meal_slot"],
                    "menu_item_id": mid,
                    "special_event": log.get("special_event", "None"),
                    "weather": log.get("weather", "Cloudy"),
                    "day_of_week": int(log.get("day_of_week", datetime.fromisoformat(log["date"]).weekday())),
                    "is_weekend": int(bool(log.get("is_weekend", False))),
                    "is_holiday": int(bool(log.get("is_holiday", False))),
                    "expected_attendance": float(log["expected_attendance"]),
                    "temperature_c": float(log.get("temperature_c", 28.0)),
                    "rolling_7d_served": float(log.get("rolling_7d_served", log["served_servings"])),
                    "popularity_score": float(item.get("popularity_score", 0.80)),
                    "uptake_rate": float(item.get("uptake_rate", 0.78)),
                    "served_servings": float(log["served_servings"]),
                }
            )
        df = pd.DataFrame(rows)
        df = df.sort_values(["date", "meal_slot", "menu_item_id"]).reset_index(drop=True)
        return df

    @staticmethod
    def _eval_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
        mae = float(mean_absolute_error(y_true, y_pred))
        rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
        denom = np.maximum(y_true, 1.0)
        mape = float(np.mean(np.abs(y_true - y_pred) / denom) * 100.0)
        r2 = float(r2_score(y_true, y_pred)) if len(y_true) > 1 else 1.0
        return {
            "mae": round(mae, 2),
            "rmse": round(rmse, 2),
            "mape_pct": round(mape, 2),
            "r2": round(r2, 4),
        }

    def _compute_feature_importances(self) -> list[dict[str, Any]]:
        if self.preprocessor is None or self.rf_model is None or self.xgb_model is None:
            return []
        raw_names = list(self.preprocessor.get_feature_names_out())
        rf_imp = self.rf_model.feature_importances_
        xgb_imp = self.xgb_model.feature_importances_
        combined = 0.5 * (rf_imp / max(rf_imp.sum(), 1e-9)) + 0.5 * (xgb_imp / max(xgb_imp.sum(), 1e-9))

        grouped: dict[str, float] = {}
        for raw_name, score in zip(raw_names, combined):
            clean = raw_name.split("__", 1)[-1]
            base_col = clean
            for cat in CATEGORICAL_COLS:
                if clean.startswith(f"{cat}_"):
                    base_col = cat
                    break
            grouped[base_col] = grouped.get(base_col, 0.0) + float(score)

        total = sum(grouped.values()) or 1.0
        ranked = [
            {
                "feature": FRIENDLY_FEATURE_MAP.get(k, k),
                "raw_key": k,
                "importance_pct": round((v / total) * 100.0, 2),
            }
            for k, v in sorted(grouped.items(), key=lambda kv: kv[1], reverse=True)
        ]
        return ranked

    def train(self, db: DatabaseManager, reason: str = "startup") -> dict[str, Any]:
        logs = db.collection("meal_logs").find()
        menu_items = db.collection("menu_items").find()
        menu_map = {m["menu_item_id"]: m for m in menu_items}

        if len(logs) < 20:
            raise ValueError("Need at least 20 meal log records to train demand forecasting models.")

        df = self._build_dataframe(logs, menu_map)
        unique_dates = sorted(df["date"].unique())
        split_idx = max(1, int(len(unique_dates) * 0.82))
        val_dates = set(unique_dates[split_idx:]) if split_idx < len(unique_dates) else set(unique_dates[-3:])

        train_df = df[~df["date"].isin(val_dates)]
        val_df = df[df["date"].isin(val_dates)]
        if train_df.empty or val_df.empty:
            cutoff = max(1, int(len(df) * 0.8))
            train_df = df.iloc[:cutoff]
            val_df = df.iloc[cutoff:]

        feature_cols = CATEGORICAL_COLS + NUMERIC_COLS
        X_train = train_df[feature_cols]
        y_train = train_df["served_servings"].to_numpy()
        X_val = val_df[feature_cols]
        y_val = val_df["served_servings"].to_numpy()

        preprocessor = ColumnTransformer(
            transformers=[
                ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_COLS),
                ("num", "passthrough", NUMERIC_COLS),
            ]
        )

        X_train_t = preprocessor.fit_transform(X_train)
        X_val_t = preprocessor.transform(X_val)

        rf = RandomForestRegressor(
            n_estimators=140,
            max_depth=14,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=1,
        )
        rf.fit(X_train_t, y_train)

        xgb = XGBRegressor(
            n_estimators=180,
            max_depth=6,
            learning_rate=0.06,
            subsample=0.9,
            colsample_bytree=0.9,
            random_state=42,
            n_jobs=2,
            objective="reg:squarederror",
        )
        xgb.fit(X_train_t, y_train)

        rf_val_pred = np.maximum(0.0, rf.predict(X_val_t))
        xgb_val_pred = np.maximum(0.0, xgb.predict(X_val_t))

        rf_metrics = self._eval_metrics(y_val, rf_val_pred)
        xgb_metrics = self._eval_metrics(y_val, xgb_val_pred)

        inv_rf = 1.0 / max(rf_metrics["rmse"], 1.0)
        inv_xgb = 1.0 / max(xgb_metrics["rmse"], 1.0)
        w_rf = round(inv_rf / (inv_rf + inv_xgb), 3)
        w_xgb = round(1.0 - w_rf, 3)

        ens_val_pred = w_rf * rf_val_pred + w_xgb * xgb_val_pred
        ens_metrics = self._eval_metrics(y_val, ens_val_pred)

        # Refit final production models on 100% of available data
        X_all_t = preprocessor.fit_transform(df[feature_cols])
        y_all = df["served_servings"].to_numpy()
        rf.fit(X_all_t, y_all)
        xgb.fit(X_all_t, y_all)

        prev_runs = db.collection("model_runs").count_documents()
        self.model_version = prev_runs + 1
        self.trained_at = datetime.now().isoformat(timespec="seconds")
        self.training_samples = len(df)
        self.preprocessor = preprocessor
        self.rf_model = rf
        self.xgb_model = xgb
        self.weights = {"random_forest": w_rf, "xgboost": w_xgb}
        self.metrics = {
            "random_forest": rf_metrics,
            "xgboost": xgb_metrics,
            "ensemble": ens_metrics,
        }
        self.feature_importances = self._compute_feature_importances()

        joblib.dump(
            {
                "preprocessor": self.preprocessor,
                "rf_model": self.rf_model,
                "xgb_model": self.xgb_model,
                "metrics": self.metrics,
                "weights": self.weights,
                "feature_importances": self.feature_importances,
                "model_version": self.model_version,
                "trained_at": self.trained_at,
                "training_samples": self.training_samples,
            },
            self.bundle_path,
        )

        run_record = {
            "version": self.model_version,
            "reason": reason,
            "trained_at": self.trained_at,
            "training_samples": self.training_samples,
            "validation_samples": len(val_df),
            "weights": self.weights,
            "metrics": self.metrics,
        }
        db.collection("model_runs").insert_one(run_record)
        return run_record

    def ensure_loaded_or_train(self, db: DatabaseManager) -> dict[str, Any]:
        if self.rf_model is not None and self.xgb_model is not None:
            return self.summary()
        if self.bundle_path.exists():
            try:
                bundle = joblib.load(self.bundle_path)
                self.preprocessor = bundle["preprocessor"]
                self.rf_model = bundle["rf_model"]
                self.xgb_model = bundle["xgb_model"]
                self.metrics = bundle["metrics"]
                self.weights = bundle["weights"]
                self.feature_importances = bundle.get("feature_importances", [])
                self.model_version = bundle.get("model_version", 1)
                self.trained_at = bundle.get("trained_at")
                self.training_samples = bundle.get("training_samples", 0)
                return self.summary()
            except Exception:
                pass
        self.train(db, reason="initial_bootstrap")
        return self.summary()

    def _rolling_baseline_by_item(self, db: DatabaseManager) -> dict[str, float]:
        logs = db.collection("meal_logs").find(sort_by=("date", -1), limit=250)
        by_item: dict[str, list[int]] = {}
        for log in logs:
            by_item.setdefault(log["menu_item_id"], []).append(int(log["served_servings"]))
        return {k: float(np.mean(v[:7])) for k, v in by_item.items() if v}

    def predict(
        self,
        db: DatabaseManager,
        target_date: str,
        meal_slot: str,
        expected_attendance: int,
        is_holiday: bool = False,
        special_event: str = "None",
        weather: str = "Cloudy",
        temperature_c: float = 28.0,
        model_choice: str = "ensemble",
        menu_item_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        self.ensure_loaded_or_train(db)
        assert self.preprocessor is not None and self.rf_model is not None and self.xgb_model is not None

        all_items = db.collection("menu_items").find({"meal_slot": meal_slot})
        if menu_item_ids:
            menu_lookup = {m["menu_item_id"]: m for m in db.collection("menu_items").find()}
            selected_items = [menu_lookup[mid] for mid in menu_item_ids if mid in menu_lookup]
        else:
            selected_items = all_items

        if not selected_items:
            return {
                "date": target_date,
                "meal_slot": meal_slot,
                "model_choice": model_choice,
                "items": [],
                "total_predicted_servings": 0,
            }

        dt = datetime.fromisoformat(target_date)
        dow = dt.weekday()
        is_weekend = int(dow >= 5)
        rolling_map = self._rolling_baseline_by_item(db)

        rows = []
        for item in selected_items:
            mid = item["menu_item_id"]
            fallback_rolling = expected_attendance * float(item["uptake_rate"])
            rows.append(
                {
                    "meal_slot": meal_slot,
                    "menu_item_id": mid,
                    "special_event": special_event,
                    "weather": weather,
                    "day_of_week": dow,
                    "is_weekend": is_weekend,
                    "is_holiday": int(is_holiday),
                    "expected_attendance": float(expected_attendance),
                    "temperature_c": float(temperature_c),
                    "rolling_7d_served": rolling_map.get(mid, fallback_rolling),
                    "popularity_score": float(item["popularity_score"]),
                    "uptake_rate": float(item["uptake_rate"]),
                }
            )

        X = pd.DataFrame(rows)[CATEGORICAL_COLS + NUMERIC_COLS]
        X_t = self.preprocessor.transform(X)

        rf_preds = np.maximum(5.0, self.rf_model.predict(X_t))
        xgb_preds = np.maximum(5.0, self.xgb_model.predict(X_t))
        ens_preds = self.weights["random_forest"] * rf_preds + self.weights["xgboost"] * xgb_preds

        # Estimate per-item uncertainty from Random Forest tree dispersion
        tree_matrix = np.array([tree.predict(X_t) for tree in self.rf_model.estimators_])
        tree_stds = np.std(tree_matrix, axis=0)

        results = []
        for idx, item in enumerate(selected_items):
            rf_p = float(rf_preds[idx])
            xgb_p = float(xgb_preds[idx])
            ens_p = float(ens_preds[idx])
            if model_choice == "random_forest":
                chosen = rf_p
            elif model_choice == "xgboost":
                chosen = xgb_p
            else:
                chosen = ens_p

            # Scale softly if expected attendance goes outside historical training range
            model_std = max(float(tree_stds[idx]), chosen * 0.055)
            p10 = max(5, int(round(chosen - 1.28 * model_std)))
            p50 = max(5, int(round(chosen)))
            p90 = max(p50 + 5, int(round(chosen + 1.28 * model_std)))

            results.append(
                {
                    "menu_item_id": item["menu_item_id"],
                    "name": item["name"],
                    "category": item["category"],
                    "dietary_tag": item["dietary_tag"],
                    "predicted_servings": p50,
                    "p10_servings": p10,
                    "p90_servings": p90,
                    "rf_prediction": int(round(rf_p)),
                    "xgb_prediction": int(round(xgb_p)),
                    "ensemble_prediction": int(round(ens_p)),
                    "uncertainty_std": round(model_std, 1),
                    "batch_size": int(item["batch_size"]),
                    "min_initial_ratio": float(item["min_initial_ratio"]),
                    "cost_per_serving": float(item["cost_per_serving"]),
                    "serving_weight_kg": float(item["serving_weight_kg"]),
                    "recipe": item["recipe"],
                }
            )

        return {
            "date": target_date,
            "meal_slot": meal_slot,
            "expected_attendance": expected_attendance,
            "model_choice": model_choice,
            "model_version": self.model_version,
            "metrics": self.metrics,
            "weights": self.weights,
            "items": results,
            "total_predicted_servings": sum(r["predicted_servings"] for r in results),
        }

    def summary(self) -> dict[str, Any]:
        return {
            "model_version": self.model_version,
            "trained_at": self.trained_at,
            "training_samples": self.training_samples,
            "weights": self.weights,
            "metrics": self.metrics,
            "feature_importances": self.feature_importances,
        }


forecast_engine = DemandForecastEngine()

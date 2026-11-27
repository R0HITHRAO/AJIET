# NOURISH AI — Smart Kitchen Management & Sustainable Food Redistribution System

**Team Codeverse** | Shri Madhwa Vadiraja Institute of Technology and Management (SMVITM), Bantakal, Udupi  
**SANKALP'26 — Theme 02:** *AI-Powered Smart Food Waste Reduction & Sustainable Redistribution Ecosystem*

---

## Core Modules Implemented

1. **AI Demand Forecasting Engine (`backend/app/ml_engine.py`)**
   - Combines **Scikit-learn `RandomForestRegressor`** and **XGBoost `XGBRegressor`** using date-grouped expanding-window validation across five future periods, compared against a recent same-dish/weekday baseline.
   - Uses ML predictions only when they beat the baseline in pooled MAE and at least 80% of validation folds; otherwise forecasts fall back to the attendance-adjusted baseline. Reports serving MAE, RMSE, MAPE, and WAPE.

2. **Google OR-Tools Batch-Wise Preparation Optimizer (`backend/app/optimizer.py`)**
   - Solves a Mixed-Integer Linear Program (MILP) for **2-stage batch-wise cooking**: smaller **Initial Base Batches** + **On-Demand Reserve Batches**, constrained by live ingredient inventory.
   - Quantifies waste avoided (kg & %), cost saved (₹), meal sufficiency (%), and CO₂ emissions avoided vs traditional single-batch over-preparation.

3. **What-If Kitchen Simulator (`backend/app/simulator.py`)**
   - Dynamically reruns ML demand forecasts and Google OR-Tools optimization under simulated attendance surges/drops, menu dish swaps, weather/events, and ingredient stock shortages.

4. **Post-Meal Feedback & Continuous Learning (`backend/app/main.py`)**
   - Records predictions alongside actual meals served & leftovers, reviews weekly errors by meal slot and dish, supports CSV upload of actual kitchen logs, and triggers model retraining.
   - Checked-in `historical_seed` rows are synthetic demo data, not verified institutional records. Import real records through the CSV upload flow; `predicted_servings` is optional and enables forecast error tracking for imported rows.

5. **Smart Surplus Detection & NGO Redistribution (`backend/app/optimizer.py`)**
   - Evaluates FSSAI-aligned **food-safety & storage criteria** (holding temperature °C, elapsed hours vs safe window, cold-chain requirement, sealed container check) before allowing redistribution.
   - Uses **Google OR-Tools assignment optimization** + multi-factor compatibility scoring (Haversine distance in km, ETA, capacity fit, dietary preference, cold-chain vehicle fit, reliability) to match eligible surplus with nearby NGOs & food banks around Bantakal/Udupi/Manipal.

---

## Quick Start

### 1. Backend (FastAPI + ML + Google OR-Tools)
```powershell
cd c:\Nourish_AI
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
- Optional MongoDB: set `MONGODB_URI="mongodb://localhost:27017"` (or Atlas URI). If no MongoDB daemon is running locally, Nourish AI automatically runs in **Mongo-compatible Local Document Store** mode (`backend/data/store/`) so the prototype works zero-config out of the box.

### 2. Frontend (React.js + Tailwind + Recharts)
```powershell
cd c:\Nourish_AI\frontend
npm install
npm run dev
```
Open `http://127.0.0.1:5173`.

### 3. Run Automated Tests
```powershell
cd c:\Nourish_AI
python -m pytest backend/tests/test_api.py -v
```

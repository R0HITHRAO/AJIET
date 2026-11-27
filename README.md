# 🌱 NOURISH AI — Smart Kitchen Management & Sustainable Food Redistribution System

**Team Codeverse** | Shri Madhwa Vadiraja Institute of Technology and Management (SMVITM), Bantakal, Udupi, Karnataka, India

**SANKALP'26 — Theme 02:** *AI-Powered Smart Food Waste Reduction & Sustainable Redistribution Ecosystem*

---

## 🌍 About NOURISH AI

NOURISH-AI is an AI-powered smart kitchen management system designed to reduce food waste by predicting meal demand, optimizing cooking quantities, managing kitchen inventory, and facilitating the safe redistribution of eligible surplus food to nearby NGOs and food banks.

Unlike conventional food redistribution platforms that primarily focus on collecting and distributing leftover food, NOURISH AI focuses on **preventing food waste at its source through intelligent demand forecasting and batch-wise cooking optimization.**

Our goal is to make institutional kitchens smarter, more efficient, cost-effective, and sustainable.

---

## 🚀 Core Modules Implemented

### 1. AI-Based Demand Forecasting Engine
**File:** `backend/app/ml_engine.py`

- Integrates Scikit-learn `RandomForestRegressor` and XGBoost `XGBRegressor`.
- Uses date-grouped expanding-window validation across five future periods.
- Compares ML models against a recent same-dish and weekday baseline.
- Selects ML predictions only when they outperform the baseline in pooled MAE and at least 80% of validation folds.
- Automatically falls back to an attendance-adjusted baseline when ML performance is insufficient.
- Evaluates forecasting performance using MAE, RMSE, MAPE, and WAPE.

### 2. Smart Batch-Wise Cooking Optimization
**File:** `backend/app/optimizer.py`

- Uses Google OR-Tools to solve a Mixed-Integer Linear Programming (MILP) optimization problem.
- Implements a two-stage cooking strategy:
  - **Initial Base Batches:** Prepare the estimated initial meal requirement.
  - **On-Demand Reserve Batches:** Prepare additional quantities according to actual demand.
- Considers available ingredient inventory and kitchen constraints.
- Calculates:
  - Food waste avoided (kg and %).
  - Cost savings (₹).
  - Meal sufficiency (%).
  - CO₂ emissions avoided compared with traditional single-batch over-preparation.

### 3. What-If Kitchen Simulation
**File:** `backend/app/simulator.py`

Enables kitchen managers to simulate different operating conditions before making preparation decisions.

Supported scenarios include:
- Unexpected attendance increases or decreases.
- Menu and dish changes.
- Weather and special-event variations.
- Ingredient stock shortages.

The simulator dynamically reruns demand forecasting and batch optimization to evaluate the impact of each scenario.

### 4. Post-Meal Feedback & Continuous Learning
**File:** `backend/app/main.py`

- Records predicted servings, actual meals served, and leftover quantities.
- Evaluates forecasting errors by meal slot and dish.
- Supports CSV uploads containing actual kitchen consumption records.
- Enables model retraining using newly collected data.
- Uses feedback to improve future demand predictions.

**Data transparency:** The included `historical_seed` records are synthetic demonstration data, not verified institutional records. Real kitchen records can be imported through the CSV upload feature. The `predicted_servings` field is optional and enables forecast-error tracking when provided.

### 5. Smart Surplus Detection & NGO Redistribution
**File:** `backend/app/optimizer.py`

Identifies eligible surplus food and facilitates suitable NGO and food-bank matching.

**Food safety assessment:**
- Food holding temperature (°C).
- Elapsed time against the applicable safe holding window.
- Cold-chain requirements.
- Sealed-container verification.

Redistribution eligibility is evaluated using configured food-safety criteria aligned with applicable FSSAI guidance.

**Intelligent NGO matching:**

Uses Google OR-Tools assignment optimization and multi-factor compatibility scoring based on:

- Haversine geographical distance (km).
- Estimated arrival time (ETA).
- NGO food-handling and receiving capacity.
- Dietary preferences.
- Cold-chain vehicle availability.
- NGO reliability.

Designed to support NGO and food-bank matching around Bantakal, Udupi, and Manipal.

---

## 🛠️ Technology Stack

| Component | Technologies |
|---|---|
| Frontend | React.js, Tailwind CSS, Recharts |
| Backend | Python, FastAPI |
| Machine Learning | Scikit-learn, XGBoost |
| Optimization | Google OR-Tools, MILP |
| Database | MongoDB / Local Document Store |
| Data Processing | Pandas, NumPy |
| API | REST API |
| Development | VS Code, Git, GitHub |

---

## ⚙️ Installation & Setup

### Prerequisites

- Python 3.10+
- Node.js and npm
- Git
- MongoDB (optional)

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd Nourish_AI
```

### 2. Start the Backend

Open PowerShell:

```powershell
cd c:\Nourish_AI
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend API:

`http://127.0.0.1:8000`

### 3. Start the Frontend

Open another terminal:

```powershell
cd c:\Nourish_AI\frontend
npm install
npm run dev
```

Open the application:

`http://127.0.0.1:5173`

### 4. Database Configuration (Optional)

Set the MongoDB connection string:

```env
MONGODB_URI=mongodb://localhost:27017
```

If a local MongoDB service is unavailable, NOURISH AI automatically uses its Mongo-compatible Local Document Store at:

`backend/data/store/`

This allows the prototype to operate without requiring a running MongoDB server.

### 5. SMTP Configuration (Optional)

Create `backend/.env` for password-reset OTP email functionality:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

If SMTP is not configured, demo OTP preview functionality is available for offline hackathon testing.

**Demo Login (Development Only):**

- Email: `manager@nourishai.edu`
- Password: `Codeverse@2026`

Do not use demo credentials or commit real passwords and SMTP credentials in a production deployment.

---

## 🧪 Automated Testing

Run the backend API tests:

```powershell
cd c:\Nourish_AI
python -m pytest backend/tests/test_api.py -v
```

---

## 💡 Key Innovation

NOURISH AI follows a prevention-first approach to food waste management.

| Conventional Approach | NOURISH AI |
|---|---|
| Collects surplus food | Predicts food demand |
| Focuses on leftover distribution | Prevents unnecessary cooking |
| Prepares food in large batches | Optimizes batch-wise preparation |
| Reacts to food waste | Anticipates food waste |
| Manages donations | Intelligently matches eligible surplus with NGOs |

---

## 🌱 Our Vision

To transform institutional kitchens into intelligent, sustainable food ecosystems where every meal is planned efficiently, every ingredient is utilized responsibly, and every eligible surplus meal has the opportunity to reach someone in need.

**NOURISH AI — Predict Smart. Cook Smart. Waste Less.**

---

**Developed by Team Codeverse**  
Shri Madhwa Vadiraja Institute of Technology and Management (SMVITM), Bantakal, Udupi, Karnataka.

**SANKALP'26 | Theme 02**

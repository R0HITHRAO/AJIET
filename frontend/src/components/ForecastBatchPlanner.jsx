import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChefHat,
  Cpu,
  Layers,
  Save,
  Sparkles,
  TrendingDown,
} from 'lucide-react';
import { api } from '../api';

const MEAL_SLOTS = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];
const DEFAULT_ATTENDANCE = { Breakfast: 610, Lunch: 740, Snacks: 520, Dinner: 690 };

export default function ForecastBatchPlanner() {
  const [form, setForm] = useState({
    date: '2026-11-28',
    meal_slot: 'Lunch',
    expected_attendance: 740,
    weather: 'Cloudy',
    temperature_c: 28.0,
    special_event: 'None',
    is_holiday: false,
    model_choice: 'ensemble',
    batch_cooking_enabled: true,
    waste_penalty_per_serving: 28,
    shortage_penalty_per_serving: 55,
  });

  const [forecast, setForecast] = useState(null);
  const [optResult, setOptResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [error, setError] = useState('');

  const runPlan = async (save = false) => {
    setLoading(true);
    setError('');
    setSavedMsg('');
    try {
      const [fcRes, optRes] = await Promise.all([
        api.forecast(form),
        api.optimizeBatch(form, save),
      ]);
      setForecast(fcRes);
      setOptResult(optRes);
      if (save && optRes.saved_plan_id) {
        setSavedMsg(`Preparation plan saved (${optRes.saved_plan_id})`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runPlan(false);
  }, []);

  const handleSlotChange = (slot) => {
    setForm((prev) => ({
      ...prev,
      meal_slot: slot,
      expected_attendance: DEFAULT_ATTENDANCE[slot] || prev.expected_attendance,
    }));
  };

  const opt = optResult?.optimization;
  const sum = opt?.summary || {};
  const fcLookup = Object.fromEntries((forecast?.items || []).map((i) => [i.menu_item_id, i]));

  return (
    <div className="space-y-6">
      {/* Controls Card */}
      <div className="card-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-emerald-700" />
              Demand Forecast &amp; Google OR-Tools Batch Planner
            </h2>
            <p className="text-xs text-slate-500">
              Combines Scikit-learn Random Forest &amp; XGBoost predictions with MILP batch-wise preparation optimization
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => runPlan(false)}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold flex items-center gap-2 transition disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4" />
              {loading ? 'Optimizing...' : 'Run Forecast & Optimize'}
            </button>
            <button
              onClick={() => runPlan(true)}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold flex items-center gap-1.5 transition"
            >
              <Save className="w-4 h-4" />
              Save Plan
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Target Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Meal Slot</label>
            <select
              value={form.meal_slot}
              onChange={(e) => handleSlotChange(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              {MEAL_SLOTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Expected Attendance</label>
            <input
              type="number"
              min="50"
              max="3000"
              value={form.expected_attendance}
              onChange={(e) => setForm({ ...form, expected_attendance: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Weather</label>
            <select
              value={form.weather}
              onChange={(e) => setForm({ ...form, weather: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              {['Sunny', 'Cloudy', 'Rainy', 'Humid'].map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Special Event</label>
            <select
              value={form.special_event}
              onChange={(e) => setForm({ ...form, special_event: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              {['None', 'Exam Week', 'Tech Fest', 'Sports Day', 'Hackathon', 'Parent Meet'].map((ev) => (
                <option key={ev} value={ev}>{ev}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">ML Model</label>
            <select
              value={form.model_choice}
              onChange={(e) => setForm({ ...form, model_choice: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="ensemble">Ensemble (RF + XGB)</option>
              <option value="xgboost">XGBoost</option>
              <option value="random_forest">Random Forest</option>
            </select>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-6 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_holiday}
              onChange={(e) => setForm({ ...form, is_holiday: e.target.checked })}
              className="rounded text-emerald-600"
            />
            <span className="font-medium text-slate-700">Campus Holiday</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.batch_cooking_enabled}
              onChange={(e) => setForm({ ...form, batch_cooking_enabled: e.target.checked })}
              className="rounded text-emerald-600"
            />
            <span className="font-medium text-slate-700">Batch-Wise Cooking (Initial + On-Demand Reserve)</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Temp: {form.temperature_c}°C</span>
            <input
              type="range"
              min="18"
              max="38"
              step="0.5"
              value={form.temperature_c}
              onChange={(e) => setForm({ ...form, temperature_c: Number(e.target.value) })}
              className="w-28 accent-emerald-700"
            />
          </div>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
        )}
        {savedMsg && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {savedMsg}
          </div>
        )}
      </div>

      {/* Optimization Summary Banner */}
      {opt && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="card-surface p-4 bg-gradient-to-br from-emerald-900 to-emerald-800 text-white border-0">
              <p className="text-xs uppercase tracking-wider text-emerald-200 font-semibold">OR-Tools Solver</p>
              <p className="mt-1 text-2xl font-extrabold">{opt.solver_status}</p>
              <p className="text-xs text-emerald-200 mt-1">
                {opt.batch_cooking_enabled ? '2-Stage Batch Strategy' : 'Single-Batch Mode'}
              </p>
            </div>
            <div className="card-surface p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Initial Base Prep</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900 stat-value">
                {sum.total_initial_servings?.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                + {sum.total_reserve_servings?.toLocaleString()} reserve capacity
              </p>
            </div>
            <div className="card-surface p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Expected Waste Saved</p>
              <p className="mt-1 text-2xl font-extrabold text-emerald-700 stat-value flex items-center gap-1">
                <TrendingDown className="w-5 h-5" />
                {sum.waste_saved_kg} kg
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {sum.waste_reduction_pct}% less than traditional ({sum.traditional_prep_servings} serv)
              </p>
            </div>
            <div className="card-surface p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Cost Saved This Meal</p>
              <p className="mt-1 text-2xl font-extrabold text-sky-700 stat-value">
                ₹{Math.round(sum.cost_saved_inr || 0).toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                CO₂ avoided: {sum.co2_saved_kg} kg
              </p>
            </div>
            <div className="card-surface p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Meal Sufficiency</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900 stat-value">
                {sum.meal_sufficiency_pct}%
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Shortage risk: {sum.shortage_risk_servings} serv
              </p>
            </div>
          </div>

          {opt.bottleneck_ingredients?.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-900">
                <p className="font-bold">Ingredient Stock Constraint Activated</p>
                <p className="text-xs mt-0.5">
                  OR-Tools constrained preparation to fit available inventory for:{' '}
                  <strong>{opt.bottleneck_ingredients.join(', ')}</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Dish-Level Table + Ingredient Utilization */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="card-surface p-5 xl:col-span-2 overflow-x-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-700" />
                  Batch-Wise Preparation Schedule ({form.meal_slot})
                </h3>
                <span className="text-xs text-slate-500">
                  ML Forecast Total: <strong>{sum.total_predicted_servings} servings</strong>
                </span>
              </div>
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <th className="py-2.5 pr-3">Menu Item</th>
                    <th className="py-2.5 px-2">ML Forecast (P10–P90)</th>
                    <th className="py-2.5 px-2">RF / XGB</th>
                    <th className="py-2.5 px-2">Initial Batch</th>
                    <th className="py-2.5 px-2">On-Demand Reserve</th>
                    <th className="py-2.5 px-2">Traditional Prep</th>
                    <th className="py-2.5 pl-2 text-right">Est. Savings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {opt.items.map((item) => {
                    const fc = fcLookup[item.menu_item_id] || {};
                    return (
                      <tr key={item.menu_item_id} className="hover:bg-slate-50/70">
                        <td className="py-3 pr-3">
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500">
                            {item.category} &bull; Batch = {item.batch_size} serv
                          </p>
                        </td>
                        <td className="py-3 px-2 stat-value">
                          <span className="font-bold text-slate-900">{item.predicted_servings}</span>
                          <span className="block text-[11px] text-slate-400">
                            [{item.p10_servings} – {item.p90_servings}]
                          </span>
                        </td>
                        <td className="py-3 px-2 text-xs text-slate-600 stat-value">
                          {fc.rf_prediction ?? '-'} / {fc.xgb_prediction ?? '-'}
                        </td>
                        <td className="py-3 px-2">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs stat-value">
                            {item.initial_batches}b &bull; {item.initial_servings}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          {item.reserve_batches > 0 ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 font-semibold text-xs stat-value">
                              +{item.reserve_batches}b ({item.reserve_servings})
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">None</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-xs text-slate-500 stat-value">
                          {item.traditional_prep_servings} serv
                        </td>
                        <td className="py-3 pl-2 text-right font-bold text-emerald-700 stat-value">
                          ₹{Math.round(item.savings_inr)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Ingredient Utilization */}
            <div className="card-surface p-5">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-3">
                <Cpu className="w-4 h-4 text-sky-700" />
                Ingredient Stock Constraints
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Live recipe allocation checked by Google OR-Tools against current kitchen inventory
              </p>
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {opt.ingredient_utilization.map((ing) => (
                  <div key={ing.ingredient_id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{ing.name}</span>
                      <span className={`stat-value font-semibold ${ing.is_bottleneck ? 'text-amber-700' : 'text-slate-500'}`}>
                        {ing.max_with_reserve_required} / {ing.available_stock} {ing.unit}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${ing.is_bottleneck ? 'bg-amber-500' : 'bg-emerald-600'}`}
                        style={{ width: `${Math.min(100, ing.utilization_pct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

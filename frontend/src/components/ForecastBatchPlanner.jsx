import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Layers,
  Save,
  Sparkles,
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
  const [onlyBottlenecks, setOnlyBottlenecks] = useState(false);

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
  const visibleIngredients = onlyBottlenecks
    ? (opt?.ingredient_utilization || []).filter((i) => i.is_bottleneck || i.utilization_pct >= 50)
    : opt?.ingredient_utilization || [];

  return (
    <div className="space-y-6">
      {/* 1. Unified Meal Parameters Card */}
      <section className="card-surface p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Meal Parameters &amp; Solver Configuration</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Select meal context and ML model to compute optimal initial and reserve cooking batches
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button onClick={() => runPlan(true)} disabled={loading} className="btn-secondary">
              <Save className="w-4 h-4" />
              Save Plan
            </button>
            <button onClick={() => runPlan(false)} disabled={loading} className="btn-primary">
              <Sparkles className="w-4 h-4" />
              {loading ? 'Optimizing...' : 'Generate Batch Plan'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="field-label">Target Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="field-control"
            />
          </div>
          <div>
            <label className="field-label">Meal Slot</label>
            <select
              value={form.meal_slot}
              onChange={(e) => handleSlotChange(e.target.value)}
              className="field-control"
            >
              {MEAL_SLOTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Attendance</label>
            <input
              type="number"
              min="50"
              max="3000"
              value={form.expected_attendance}
              onChange={(e) => setForm({ ...form, expected_attendance: Number(e.target.value) })}
              className="field-control stat-value"
            />
          </div>
          <div>
            <label className="field-label">Weather</label>
            <select
              value={form.weather}
              onChange={(e) => setForm({ ...form, weather: e.target.value })}
              className="field-control"
            >
              {['Sunny', 'Cloudy', 'Rainy', 'Humid'].map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Special Event</label>
            <select
              value={form.special_event}
              onChange={(e) => setForm({ ...form, special_event: e.target.value })}
              className="field-control"
            >
              {['None', 'Exam Week', 'Tech Fest', 'Sports Day', 'Hackathon', 'Parent Meet'].map((ev) => (
                <option key={ev} value={ev}>{ev}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">ML Model</label>
            <select
              value={form.model_choice}
              onChange={(e) => setForm({ ...form, model_choice: e.target.value })}
              className="field-control"
            >
              <option value="ensemble">Ensemble (RF + XGB)</option>
              <option value="xgboost">XGBoost</option>
              <option value="random_forest">Random Forest</option>
            </select>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={form.is_holiday}
                onChange={(e) => setForm({ ...form, is_holiday: e.target.checked })}
                className="rounded accent-emerald-700"
              />
              Campus Holiday
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={form.batch_cooking_enabled}
                onChange={(e) => setForm({ ...form, batch_cooking_enabled: e.target.checked })}
                className="rounded accent-emerald-700"
              />
              Two-Stage Batch Cooking (Initial + Reserve)
            </label>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-500">Ambient Temp: {form.temperature_c}°C</span>
            <input
              type="range"
              min="18"
              max="38"
              step="0.5"
              value={form.temperature_c}
              onChange={(e) => setForm({ ...form, temperature_c: Number(e.target.value) })}
              className="w-32 accent-emerald-700"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
        )}
        {savedMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {savedMsg}
          </div>
        )}
      </section>

      {/* 2. Uniform Optimization Summary Strip */}
      {opt && (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="card-surface p-5 border-t-4 border-t-emerald-600">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Initial Base Prep
              </p>
              <p className="mt-2 text-2xl font-extrabold text-slate-900 stat-value">
                {sum.total_initial_servings?.toLocaleString()} serv
              </p>
              <p className="mt-1 text-xs text-slate-500">
                +{sum.total_reserve_servings?.toLocaleString()} reserve capacity &bull; Solver: {opt.solver_status}
              </p>
            </div>

            <div className="card-surface p-5 border-t-4 border-t-sky-600">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Expected Waste Saved
              </p>
              <p className="mt-2 text-2xl font-extrabold text-emerald-700 stat-value">
                {sum.waste_saved_kg} kg
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {sum.waste_reduction_pct}% less than traditional ({sum.traditional_prep_servings} serv)
              </p>
            </div>

            <div className="card-surface p-5 border-t-4 border-t-amber-500">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Meal Cost Saved
              </p>
              <p className="mt-2 text-2xl font-extrabold text-slate-900 stat-value">
                ₹{Math.round(sum.cost_saved_inr || 0).toLocaleString('en-IN')}
              </p>
              <p className="mt-1 text-xs text-slate-500">CO₂ avoided: {sum.co2_saved_kg} kg</p>
            </div>

            <div className="card-surface p-5 border-t-4 border-t-slate-600">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Meal Sufficiency
              </p>
              <p className="mt-2 text-2xl font-extrabold text-slate-900 stat-value">
                {sum.meal_sufficiency_pct}%
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Predicted: {sum.total_predicted_servings} serv &bull; Risk: {sum.shortage_risk_servings}
              </p>
            </div>
          </section>

          {opt.bottleneck_ingredients?.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-xs text-amber-950">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Stock constraint active:</strong> OR-Tools capped preparation to available stock for{' '}
                <strong>{opt.bottleneck_ingredients.join(', ')}</strong>.
              </span>
            </div>
          )}

          {/* 3. Schedule Table + Ingredient Check */}
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="card-surface p-6 xl:col-span-2 overflow-x-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-700" />
                  Batch-Wise Preparation Schedule ({form.meal_slot})
                </h3>
                <span className="text-xs text-slate-500">All values in servings</span>
              </div>

              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-3 pr-4">Dish</th>
                    <th className="py-3 px-3">Forecast (Range)</th>
                    <th className="py-3 px-3">Initial Batch</th>
                    <th className="py-3 px-3">Reserve Batch</th>
                    <th className="py-3 px-3">Legacy Prep</th>
                    <th className="py-3 pl-3 text-right">Est. Saved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {opt.items.map((item) => {
                    const fc = fcLookup[item.menu_item_id] || {};
                    return (
                      <tr key={item.menu_item_id} className="hover:bg-slate-50/70">
                        <td className="py-3.5 pr-4">
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <p className="text-[11px] text-slate-400">
                            {item.category} &bull; {item.batch_size}/batch &bull; RF {fc.rf_prediction ?? '-'} / XGB {fc.xgb_prediction ?? '-'}
                          </p>
                        </td>
                        <td className="py-3.5 px-3 stat-value">
                          <span className="font-bold text-slate-900">{item.predicted_servings}</span>
                          <span className="block text-[11px] text-slate-400">
                            {item.p10_servings}–{item.p90_servings}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs stat-value">
                            {item.initial_batches}b &bull; {item.initial_servings}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          {item.reserve_batches > 0 ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 font-semibold text-xs stat-value">
                              +{item.reserve_batches}b &bull; {item.reserve_servings}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-xs text-slate-500 stat-value">
                          {item.traditional_prep_servings}
                        </td>
                        <td className="py-3.5 pl-3 text-right font-bold text-emerald-700 stat-value">
                          ₹{Math.round(item.savings_inr).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="card-surface p-6 flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-sky-700" />
                  Ingredient Capacity
                </h3>
                <button
                  onClick={() => setOnlyBottlenecks(!onlyBottlenecks)}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-900"
                >
                  {onlyBottlenecks ? 'Show All' : 'High Usage'}
                </button>
              </div>
              <div className="space-y-3.5 flex-1 overflow-y-auto max-h-[380px] pr-1">
                {visibleIngredients.map((ing) => (
                  <div key={ing.ingredient_id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{ing.name}</span>
                      <span className={`stat-value font-semibold ${ing.is_bottleneck ? 'text-amber-700' : 'text-slate-500'}`}>
                        {ing.max_with_reserve_required} / {ing.available_stock} {ing.unit}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${ing.is_bottleneck ? 'bg-amber-500' : 'bg-emerald-600'}`}
                        style={{ width: `${Math.min(100, ing.utilization_pct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

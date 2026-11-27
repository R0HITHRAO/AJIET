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

export default function ForecastBatchPlanner({ initialSlot = 'Lunch' }) {
  const [form, setForm] = useState({
    date: '2026-11-28',
    meal_slot: initialSlot,
    expected_attendance: DEFAULT_ATTENDANCE[initialSlot] || 740,
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

  const runPlan = async (save = false, targetForm = form) => {
    setLoading(true);
    setError('');
    setSavedMsg('');
    try {
      const [fcRes, optRes] = await Promise.all([
        api.forecast(targetForm),
        api.optimizeBatch(targetForm, save),
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
    const nextForm = {
      ...form,
      meal_slot: initialSlot,
      expected_attendance: DEFAULT_ATTENDANCE[initialSlot] || form.expected_attendance,
    };
    setForm(nextForm);
    runPlan(false, nextForm);
  }, [initialSlot]);

  const handleSlotChange = (slot) => {
    const nextForm = {
      ...form,
      meal_slot: slot,
      expected_attendance: DEFAULT_ATTENDANCE[slot] || form.expected_attendance,
    };
    setForm(nextForm);
    runPlan(false, nextForm);
  };

  const opt = optResult?.optimization;
  const sum = opt?.summary || {};
  const fcLookup = Object.fromEntries((forecast?.items || []).map((i) => [i.menu_item_id, i]));

  return (
    <div className="space-y-6">
      {/* Top Meal Slot Pills + Parameters */}
      <section className="card-surface p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {MEAL_SLOTS.map((slot) => (
              <button
                key={slot}
                onClick={() => handleSlotChange(slot)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                  form.meal_slot === slot
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                {slot}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <button onClick={() => runPlan(true)} disabled={loading} className="btn-secondary">
              <Save className="w-4 h-4" />
              Save Plan
            </button>
            <button onClick={() => runPlan(false)} disabled={loading} className="btn-primary">
              <Sparkles className="w-4 h-4" />
              {loading ? 'Optimizing...' : 'Update Batch Plan'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
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
            <label className="field-label">Expected Diners</label>
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
            <label className="field-label">Forecast Model</label>
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

        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
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
          <span className="text-slate-500">
            OR-Tools Status: <strong className="text-emerald-700">{opt?.solver_status || 'READY'}</strong>
          </span>
        </div>

        {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>}
        {savedMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {savedMsg}
          </div>
        )}
      </section>

      {/* Summary Strip */}
      {opt && (
        <>
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card-surface p-5">
              <p className="text-xs font-semibold text-slate-500">Cook First (Initial)</p>
              <p className="mt-1.5 text-2xl font-extrabold text-emerald-700 stat-value">
                {sum.total_initial_servings?.toLocaleString()} serv
              </p>
              <p className="text-xs text-slate-400 mt-1">+{sum.total_reserve_servings?.toLocaleString()} on-demand reserve</p>
            </div>
            <div className="card-surface p-5">
              <p className="text-xs font-semibold text-slate-500">Waste Prevented</p>
              <p className="mt-1.5 text-2xl font-extrabold text-slate-900 stat-value">{sum.waste_saved_kg} kg</p>
              <p className="text-xs text-slate-400 mt-1">{sum.waste_reduction_pct}% less than single-batch</p>
            </div>
            <div className="card-surface p-5">
              <p className="text-xs font-semibold text-slate-500">Meal Savings</p>
              <p className="mt-1.5 text-2xl font-extrabold text-slate-900 stat-value">
                ₹{Math.round(sum.cost_saved_inr || 0).toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-slate-400 mt-1">CO₂ avoided: {sum.co2_saved_kg} kg</p>
            </div>
            <div className="card-surface p-5">
              <p className="text-xs font-semibold text-slate-500">Meal Sufficiency</p>
              <p className="mt-1.5 text-2xl font-extrabold text-sky-700 stat-value">{sum.meal_sufficiency_pct}%</p>
              <p className="text-xs text-slate-400 mt-1">Predicted demand: {sum.total_predicted_servings} serv</p>
            </div>
          </section>

          {opt.bottleneck_ingredients?.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-xs text-amber-950">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Stock constraint active:</strong> OR-Tools capped preparation to fit available{' '}
                <strong>{opt.bottleneck_ingredients.join(', ')}</strong>.
              </span>
            </div>
          )}

          {/* Visual Dish Batch Cards + Ingredient Stock */}
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            <div className="xl:col-span-2 space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-700" />
                  Kitchen Prep Cards ({form.meal_slot})
                </h3>
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Initial Batch
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> On-Demand Reserve
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {opt.items.map((item) => {
                  const fc = fcLookup[item.menu_item_id] || {};
                  const totalCap = Math.max(1, item.max_capacity_servings);
                  const initPct = Math.round((item.initial_servings / totalCap) * 100);
                  const resPct = 100 - initPct;

                  return (
                    <div key={item.menu_item_id} className="card-surface p-5 space-y-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{item.name}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {item.category} &bull; {item.batch_size} serv/batch
                          </p>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs stat-value">
                          Save ₹{Math.round(item.savings_inr)}
                        </span>
                      </div>

                      {/* Visual Two-Stage Bar */}
                      <div className="space-y-1.5">
                        <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex">
                          <div className="bg-emerald-600 h-full" style={{ width: `${initPct}%` }} />
                          <div className="bg-sky-500 h-full" style={{ width: `${resPct}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-xs stat-value">
                          <span className="font-semibold text-emerald-800">
                            Initial: {item.initial_batches}b ({item.initial_servings})
                          </span>
                          <span className="font-semibold text-sky-700">
                            {item.reserve_batches > 0 ? `+${item.reserve_batches}b Reserve (${item.reserve_servings})` : 'No reserve'}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 stat-value">
                        <span>
                          Forecast: <strong className="text-slate-800">{item.predicted_servings}</strong> ({item.p10_servings}–{item.p90_servings})
                        </span>
                        <span>
                          Legacy: {item.traditional_prep_servings} &bull; RF {fc.rf_prediction ?? '-'} / XGB {fc.xgb_prediction ?? '-'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ingredient Utilization */}
            <div className="card-surface p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-sky-700" />
                <h3 className="text-sm font-bold text-slate-900">Pantry Stock Check</h3>
              </div>
              <div className="space-y-3.5 max-h-[420px] overflow-y-auto pr-1">
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
          </section>
        </>
      )}
    </div>
  );
}

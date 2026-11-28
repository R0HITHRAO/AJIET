import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Flame,
  Layers,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../api';

const MEAL_SLOTS = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];
const DEFAULT_ATTENDANCE = { Breakfast: 610, Lunch: 740, Snacks: 520, Dinner: 690 };
const MODEL_LABELS = {
  optimal: 'Optimal',
  ensemble: 'Ensemble (RF + XGB)',
  xgboost: 'XGBoost',
  random_forest: 'Random Forest',
  baseline: 'Statistical Baseline',
};

export default function ForecastBatchPlanner({ initialSlot = 'Lunch', onDataUpdated }) {
  const [slotAttendance, setSlotAttendance] = useState(DEFAULT_ATTENDANCE);
  const [form, setForm] = useState({
    date: '2026-11-28',
    meal_slot: initialSlot,
    expected_attendance: DEFAULT_ATTENDANCE[initialSlot] || 740,
    weather: 'Cloudy',
    temperature_c: 28.0,
    special_event: 'None',
    is_holiday: false,
    model_choice: 'optimal',
    batch_cooking_enabled: true,
    waste_penalty_per_serving: 28,
    shortage_penalty_per_serving: 55,
  });

  const [slotMenu, setSlotMenu] = useState([]);
  const [excludedIds, setExcludedIds] = useState([]);
  const [firedReserves, setFiredReserves] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [optResult, setOptResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [error, setError] = useState('');
  const requestSeqRef = useRef(0);
  const abortRef = useRef(null);
  const menuCacheRef = useRef({});
  const initializedRef = useRef(false);

  useEffect(() => () => abortRef.current?.abort(), []);

  const runPlan = async (save = false, targetForm = form, targetExcluded = excludedIds, menuOverride = null) => {
    const reqId = ++requestSeqRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError('');
    if (save) setSavedMsg('');
    try {
      let menuList = menuOverride || menuCacheRef.current[targetForm.meal_slot];
      if (!menuList) {
        menuList = (await api.getMenu(targetForm.meal_slot, { signal: controller.signal })).items || [];
        menuCacheRef.current[targetForm.meal_slot] = menuList;
      }
      if (reqId !== requestSeqRef.current || controller.signal.aborted) return;
      setSlotMenu(menuList);
      const activeIds = menuList
        .map((m) => m.menu_item_id)
        .filter((id) => !targetExcluded.includes(id));

      const payload = { ...targetForm, menu_item_ids: activeIds };
      // Single backend call returns both ML forecast items and OR-Tools batch optimization
      const optRes = await api.optimizeBatch(payload, save, { signal: controller.signal });
      const fcRes = optRes.forecast || (await api.forecast(payload, { signal: controller.signal }));
      if (reqId !== requestSeqRef.current || controller.signal.aborted) return;
      setForecast(fcRes);
      setOptResult(optRes);
      if (!save) setFiredReserves({});
      if (save && optRes.saved_plan_id) {
        setSavedMsg(`Preparation plan saved (${optRes.saved_plan_id})`);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (reqId === requestSeqRef.current) setError(err.message);
    } finally {
      if (reqId === requestSeqRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    api.getMealLogs(400, '', { signal: controller.signal }).then((res) => {
      const grouped = {};
      for (const log of res.logs || []) {
        if (log.is_holiday) continue;
        const slot = log.meal_slot;
        const att = Number(log.actual_attendance || log.expected_attendance || 0);
        if (!slot || att <= 0) continue;
        (grouped[slot] ||= []).push(att);
      }
      const dynamicDefaults = { ...DEFAULT_ATTENDANCE };
      for (const slot of MEAL_SLOTS) {
        const vals = grouped[slot];
        if (vals?.length) {
          dynamicDefaults[slot] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length / 10) * 10;
        }
      }
      setSlotAttendance(dynamicDefaults);
    }).catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const nextForm = {
      ...form,
      meal_slot: initialSlot,
      expected_attendance: slotAttendance[initialSlot] || DEFAULT_ATTENDANCE[initialSlot] || form.expected_attendance,
    };
    initializedRef.current = false;
    setForm(nextForm);
    setExcludedIds([]);
    setConfirmDeleteId(null);
    runPlan(false, nextForm, []);
  }, [initialSlot]);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return undefined;
    }
    const timer = setTimeout(() => {
      runPlan(false, form, excludedIds, slotMenu.length ? slotMenu : null);
    }, 220);
    return () => clearTimeout(timer);
  }, [
    form.date,
    form.expected_attendance,
    form.weather,
    form.temperature_c,
    form.special_event,
    form.is_holiday,
    form.model_choice,
    form.batch_cooking_enabled,
  ]);

  const handleSlotChange = (slot) => {
    const nextForm = {
      ...form,
      meal_slot: slot,
      expected_attendance: slotAttendance[slot] || DEFAULT_ATTENDANCE[slot] || form.expected_attendance,
    };
    initializedRef.current = false;
    setForm(nextForm);
    setExcludedIds([]);
    setConfirmDeleteId(null);
    setSavedMsg('');
    runPlan(false, nextForm, []);
  };

  const handleSkipDish = (menuItemId) => {
    if (excludedIds.includes(menuItemId)) return;
    const nextExcluded = [...excludedIds, menuItemId];
    setExcludedIds(nextExcluded);
    setConfirmDeleteId(null);
    runPlan(false, form, nextExcluded, slotMenu);
  };

  const handleRestoreDish = (menuItemId) => {
    const nextExcluded = excludedIds.filter((id) => id !== menuItemId);
    setExcludedIds(nextExcluded);
    runPlan(false, form, nextExcluded, slotMenu);
  };

  const handleDeleteDishAndHistory = async (menuItemId, dishName) => {
    setDeletingId(menuItemId);
    setError('');
    setSavedMsg('');
    try {
      const res = await api.deleteMenuItem(menuItemId, true, true);
      const nextMenu = slotMenu.filter((m) => m.menu_item_id !== menuItemId);
      menuCacheRef.current[form.meal_slot] = nextMenu;
      const nextExcluded = excludedIds.filter((id) => id !== menuItemId);
      setSlotMenu(nextMenu);
      setExcludedIds(nextExcluded);
      setConfirmDeleteId(null);
      setSavedMsg(
        `Removed "${dishName}" from menu and deleted ${res.removed_logs_count} historical meal record(s).`
      );
      await runPlan(false, form, nextExcluded, nextMenu);
      onDataUpdated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleFireReserveBatch = (item) => {
    const current = firedReserves[item.menu_item_id] || 0;
    if (current >= item.reserve_batches) return;
    setFiredReserves({ ...firedReserves, [item.menu_item_id]: current + 1 });
  };

  const opt = optResult?.optimization;
  const sum = opt?.summary || {};
  const fcLookup = useMemo(
    () => Object.fromEntries((forecast?.items || []).map((i) => [i.menu_item_id, i])),
    [forecast]
  );
  const skippedItems = useMemo(
    () => slotMenu.filter((m) => excludedIds.includes(m.menu_item_id)),
    [slotMenu, excludedIds]
  );

  const extraFiredServings = useMemo(
    () => (opt?.items || []).reduce((acc, it) => acc + (firedReserves[it.menu_item_id] || 0) * it.batch_size, 0),
    [opt, firedReserves]
  );

  return (
    <div className="space-y-6">
      {/* Flagship Meal Planner Banner */}
      <section className="module-banner">
        <div className="absolute inset-0 hero-grid-overlay pointer-events-none opacity-45" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-teal-300">
              <Cpu className="w-3.5 h-3.5 text-teal-300" />
              Two-Stage OR-Tools Kitchen Planner
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight">
              {form.meal_slot} Demand &amp; Batch Schedule
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <span>
                Active Model:{' '}
                <strong className="text-white">
                  {form.model_choice === 'optimal' && forecast?.applied_model
                    ? `Optimal → ${MODEL_LABELS[forecast.applied_model] || forecast.applied_model}`
                    : MODEL_LABELS[forecast?.applied_model || form.model_choice] || form.model_choice}
                </strong>
              </span>
              <span className="text-white/30">&bull;</span>
              <span>
                Solver: <strong className="text-teal-300">{opt?.solver_status || 'READY'}</strong>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => runPlan(true)}
              disabled={loading}
              className="h-10 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 backdrop-blur-sm transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Save Plan
            </button>
            <button
              onClick={() => runPlan(false)}
              disabled={loading}
              className="h-10 px-4 rounded-xl bg-white text-emerald-950 hover:bg-emerald-50 text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-sm transition disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-emerald-700" />
              {loading ? 'Optimizing...' : 'Update Batch Plan'}
            </button>
          </div>
        </div>
      </section>

      {/* Top Meal Slot Pills + Parameters */}
      <section className="card-surface p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="segmented-track flex-wrap">
            {MEAL_SLOTS.map((slot) => (
              <button
                key={slot}
                onClick={() => handleSlotChange(slot)}
                className={`segmented-pill px-4 py-2 text-xs sm:text-sm ${
                  form.meal_slot === slot
                    ? 'bg-white text-emerald-900 shadow-sm ring-1 ring-emerald-900/5'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {slot}
              </button>
            ))}
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
              <option value="optimal">Optimal (Auto-Best)</option>
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
          <div className="flex flex-wrap items-center gap-4 text-slate-500">
            <span>
              Forecast Model:{' '}
              <strong className="text-sky-700">
                {form.model_choice === 'optimal' && forecast?.applied_model
                  ? `Optimal → ${MODEL_LABELS[forecast.applied_model] || forecast.applied_model}`
                  : MODEL_LABELS[forecast?.applied_model || form.model_choice] || form.model_choice}
              </strong>
            </span>
            <span>
              OR-Tools Status: <strong className="text-emerald-700">{opt?.solver_status || 'READY'}</strong>
            </span>
          </div>
        </div>

        {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>}
        {savedMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {savedMsg}
          </div>
        )}
      </section>

      {/* Summary Strip */}
      {opt && (
        <>
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card p-5 overflow-hidden">
              <div className="h-1 -mx-5 -mt-5 mb-3.5 bg-gradient-to-r from-emerald-600 to-teal-400" />
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Cooked Batches</p>
              <p className="mt-1.5 text-2xl font-extrabold text-emerald-700 stat-value">
                {((sum.total_initial_servings ?? 0) + extraFiredServings).toLocaleString()} serv
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {Math.max(0, (sum.total_reserve_servings ?? 0) - extraFiredServings).toLocaleString()} standby reserve remaining
              </p>
            </div>
            <div className="stat-card p-5 overflow-hidden">
              <div className="h-1 -mx-5 -mt-5 mb-3.5 bg-gradient-to-r from-slate-700 to-slate-400" />
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Waste Prevented</p>
              <p className="mt-1.5 text-2xl font-extrabold text-slate-900 stat-value">
                {sum.waste_saved_kg ?? 0} kg
              </p>
              <p className="text-xs text-slate-400 mt-1">{sum.waste_reduction_pct ?? 0}% less than single-batch</p>
            </div>
            <div className="stat-card p-5 overflow-hidden">
              <div className="h-1 -mx-5 -mt-5 mb-3.5 bg-gradient-to-r from-amber-500 to-orange-400" />
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Meal Savings</p>
              <p className="mt-1.5 text-2xl font-extrabold text-slate-900 stat-value">
                ₹{Math.round(sum.cost_saved_inr || 0).toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-slate-400 mt-1">CO₂ avoided: {sum.co2_saved_kg ?? 0} kg</p>
            </div>
            <div className="stat-card p-5 overflow-hidden">
              <div className="h-1 -mx-5 -mt-5 mb-3.5 bg-gradient-to-r from-sky-600 to-cyan-400" />
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Meal Sufficiency</p>
              <p className="mt-1.5 text-2xl font-extrabold text-sky-700 stat-value">
                {sum.meal_sufficiency_pct ?? 100}%
              </p>
              <p className="text-xs text-slate-400 mt-1">Predicted demand: {sum.total_predicted_servings ?? 0} serv</p>
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

          {/* Skipped Dishes Restore Strip */}
          {skippedItems.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-600">Skipped for this meal:</span>
                {skippedItems.map((m) => (
                  <button
                    key={m.menu_item_id}
                    onClick={() => handleRestoreDish(m.menu_item_id)}
                    className="px-2.5 py-1 rounded-full bg-white border border-slate-300 text-slate-700 hover:border-emerald-500 hover:text-emerald-700 font-semibold inline-flex items-center gap-1 transition"
                  >
                    <RotateCcw className="w-3 h-3" />
                    {m.name}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setExcludedIds([]);
                  runPlan(false, form, [], slotMenu);
                }}
                className="font-semibold text-emerald-700 hover:underline"
              >
                Restore all
              </button>
            </div>
          )}

          {/* Visual Dish Batch Cards + Ingredient Stock */}
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            <div className="xl:col-span-2 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-700" />
                  Kitchen Prep Cards ({form.meal_slot})
                </h3>
                <div className="flex items-center gap-4 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Cooked Now
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Standby Reserve
                  </span>
                </div>
              </div>

              {opt.items.length === 0 ? (
                <div className="card-surface p-10 text-center space-y-2">
                  <p className="text-sm font-semibold text-slate-700">No dishes selected for {form.meal_slot}.</p>
                  <p className="text-xs text-slate-500">
                    Restore skipped dishes above or click Reset in the top bar to restore the default menu.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {opt.items.map((item) => {
                    const fc = fcLookup[item.menu_item_id] || {};
                    const firedCount = firedReserves[item.menu_item_id] || 0;
                    const cookedServings = item.initial_servings + firedCount * item.batch_size;
                    const remainingReserveBatches = Math.max(0, item.reserve_batches - firedCount);
                    const remainingReserveServings = remainingReserveBatches * item.batch_size;
                    const totalCap = Math.max(1, item.max_capacity_servings);
                    const cookedPct = Math.round((cookedServings / totalCap) * 100);
                    const resPct = 100 - cookedPct;
                    const isConfirming = confirmDeleteId === item.menu_item_id;

                    return (
                      <div key={item.menu_item_id} className="card-interactive p-5 space-y-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm">{item.name}</h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {item.category} &bull; {item.batch_size} serv/batch
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs stat-value mr-1">
                              Save ₹{Math.round(item.savings_inr)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSkipDish(item.menu_item_id)}
                              title="Skip dish for this meal"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmDeleteId(isConfirming ? null : item.menu_item_id)
                              }
                              title="Remove dish & delete history"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* AI Forecast Driver Badges */}
                        {fc.driver_tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {fc.driver_tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {isConfirming && (
                          <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between gap-2 text-xs">
                            <span className="text-red-900 font-medium">
                              Remove dish &amp; all its meal history?
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 font-semibold"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={deletingId === item.menu_item_id}
                                onClick={() => handleDeleteDishAndHistory(item.menu_item_id, item.name)}
                                className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold"
                              >
                                {deletingId === item.menu_item_id ? 'Removing...' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Visual Two-Stage Bar */}
                        <div className="space-y-1.5">
                          <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex">
                            <div className="bg-emerald-600 h-full transition-all duration-300" style={{ width: `${cookedPct}%` }} />
                            <div className="bg-sky-500 h-full transition-all duration-300" style={{ width: `${resPct}%` }} />
                          </div>
                          <div className="flex items-center justify-between text-xs stat-value">
                            <span className="font-semibold text-emerald-800">
                              Cooked: {item.initial_batches + firedCount}b ({cookedServings})
                            </span>
                            <span className="font-semibold text-sky-700">
                              {remainingReserveBatches > 0
                                ? `+${remainingReserveBatches}b Reserve (${remainingReserveServings})`
                                : item.reserve_batches > 0
                                ? 'All reserves fired'
                                : 'No reserve'}
                            </span>
                          </div>
                        </div>

                        {/* Produce Additional Batch Button (Batch-Wise Cooking) */}
                        {item.reserve_batches > 0 && (
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              disabled={remainingReserveBatches <= 0}
                              onClick={() => handleFireReserveBatch(item)}
                              className="w-full h-8 rounded-xl border border-sky-200 bg-sky-50/70 hover:bg-sky-100 text-sky-800 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                            >
                              <Flame className="w-3.5 h-3.5" />
                              {remainingReserveBatches > 0
                                ? `Produce Additional Batch (+${item.batch_size} serv)`
                                : 'Reserve Batches Produced'}
                            </button>
                          </div>
                        )}

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
              )}
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

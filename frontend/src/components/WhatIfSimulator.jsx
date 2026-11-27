import React, { useEffect, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, Play, RefreshCw } from 'lucide-react';
import { api } from '../api';

const SLOT_ATTENDANCE = { Breakfast: 610, Lunch: 740, Snacks: 520, Dinner: 690 };

const PRESETS = [
  {
    name: 'Rainy Drop (-25%)',
    patch: {
      attendance_delta_pct: -25,
      weather: 'Rainy',
      temperature_c: 23.5,
      is_holiday: false,
      special_event: 'None',
      batch_cooking_enabled: true,
      ingredient_stock_pct_overrides: {},
    },
  },
  {
    name: 'Hackathon (+30%)',
    patch: {
      attendance_delta_pct: 30,
      weather: 'Cloudy',
      temperature_c: 27.5,
      is_holiday: false,
      special_event: 'Hackathon',
      batch_cooking_enabled: true,
      ingredient_stock_pct_overrides: {},
    },
  },
  {
    name: 'Paneer Shock (20%)',
    patch: {
      attendance_delta_pct: 5,
      weather: 'Cloudy',
      temperature_c: 28.0,
      is_holiday: false,
      special_event: 'None',
      batch_cooking_enabled: true,
      ingredient_stock_pct_overrides: { ing_paneer: 20, ing_mixed_veg: 30 },
    },
  },
  {
    name: 'Batch Cooking OFF',
    patch: {
      attendance_delta_pct: 0,
      weather: 'Cloudy',
      temperature_c: 28.0,
      is_holiday: false,
      special_event: 'None',
      batch_cooking_enabled: false,
      ingredient_stock_pct_overrides: {},
    },
  },
];

export default function WhatIfSimulator() {
  const [menuItems, setMenuItems] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [simReq, setSimReq] = useState({
    date: '2026-11-28',
    meal_slot: 'Lunch',
    base_attendance: 740,
    attendance_delta_pct: -20,
    is_holiday: false,
    special_event: 'None',
    weather: 'Rainy',
    temperature_c: 24.0,
    model_choice: 'optimal',
    batch_cooking_enabled: true,
    menu_swaps: {},
    ingredient_stock_pct_overrides: {},
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef(null);
  const requestSeqRef = useRef(0);
  const initializedRef = useRef(false);

  const runSimulation = async (payload = simReq) => {
    const reqId = ++requestSeqRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError('');
    try {
      const res = await api.simulate(payload, { signal: controller.signal });
      if (reqId !== requestSeqRef.current || controller.signal.aborted) return;
      setResult(res);
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (reqId === requestSeqRef.current) setError(err.message);
    } finally {
      if (reqId === requestSeqRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([api.getMenu(), api.getIngredients()]).then(([mRes, iRes]) => {
      setMenuItems(mRes.items || []);
      setIngredients(iRes.items || []);
    });
    runSimulation(simReq);
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return undefined;
    }
    const timer = setTimeout(() => {
      runSimulation(simReq);
    }, 220);
    return () => clearTimeout(timer);
  }, [
    simReq.meal_slot,
    simReq.base_attendance,
    simReq.attendance_delta_pct,
    simReq.is_holiday,
    simReq.special_event,
    simReq.weather,
    simReq.temperature_c,
    simReq.batch_cooking_enabled,
    simReq.menu_swaps,
    simReq.ingredient_stock_pct_overrides,
  ]);

  const applyPreset = (preset) => {
    const updated = { ...simReq, ...preset.patch };
    setSimReq(updated);
  };

  const slotItems = menuItems.filter((m) => m.meal_slot === simReq.meal_slot);
  const keyIngredients = ingredients.filter((i) =>
    ['ing_rice', 'ing_paneer', 'ing_toor_dal', 'ing_mixed_veg'].includes(i.ingredient_id)
  );

  const baseSum = result?.baseline?.optimization?.summary || {};
  const simSum = result?.simulated?.optimization?.summary || {};
  const deltas = result?.deltas || {};

  const chartData = result
    ? [
        {
          metric: 'Predicted Demand',
          Baseline: baseSum.total_predicted_servings || 0,
          Simulated: simSum.total_predicted_servings || 0,
        },
        {
          metric: 'Initial Batch',
          Baseline: baseSum.total_initial_servings || 0,
          Simulated: simSum.total_initial_servings || 0,
        },
        {
          metric: 'Reserve Batch',
          Baseline: baseSum.total_reserve_servings || 0,
          Simulated: simSum.total_reserve_servings || 0,
        },
      ]
    : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Ordered Scenario Builder */}
      <aside className="lg:col-span-4 card-surface p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Scenario Builder</h3>
          <button
            onClick={() => runSimulation(simReq)}
            disabled={loading}
            className="btn-primary h-9 px-3.5 text-xs"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Simulate
          </button>
        </div>

        {/* Presets */}
        <div>
          <p className="field-label">Quick Presets</p>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => applyPreset(p)}
                className="text-left text-xs font-semibold px-3 py-2 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 transition"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* 1. Attendance & Context */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <p className="field-label">1. Attendance &amp; Context</p>
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1.5">
              <span className="text-slate-600">Turnout Change</span>
              <span className="text-emerald-700 stat-value">
                {simReq.attendance_delta_pct >= 0 ? '+' : ''}
                {simReq.attendance_delta_pct}% ({Math.round(simReq.base_attendance * (1 + simReq.attendance_delta_pct / 100))})
              </span>
            </div>
            <input
              type="range"
              min="-50"
              max="60"
              step="5"
              value={simReq.attendance_delta_pct}
              onChange={(e) => setSimReq({ ...simReq, attendance_delta_pct: Number(e.target.value) })}
              className="w-full accent-emerald-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Meal Slot</label>
              <select
                value={simReq.meal_slot}
                onChange={(e) => {
                  const slot = e.target.value;
                  setSimReq({
                    ...simReq,
                    meal_slot: slot,
                    base_attendance: SLOT_ATTENDANCE[slot] || simReq.base_attendance,
                    menu_swaps: {},
                  });
                }}
                className="field-control h-9 text-xs"
              >
                {['Breakfast', 'Lunch', 'Snacks', 'Dinner'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Weather</label>
              <select
                value={simReq.weather}
                onChange={(e) => setSimReq({ ...simReq, weather: e.target.value })}
                className="field-control h-9 text-xs"
              >
                {['Sunny', 'Cloudy', 'Rainy', 'Humid'].map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Special Event</label>
              <select
                value={simReq.special_event}
                onChange={(e) => setSimReq({ ...simReq, special_event: e.target.value })}
                className="field-control h-9 text-xs"
              >
                {['None', 'Exam Week', 'Tech Fest', 'Sports Day', 'Hackathon', 'Parent Meet'].map((ev) => (
                  <option key={ev} value={ev}>{ev}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 h-9 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={simReq.batch_cooking_enabled}
                onChange={(e) => setSimReq({ ...simReq, batch_cooking_enabled: e.target.checked })}
                className="rounded accent-emerald-700"
              />
              Batch Cooking ON
            </label>
          </div>
        </div>

        {/* 2. Ingredient Availability */}
        <div className="pt-4 border-t border-slate-100 space-y-2.5">
          <p className="field-label">2. Ingredient Stock Availability</p>
          {keyIngredients.map((ing) => {
            const pct = simReq.ingredient_stock_pct_overrides[ing.ingredient_id] ?? 100;
            return (
              <div key={ing.ingredient_id}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700">{ing.name}</span>
                  <span className={`stat-value font-semibold ${pct < 50 ? 'text-amber-700' : 'text-slate-500'}`}>
                    {pct}% ({((ing.stock_qty * pct) / 100).toFixed(1)} {ing.unit})
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="120"
                  step="10"
                  value={pct}
                  onChange={(e) =>
                    setSimReq({
                      ...simReq,
                      ingredient_stock_pct_overrides: {
                        ...simReq.ingredient_stock_pct_overrides,
                        [ing.ingredient_id]: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full accent-amber-600"
                />
              </div>
            );
          })}
        </div>

        {/* 3. Menu Swaps */}
        <div className="pt-4 border-t border-slate-100 space-y-2.5">
          <p className="field-label">3. Menu Dish Swaps</p>
          {slotItems.slice(0, 3).map((item) => (
            <div key={item.menu_item_id}>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Replace {item.name}
              </label>
              <select
                value={simReq.menu_swaps[item.menu_item_id] || item.menu_item_id}
                onChange={(e) => {
                  const val = e.target.value;
                  const next = { ...simReq.menu_swaps };
                  if (val === item.menu_item_id) delete next[item.menu_item_id];
                  else next[item.menu_item_id] = val;
                  setSimReq({ ...simReq, menu_swaps: next });
                }}
                className="field-control h-9 text-xs"
              >
                <option value={item.menu_item_id}>Keep: {item.name}</option>
                {menuItems
                  .filter((alt) => alt.menu_item_id !== item.menu_item_id)
                  .map((alt) => (
                    <option key={alt.menu_item_id} value={alt.menu_item_id}>
                      Swap → {alt.name}
                    </option>
                  ))}
              </select>
            </div>
          ))}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
      </aside>

      {/* Right Column: Live Comparison Stage */}
      <div className="lg:col-span-8 space-y-6">
        {result && (
          <>
            {/* Delta Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="card-surface p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Demand Shift</p>
                <p className="mt-1.5 text-xl font-extrabold text-slate-900 stat-value">
                  {deltas.predicted_servings_delta >= 0 ? '+' : ''}
                  {deltas.predicted_servings_delta} serv
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {baseSum.total_predicted_servings} → {simSum.total_predicted_servings}
                </p>
              </div>
              <div className="card-surface p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Initial Batch</p>
                <p className="mt-1.5 text-xl font-extrabold text-emerald-700 stat-value">
                  {deltas.initial_prep_delta >= 0 ? '+' : ''}
                  {deltas.initial_prep_delta} serv
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {baseSum.total_initial_servings} → {simSum.total_initial_servings}
                </p>
              </div>
              <div className="card-surface p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Waste Delta</p>
                <p className="mt-1.5 text-xl font-extrabold text-slate-900 stat-value">
                  {deltas.waste_kg_delta >= 0 ? '+' : ''}
                  {deltas.waste_kg_delta} kg
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Simulated: {simSum.expected_waste_kg_optimized} kg
                </p>
              </div>
              <div className="card-surface p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Sufficiency</p>
                <p className="mt-1.5 text-xl font-extrabold text-sky-700 stat-value">
                  {simSum.meal_sufficiency_pct}%
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Shortage risk: {simSum.shortage_risk_servings} serv
                </p>
              </div>
            </div>

            {/* Advisories */}
            {result.advisories?.length > 0 && (
              <div className="space-y-2">
                {result.advisories.map((adv, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-center gap-2.5 font-medium"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    {adv}
                  </div>
                ))}
              </div>
            )}

            {/* Comparison Chart */}
            <div className="card-surface p-6">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Baseline vs Simulated Plan (Servings)</h3>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="metric" tick={{ fontSize: 12, fill: '#475569' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="Baseline" fill="#cbd5e1" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Simulated" fill="#059669" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Dish Output Table */}
            <div className="card-surface p-6 overflow-x-auto">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Simulated Batch Output by Dish</h3>
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] text-slate-400 uppercase">
                    <th className="py-2.5 pr-3">Dish</th>
                    <th className="py-2.5 px-2">Forecast</th>
                    <th className="py-2.5 px-2">Initial Batch</th>
                    <th className="py-2.5 px-2">Reserve Batch</th>
                    <th className="py-2.5 pl-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(result.simulated?.optimization?.items || []).map((it) => (
                    <tr key={it.menu_item_id}>
                      <td className="py-3 pr-3 font-semibold text-slate-800">{it.name}</td>
                      <td className="py-3 px-2 stat-value">{it.predicted_servings}</td>
                      <td className="py-3 px-2 font-bold text-emerald-700 stat-value">{it.initial_servings}</td>
                      <td className="py-3 px-2 text-sky-700 stat-value">{it.reserve_servings}</td>
                      <td className="py-3 pl-2 text-right">
                        {it.stock_constrained ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                            Stock Capped
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                            Optimal
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

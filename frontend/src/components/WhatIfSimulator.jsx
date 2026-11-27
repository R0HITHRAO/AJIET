import React, { useEffect, useState } from 'react';
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
import { AlertTriangle, FlaskConical, Play, RefreshCw } from 'lucide-react';
import { api } from '../api';

const PRESETS = [
  {
    name: 'Rainy Attendance Drop (-25%)',
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
    name: 'Hackathon / Tech Fest (+30%)',
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
    name: 'Paneer & Veg Supply Shock',
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
    name: 'Batch Cooking OFF (Legacy)',
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
    model_choice: 'ensemble',
    batch_cooking_enabled: true,
    menu_swaps: {},
    ingredient_stock_pct_overrides: {},
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.getMenu(), api.getIngredients()]).then(([mRes, iRes]) => {
      setMenuItems(mRes.items || []);
      setIngredients(iRes.items || []);
    });
    runSimulation(simReq);
  }, []);

  const runSimulation = async (payload = simReq) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.simulate(payload);
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (preset) => {
    const updated = { ...simReq, ...preset.patch };
    setSimReq(updated);
    runSimulation(updated);
  };

  const slotItems = menuItems.filter((m) => m.meal_slot === simReq.meal_slot);
  const keyIngredients = ingredients.filter((i) =>
    ['ing_rice', 'ing_paneer', 'ing_toor_dal', 'ing_mixed_veg', 'ing_wheat', 'ing_curd'].includes(i.ingredient_id)
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
    <div className="space-y-6">
      <div className="card-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-emerald-700" />
              What-If Kitchen Simulator
            </h2>
            <p className="text-xs text-slate-500">
              Evaluate attendance fluctuations, menu substitutions, and ingredient shortages before cooking begins
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => runSimulation(simReq)}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold flex items-center gap-2 transition"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Run Simulation
            </button>
          </div>
        </div>

        {/* Scenario Presets */}
        <div className="flex flex-wrap gap-2 mb-5">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => applyPreset(p)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 transition"
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Attendance & Context */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-3">
            <p className="text-xs font-bold uppercase text-slate-500">1. Attendance &amp; Context</p>
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span>Attendance Fluctuation</span>
                <span className={simReq.attendance_delta_pct >= 0 ? 'text-sky-700' : 'text-amber-700'}>
                  {simReq.attendance_delta_pct >= 0 ? '+' : ''}
                  {simReq.attendance_delta_pct}% ({Math.round(simReq.base_attendance * (1 + simReq.attendance_delta_pct / 100))} people)
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
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Meal Slot</label>
                <select
                  value={simReq.meal_slot}
                  onChange={(e) => setSimReq({ ...simReq, meal_slot: e.target.value, menu_swaps: {} })}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white"
                >
                  {['Breakfast', 'Lunch', 'Snacks', 'Dinner'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Weather</label>
                <select
                  value={simReq.weather}
                  onChange={(e) => setSimReq({ ...simReq, weather: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white"
                >
                  {['Sunny', 'Cloudy', 'Rainy', 'Humid'].map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 items-center">
              <select
                value={simReq.special_event}
                onChange={(e) => setSimReq({ ...simReq, special_event: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white"
              >
                {['None', 'Exam Week', 'Tech Fest', 'Sports Day', 'Hackathon', 'Parent Meet'].map((ev) => (
                  <option key={ev} value={ev}>{ev}</option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={simReq.batch_cooking_enabled}
                  onChange={(e) => setSimReq({ ...simReq, batch_cooking_enabled: e.target.checked })}
                />
                Batch Cooking ON
              </label>
            </div>
          </div>

          {/* Menu Modifications */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2.5">
            <p className="text-xs font-bold uppercase text-slate-500">2. Menu Modifications (Swap Dish)</p>
            {slotItems.slice(0, 3).map((item) => (
              <div key={item.menu_item_id} className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600">Replace {item.name}</label>
                <select
                  value={simReq.menu_swaps[item.menu_item_id] || item.menu_item_id}
                  onChange={(e) => {
                    const val = e.target.value;
                    const next = { ...simReq.menu_swaps };
                    if (val === item.menu_item_id) delete next[item.menu_item_id];
                    else next[item.menu_item_id] = val;
                    setSimReq({ ...simReq, menu_swaps: next });
                  }}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs bg-white"
                >
                  <option value={item.menu_item_id}>Keep: {item.name}</option>
                  {menuItems
                    .filter((alt) => alt.menu_item_id !== item.menu_item_id)
                    .map((alt) => (
                      <option key={alt.menu_item_id} value={alt.menu_item_id}>
                        Swap → {alt.name} ({alt.meal_slot})
                      </option>
                    ))}
                </select>
              </div>
            ))}
          </div>

          {/* Ingredient Shortage Sliders */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2.5">
            <p className="text-xs font-bold uppercase text-slate-500">3. Ingredient Stock Availability (%)</p>
            {keyIngredients.slice(0, 4).map((ing) => {
              const pct = simReq.ingredient_stock_pct_overrides[ing.ingredient_id] ?? 100;
              return (
                <div key={ing.ingredient_id}>
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span>{ing.name}</span>
                    <span className={pct < 50 ? 'text-amber-700' : 'text-slate-600'}>
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
        </div>

        {error && <div className="mt-3 text-xs text-red-600">{error}</div>}
      </div>

      {/* Results Side-by-Side */}
      {result && (
        <>
          {result.advisories?.length > 0 && (
            <div className="space-y-2">
              {result.advisories.map((adv, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-center gap-2.5 font-medium"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  {adv}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card-surface p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase">Demand Shift</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900 stat-value">
                {deltas.predicted_servings_delta >= 0 ? '+' : ''}
                {deltas.predicted_servings_delta} serv
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {baseSum.total_predicted_servings} → {simSum.total_predicted_servings} servings
              </p>
            </div>
            <div className="card-surface p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase">Initial Batch Adjustment</p>
              <p className="mt-1 text-2xl font-extrabold text-emerald-700 stat-value">
                {deltas.initial_prep_delta >= 0 ? '+' : ''}
                {deltas.initial_prep_delta} serv
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {baseSum.total_initial_servings} → {simSum.total_initial_servings} servings
              </p>
            </div>
            <div className="card-surface p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase">Expected Waste Delta</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900 stat-value">
                {deltas.waste_kg_delta >= 0 ? '+' : ''}
                {deltas.waste_kg_delta} kg
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Simulated waste: {simSum.expected_waste_kg_optimized} kg
              </p>
            </div>
            <div className="card-surface p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase">Meal Sufficiency</p>
              <p className="mt-1 text-2xl font-extrabold text-sky-700 stat-value">
                {simSum.meal_sufficiency_pct}%
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Shortage risk: {simSum.shortage_risk_servings} servings
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card-surface p-5">
              <h3 className="text-base font-bold text-slate-900 mb-3">Baseline vs Simulated Plan (Servings)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="metric" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Baseline" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Simulated" fill="#059669" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card-surface p-5 overflow-x-auto">
              <h3 className="text-base font-bold text-slate-900 mb-3">Simulated Dish Batch Recommendations</h3>
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase">
                    <th className="py-2">Dish</th>
                    <th className="py-2">Forecast</th>
                    <th className="py-2">Initial</th>
                    <th className="py-2">Reserve</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(result.simulated?.optimization?.items || []).map((it) => (
                    <tr key={it.menu_item_id}>
                      <td className="py-2.5 font-semibold text-slate-800">{it.name}</td>
                      <td className="py-2.5 stat-value">{it.predicted_servings}</td>
                      <td className="py-2.5 font-bold text-emerald-700 stat-value">{it.initial_servings}</td>
                      <td className="py-2.5 text-sky-700 stat-value">{it.reserve_servings}</td>
                      <td className="py-2.5">
                        {it.stock_constrained ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                            Stock Capped
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                            Optimal
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

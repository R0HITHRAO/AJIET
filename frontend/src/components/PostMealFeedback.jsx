import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BrainCircuit,
  CheckCircle2,
  Download,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { api } from '../api';

export default function PostMealFeedback({ onDataUpdated }) {
  const [mealSlot, setMealSlot] = useState('Lunch');
  const [dateStr, setDateStr] = useState('2026-11-27');
  const [expectedAttendance, setExpectedAttendance] = useState(740);
  const [actualAttendance, setActualAttendance] = useState(650);
  const [weather, setWeather] = useState('Rainy');
  const [menuItems, setMenuItems] = useState([]);
  const [rows, setRows] = useState([]);
  const [autoRetrain, setAutoRetrain] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [retraining, setRetraining] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState(null);
  const [modelRuns, setModelRuns] = useState([]);
  const [mlSummary, setMlSummary] = useState(null);
  const [csvStatus, setCsvStatus] = useState('');
  const [error, setError] = useState('');

  const loadContext = async () => {
    const [mRes, rRes] = await Promise.all([api.getMenu(), api.getModelRuns()]);
    setMenuItems(mRes.items || []);
    setModelRuns(rRes.runs || []);
    setMlSummary(rRes.current || null);
  };

  useEffect(() => {
    loadContext();
  }, []);

  useEffect(() => {
    const slotItems = menuItems.filter((m) => m.meal_slot === mealSlot);
    if (!slotItems.length) return;
    setRows(
      slotItems.map((item, idx) => {
        const pred = Math.round(expectedAttendance * item.uptake_rate);
        const prep = Math.round(pred * 1.06);
        const serv = idx === 0 ? Math.max(20, prep - 75) : Math.max(20, prep - 12);
        return {
          menu_item_id: item.menu_item_id,
          name: item.name,
          requires_cold_chain: item.requires_cold_chain,
          predicted_servings: pred,
          prepared_servings: prep,
          served_servings: serv,
          holding_temp_c: item.requires_cold_chain ? 4.0 : 64.5,
          hours_since_cooked: 1.0,
          storage_type: item.requires_cold_chain ? 'chilled' : 'hot_hold',
          is_sealed: true,
          register_surplus: true,
        };
      })
    );
  }, [mealSlot, menuItems]);

  const updateRow = (idx, field, value) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setFeedbackResult(null);
    try {
      const res = await api.submitPostMealLog({
        date: dateStr,
        meal_slot: mealSlot,
        expected_attendance: Number(expectedAttendance),
        actual_attendance: Number(actualAttendance),
        weather,
        temperature_c: 26.5,
        auto_retrain: autoRetrain,
        items: rows.map((r) => ({
          menu_item_id: r.menu_item_id,
          prepared_servings: Number(r.prepared_servings),
          served_servings: Number(r.served_servings),
          predicted_servings: Number(r.predicted_servings),
          holding_temp_c: Number(r.holding_temp_c),
          hours_since_cooked: Number(r.hours_since_cooked),
          storage_type: r.storage_type,
          is_sealed: r.is_sealed,
          register_surplus: r.register_surplus,
        })),
      });
      setFeedbackResult(res);
      await loadContext();
      onDataUpdated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetrain = async () => {
    setRetraining(true);
    setError('');
    try {
      await api.retrainModels();
      await loadContext();
      onDataUpdated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setRetraining(false);
    }
  };

  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvStatus('Uploading & retraining models...');
    setError('');
    try {
      const res = await api.importMealLogsCsv(file, true);
      setCsvStatus(`Imported ${res.imported_count} records and retrained ML models (v${res.retrained_model?.version}).`);
      await loadContext();
      onDataUpdated?.();
    } catch (err) {
      setCsvStatus('');
      setError(err.message);
    }
  };

  const featureImp = mlSummary?.feature_importances?.slice(0, 7) || [];

  return (
    <div className="space-y-6">
      {/* Step 1 & 2: Post-Meal Feedback Form */}
      <form onSubmit={handleSubmit} className="card-surface p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Step 1 &amp; 2: Meal Turnout &amp; Leftover Telemetry</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Submit served counts and holding conditions; leftovers ≥ 10 servings trigger automatic safety inspection
            </p>
          </div>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Saving...' : 'Submit Post-Meal Record'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div>
            <label className="field-label">Date</label>
            <input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="field-control" />
          </div>
          <div>
            <label className="field-label">Meal Slot</label>
            <select value={mealSlot} onChange={(e) => setMealSlot(e.target.value)} className="field-control">
              {['Breakfast', 'Lunch', 'Snacks', 'Dinner'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Expected</label>
            <input
              type="number"
              value={expectedAttendance}
              onChange={(e) => setExpectedAttendance(Number(e.target.value))}
              className="field-control stat-value"
            />
          </div>
          <div>
            <label className="field-label">Actual Turnout</label>
            <input
              type="number"
              value={actualAttendance}
              onChange={(e) => setActualAttendance(Number(e.target.value))}
              className="field-control stat-value"
            />
          </div>
          <div>
            <label className="field-label">Weather</label>
            <select value={weather} onChange={(e) => setWeather(e.target.value)} className="field-control">
              {['Sunny', 'Cloudy', 'Rainy', 'Humid'].map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto pt-2">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] text-slate-400 uppercase">
                <th className="py-2.5 pr-3">Dish</th>
                <th className="py-2.5 px-2">Prepared</th>
                <th className="py-2.5 px-2">Served</th>
                <th className="py-2.5 px-2">Leftover</th>
                <th className="py-2.5 px-2">Storage</th>
                <th className="py-2.5 px-2">Temp (°C)</th>
                <th className="py-2.5 px-2">Age (h)</th>
                <th className="py-2.5 pl-2 text-center">Sealed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, idx) => {
                const leftover = Math.max(0, row.prepared_servings - row.served_servings);
                return (
                  <tr key={row.menu_item_id}>
                    <td className="py-3 pr-3 font-semibold text-slate-800">{row.name}</td>
                    <td className="py-3 px-2">
                      <input
                        type="number"
                        min="0"
                        value={row.prepared_servings}
                        onChange={(e) => updateRow(idx, 'prepared_servings', Number(e.target.value))}
                        className="w-20 h-9 rounded-lg border border-slate-200 px-2.5 stat-value"
                      />
                    </td>
                    <td className="py-3 px-2">
                      <input
                        type="number"
                        min="0"
                        value={row.served_servings}
                        onChange={(e) => updateRow(idx, 'served_servings', Number(e.target.value))}
                        className="w-20 h-9 rounded-lg border border-slate-200 px-2.5 stat-value"
                      />
                    </td>
                    <td className="py-3 px-2 font-bold stat-value">
                      <span
                        className={`px-2 py-1 rounded-lg ${
                          leftover >= 10 ? 'bg-amber-50 text-amber-800' : 'text-slate-500'
                        }`}
                      >
                        {leftover} serv
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <select
                        value={row.storage_type}
                        onChange={(e) => updateRow(idx, 'storage_type', e.target.value)}
                        className="h-9 rounded-lg border border-slate-200 px-2 bg-white"
                      >
                        <option value="hot_hold">Hot Hold</option>
                        <option value="chilled">Chilled</option>
                        <option value="ambient">Ambient</option>
                      </select>
                    </td>
                    <td className="py-3 px-2">
                      <input
                        type="number"
                        step="0.5"
                        value={row.holding_temp_c}
                        onChange={(e) => updateRow(idx, 'holding_temp_c', Number(e.target.value))}
                        className="w-16 h-9 rounded-lg border border-slate-200 px-2 stat-value"
                      />
                    </td>
                    <td className="py-3 px-2">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={row.hours_since_cooked}
                        onChange={(e) => updateRow(idx, 'hours_since_cooked', Number(e.target.value))}
                        className="w-16 h-9 rounded-lg border border-slate-200 px-2 stat-value"
                      />
                    </td>
                    <td className="py-3 pl-2 text-center">
                      <input
                        type="checkbox"
                        checked={row.is_sealed}
                        onChange={(e) => updateRow(idx, 'is_sealed', e.target.checked)}
                        className="rounded accent-emerald-700"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <label className="flex items-center gap-2 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={autoRetrain}
              onChange={(e) => setAutoRetrain(e.target.checked)}
              className="rounded accent-emerald-700"
            />
            Retrain Random Forest &amp; XGBoost automatically after saving
          </label>
        </div>

        {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>}

        {feedbackResult && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Saved {feedbackResult.logged_count} meal logs
                {feedbackResult.post_meal_mae !== null && ` • Post-Meal MAE: ${feedbackResult.post_meal_mae} servings`}
              </p>
              {feedbackResult.retrained_model && (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-700 text-white">
                  Model v{feedbackResult.retrained_model.version} active
                </span>
              )}
            </div>
            {feedbackResult.detected_surplus?.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {feedbackResult.detected_surplus.map((s) => (
                  <div
                    key={s.surplus_id}
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                      s.safety_passed ? 'bg-white border-emerald-300 text-slate-800' : 'bg-red-50 border-red-200 text-red-900'
                    }`}
                  >
                    {s.safety_passed ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-bold">
                        {s.menu_item_name} ({s.servings_available} serv)
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{s.safety_reasons?.[0]}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </form>

      {/* Step 3: CSV Import & ML Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-surface p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-4 h-4 text-sky-700" />
              Step 3: Actual Kitchen CSV Import &amp; Retraining
            </h3>
            <a href="/api/meal-logs/sample-csv" className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1">
              <Download className="w-3.5 h-3.5" />
              Sample CSV
            </a>
          </div>
          <p className="text-xs text-slate-500">
            Import actual hostel/canteen consumption logs to evaluate and retrain both forecasting models.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="btn-secondary cursor-pointer">
              Upload CSV File
              <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
            </label>
            <button type="button" onClick={handleRetrain} disabled={retraining} className="btn-primary">
              <RefreshCw className={`w-3.5 h-3.5 ${retraining ? 'animate-spin' : ''}`} />
              {retraining ? 'Retraining...' : 'Retrain Models'}
            </button>
          </div>
          {csvStatus && (
            <p className="text-xs font-semibold text-emerald-800 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
              {csvStatus}
            </p>
          )}
          <div className="pt-2">
            <p className="field-label">Model Version History</p>
            <div className="space-y-2 max-h-44 overflow-y-auto">
              {modelRuns.slice(0, 5).map((run) => (
                <div
                  key={run.version}
                  className="text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-slate-900">v{run.version}</span>{' '}
                    <span className="text-slate-500">({run.reason}) &bull; {run.training_samples} rows</span>
                  </div>
                  <span className="font-semibold text-emerald-700 stat-value">
                    MAE {run.metrics?.ensemble?.mae} &bull; R² {run.metrics?.ensemble?.r2}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card-surface p-6">
          <div className="flex items-center gap-2 mb-4">
            <BrainCircuit className="w-4 h-4 text-emerald-700" />
            <h3 className="text-sm font-bold text-slate-900">Top Demand Feature Drivers</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={featureImp} layout="vertical" margin={{ top: 4, right: 20, left: 28, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" unit="%" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis type="category" dataKey="feature" width={145} tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="importance_pct" name="Importance" fill="#059669" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

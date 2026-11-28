import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Download,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { api } from '../api';

export default function PostMealFeedback({ overviewData, initialSubTab = 'log', onDataUpdated }) {
  const [subTab, setSubTab] = useState(initialSubTab);
  const [mealSlot, setMealSlot] = useState('Lunch');
  const [dateStr, setDateStr] = useState('2026-11-27');
  const [expectedAttendance, setExpectedAttendance] = useState(740);
  const [actualAttendance, setActualAttendance] = useState(650);
  const [weather, setWeather] = useState('Rainy');
  const [isHoliday, setIsHoliday] = useState(false);
  const [specialEvent, setSpecialEvent] = useState('None');
  const [menuItems, setMenuItems] = useState([]);
  const [rows, setRows] = useState([]);
  const [predictionModel, setPredictionModel] = useState('');
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [autoRetrain, setAutoRetrain] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [retraining, setRetraining] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState(null);
  const [modelRuns, setModelRuns] = useState([]);
  const [mlSummary, setMlSummary] = useState(null);
  const [csvStatus, setCsvStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setSubTab(initialSubTab || 'log');
  }, [initialSubTab]);

  const contextAbortRef = useRef(null);

  const loadContext = async () => {
    contextAbortRef.current?.abort();
    const controller = new AbortController();
    contextAbortRef.current = controller;
    try {
      const [mRes, rRes] = await Promise.all([
        api.getMenu('', { signal: controller.signal }),
        api.getModelRuns({ signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return;
      setMenuItems(mRes.items || []);
      setModelRuns(rRes.runs || []);
      setMlSummary(rRes.current || null);
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    }
  };

  useEffect(() => {
    loadContext();
    return () => contextAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    const slotItems = menuItems.filter((m) => m.meal_slot === mealSlot);
    if (!slotItems.length) return;
    setRows(
      slotItems.map((item, idx) => {
        const estimatedDemand = Math.round(expectedAttendance * item.uptake_rate);
        const prep = Math.round(estimatedDemand * 1.06);
        const serv = idx === 0 ? Math.max(20, prep - 75) : Math.max(20, prep - 5);
        return {
          menu_item_id: item.menu_item_id,
          name: item.name,
          requires_cold_chain: item.requires_cold_chain,
          predicted_servings: null,
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

  useEffect(() => {
    const menuItemIds = menuItems.filter((item) => item.meal_slot === mealSlot).map((item) => item.menu_item_id);
    if (!menuItemIds.length) return undefined;
    const controller = new AbortController();
    setPredictionLoading(true);
    // Debounce forecast preview so typing attendance doesn't fire a POST per keystroke
    const timer = setTimeout(() => {
      api
        .forecast(
          {
            date: dateStr,
            meal_slot: mealSlot,
            expected_attendance: Number(expectedAttendance),
            weather,
            is_holiday: isHoliday,
            special_event: specialEvent,
            model_choice: 'optimal',
            menu_item_ids: menuItemIds,
          },
          { signal: controller.signal }
        )
        .then((forecast) => {
          if (controller.signal.aborted) return;
          const predictionByItem = Object.fromEntries(
            (forecast.items || []).map((item) => [item.menu_item_id, item.predicted_servings])
          );
          setPredictionModel(forecast.applied_model || forecast.model_choice);
          setRows((previous) =>
            previous.map((row) => ({
              ...row,
              predicted_servings: predictionByItem[row.menu_item_id] ?? null,
            }))
          );
          setPredictionLoading(false);
        })
        .catch((err) => {
          if (err.name === 'AbortError' || controller.signal.aborted) return;
          setPredictionModel('Unavailable');
          setRows((previous) => previous.map((row) => ({ ...row, predicted_servings: null })));
          setPredictionLoading(false);
        });
    }, 280);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [dateStr, expectedAttendance, isHoliday, mealSlot, menuItems, specialEvent, weather]);

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
        is_holiday: isHoliday,
        special_event: specialEvent,
        weather,
        temperature_c: 26.5,
        auto_retrain: autoRetrain,
        items: rows.map((r) => ({
          menu_item_id: r.menu_item_id,
          prepared_servings: Number(r.prepared_servings),
          served_servings: Number(r.served_servings),
          predicted_servings: r.predicted_servings == null ? null : Number(r.predicted_servings),
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

  const downloadSampleCsv = async () => {
    try {
      const csvText = await api.downloadSampleCsv();
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'nourish_ai_kitchen_sample.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  const exportEvaluationCsv = () => {
    const lines = [
      'Section,Name,MAE_Servings,WAPE_Pct,MAPE_Pct,R2,Notes',
      ...[
        { name: 'Adaptive Ensemble', m: ens, note: selectedModel === 'ensemble' ? 'Selected' : 'Candidate' },
        { name: 'XGBoost Regressor', m: xgb, note: selectedModel === 'xgboost' ? 'Selected' : 'Candidate' },
        { name: 'Random Forest', m: rf, note: selectedModel === 'random_forest' ? 'Selected' : 'Candidate' },
        { name: 'Dish + Weekday Baseline', m: baseline, note: selectedModel === 'baseline' ? 'Fallback' : 'Reference' },
      ].map(
        (r) =>
          `ModelValidation,${r.name},${r.m.mae ?? ''},${r.m.wape_pct ?? ''},${r.m.mape_pct ?? ''},${r.m.r2 ?? ''},${r.note}`
      ),
      ...(errorReview?.by_meal_slot || []).map(
        (row) => `WeeklyErrorBySlot,${row.group},${row.mae},${row.wape_pct},${row.mape_pct ?? ''},,${row.samples} records`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nourish_ai_evaluation_v${mlSummary?.model_version ?? 1}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const featureImp = mlSummary?.feature_importances?.slice(0, 7) || [];
  const scenarioImpacts = mlSummary?.scenario_impacts || [];
  const mlMetrics = mlSummary?.metrics || {};
  const rf = mlMetrics.random_forest || {};
  const xgb = mlMetrics.xgboost || {};
  const ens = mlMetrics.ensemble || {};
  const baseline = mlMetrics.baseline || {};
  const validation = mlMetrics.validation || {};
  const selectedModel = validation.selected_model || 'ensemble';
  const errorReview = overviewData?.forecast_error_review;
  const latestErrorWeek = errorReview?.weekly?.[errorReview.weekly.length - 1];

  return (
    <div className="space-y-6">
      {/* Flagship Feedback & AI Header */}
      <section className="module-banner">
        <div className="absolute inset-0 hero-grid-overlay pointer-events-none opacity-45" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-teal-300">
              Continuous Learning &amp; Model Accuracy
            </p>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight">
              Post-Meal Logging &amp; AI Validation
            </h2>
            <p className="text-xs text-slate-300">
              Active Model: <strong className="text-white">v{mlSummary?.model_version ?? 1}</strong> ({selectedModel}){' '}
              &bull; Training Rows: <strong className="text-white">{mlSummary?.training_samples?.toLocaleString() ?? '-'}</strong>{' '}
              &bull; WAPE: <strong className="text-teal-300">{ens.wape_pct ?? '-'}%</strong>
            </p>
          </div>
          <div className="inline-flex p-1 rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm flex-wrap gap-1">
            {[
              { id: 'log', label: 'Log Post-Meal Actuals' },
              { id: 'csv', label: 'CSV Import & Retrain' },
              { id: 'diagnostics', label: 'AI Validation & Accuracy' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setSubTab(t.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  subTab === t.id ? 'bg-white text-emerald-950 shadow-sm' : 'text-emerald-100 hover:bg-white/10'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Tab 1: Post-Meal Logging */}
      {subTab === 'log' && (
        <form onSubmit={handleSubmit} className="card-surface p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-emerald-700" />
                Record Meal Actuals &amp; Detect Surplus
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Any unserved leftover ≥ 10 servings is automatically screened for safe NGO redistribution
              </p>
            </div>
            <button type="submit" disabled={submitting || predictionLoading} className="btn-primary">
              {submitting ? 'Saving...' : 'Submit Meal Record'}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-4 items-end">
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
            <div>
              <label className="field-label">Campus Event</label>
              <select value={specialEvent} onChange={(e) => setSpecialEvent(e.target.value)} className="field-control">
                {['None', 'Exam Week', 'Tech Fest', 'Sports Day', 'Hackathon', 'Parent Meet'].map((ev) => (
                  <option key={ev} value={ev}>{ev}</option>
                ))}
              </select>
            </div>
            <label className="h-10 flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isHoliday}
                onChange={(e) => setIsHoliday(e.target.checked)}
                className="rounded accent-emerald-700"
              />
              Holiday
            </label>
          </div>

          <div className="text-xs text-slate-500">
            Forecast baseline:{' '}
            <strong className="text-slate-700">{predictionLoading ? 'Updating...' : predictionModel || 'Unavailable'}</strong>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse pro-table">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] text-slate-400 uppercase">
                  <th className="py-2.5 pr-3">Dish</th>
                  <th className="py-2.5 px-2">Model Est.</th>
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
                      <td className="py-3 px-2 font-semibold text-slate-700 stat-value">{row.predicted_servings ?? '-'}</td>
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
                        <span className={`px-2 py-1 rounded-lg ${leftover >= 10 ? 'bg-amber-50 text-amber-800' : 'text-slate-500'}`}>
                          {leftover} serv
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <select
                          value={row.storage_type}
                          onChange={(e) => updateRow(idx, 'storage_type', e.target.value)}
                          className="h-9 min-w-[104px] whitespace-nowrap rounded-lg border border-slate-200 px-2.5 bg-white"
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

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
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
      )}

      {/* Tab 2: CSV Import & Retrain */}
      {subTab === 'csv' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card-surface p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Upload className="w-4 h-4 text-sky-700" />
                Upload Kitchen CSV &amp; Retrain
              </h3>
              <button
                type="button"
                onClick={downloadSampleCsv}
                className="text-xs font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                Sample CSV
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Import actual hostel/canteen consumption logs to evaluate and retrain both Random Forest and XGBoost models.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="btn-secondary cursor-pointer">
                Choose CSV File
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
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {modelRuns.slice(0, 6).map((run) => (
                  <div
                    key={run.version}
                    className="text-xs p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-slate-900">v{run.version}</span>{' '}
                      <span className="text-slate-500">({run.reason}) &bull; {run.training_samples} rows</span>
                    </div>
                    <span className="font-semibold text-emerald-700 stat-value">
                      MAE {run.metrics?.ensemble?.mae} &bull; WAPE {run.metrics?.ensemble?.wape_pct ?? '-'}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card-surface p-6 space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-emerald-700" />
                <h3 className="text-base font-bold text-slate-900">Top Demand Feature Drivers</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Model feature weights paired with real scenario demand shifts from your kitchen logs
              </p>
            </div>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={featureImp} layout="vertical" margin={{ top: 4, right: 44, left: 28, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" unit="%" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis type="category" dataKey="feature" width={145} tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip
                    formatter={(v, _name, item) => [
                      item?.payload?.meaning ? `${v}% — ${item.payload.meaning}` : `${v}%`,
                      'Driver Weight',
                    ]}
                  />
                  <Bar dataKey="importance_pct" name="Importance" fill="#059669" radius={[0, 6, 6, 0]}>
                    <LabelList
                      dataKey="importance_pct"
                      position="right"
                      formatter={(v) => `${v}%`}
                      style={{ fontSize: 11, fill: '#334155', fontWeight: 600 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {scenarioImpacts.length > 0 && (
              <div className="pt-3 border-t border-slate-100 space-y-2.5">
                <p className="field-label">Observed Scenario Impact (vs. Regular Weekday)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {scenarioImpacts.map((sc) => {
                    const badgeClass =
                      sc.tone === 'positive'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : sc.tone === 'info'
                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200';
                    return (
                      <div key={sc.scenario} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-800">{sc.scenario}</span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border stat-value ${badgeClass}`}>
                            {sc.delta_label}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">{sc.detail}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Rolling Forecast Validation & Weekly Error Review */}
      {subTab === 'diagnostics' && (
        <div className="space-y-6">
          <div className="card-surface p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">Expanding-Window Model Validation</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Evaluated across {validation.fold_count ?? 0} future-date folds against dish + weekday baseline
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Selected: {selectedModel}
                </span>
                <button type="button" onClick={exportEvaluationCsv} className="btn-secondary h-8 px-3 text-xs">
                  <Download className="w-3.5 h-3.5" />
                  Export Evaluation CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left pro-table">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase">
                    <th className="py-2.5 font-semibold">Model</th>
                    <th className="py-2.5 font-semibold">MAE</th>
                    <th className="py-2.5 font-semibold">WAPE</th>
                    <th className="py-2.5 font-semibold">MAPE</th>
                    <th className="py-2.5 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 stat-value">
                  {[
                    { key: 'ensemble', name: 'Adaptive Ensemble', m: ens },
                    { key: 'xgboost', name: 'XGBoost Regressor', m: xgb },
                    { key: 'random_forest', name: 'Random Forest', m: rf },
                    { key: 'baseline', name: 'Dish + Weekday Baseline', m: baseline },
                  ].map((row) => {
                    const isSelected = selectedModel === row.key;
                    return (
                      <tr key={row.key}>
                        <td className="py-3 font-semibold text-slate-800">{row.name}</td>
                        <td className="py-3 text-slate-600">{row.m.mae ?? '-'} serv</td>
                        <td className="py-3 text-slate-600">{row.m.wape_pct ?? '-'}%</td>
                        <td className="py-3 text-slate-600">{row.m.mape_pct ?? '-'}%</td>
                        <td className="py-3 text-right">
                          <span
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                              isSelected
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            {isSelected ? 'Active' : `${validation.fold_wins?.[row.key] ?? 0}/${validation.fold_count ?? 0} folds`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card-surface p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Weekly Forecast Error Review</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Prediction-linked meal records across the latest {errorReview?.weeks_included?.length || 0}{' '}
                  {(errorReview?.weeks_included?.length || 0) === 1 ? 'week' : 'weeks'}
                </p>
              </div>
              <div className="flex flex-wrap gap-5 text-xs">
                <span className="text-slate-500">
                  Tracked <strong className="ml-1 text-slate-900 stat-value">{errorReview?.tracked_records ?? 0}</strong>
                </span>
                <span className="text-slate-500">
                  Latest MAE <strong className="ml-1 text-slate-900 stat-value">{latestErrorWeek?.mae ?? '-'} serv</strong>
                </span>
                <span className="text-slate-500">
                  WAPE <strong className="ml-1 text-slate-900 stat-value">{latestErrorWeek?.wape_pct ?? '-'}%</strong>
                </span>
              </div>
            </div>

            {errorReview?.tracked_records ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {[
                  ['Meal slot', errorReview.by_meal_slot || []],
                  ['Dish', errorReview.by_dish || []],
                ].map(([title, list]) => (
                  <div key={title} className="min-w-0">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Errors by {title.toLowerCase()}
                    </h4>
                    <div className="max-h-64 overflow-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-xs text-left pro-table">
                        <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase text-slate-500">
                          <tr>
                            <th className="px-3 py-2 font-semibold">{title}</th>
                            <th className="px-3 py-2 font-semibold">Records</th>
                            <th className="px-3 py-2 font-semibold">MAE</th>
                            <th className="px-3 py-2 font-semibold text-right">WAPE</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 stat-value">
                          {list.map((row) => (
                            <tr key={row.group}>
                              <td className="px-3 py-2 font-medium text-slate-800">{row.group}</td>
                              <td className="px-3 py-2 text-slate-600">{row.samples}</td>
                              <td className="px-3 py-2 text-slate-600">{row.mae} serv</td>
                              <td className="px-3 py-2 text-right font-semibold text-slate-700">{row.wape_pct}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="border-t border-slate-100 pt-4 text-xs text-slate-500">
                No prediction-linked meal records logged yet—submit records in the Log Post-Meal Actuals tab to populate this review.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

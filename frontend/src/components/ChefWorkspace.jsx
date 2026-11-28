import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  Check,
  CheckCircle2,
  ChefHat,
  ClipboardCheck,
  Clock,
  Flame,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Users,
  Utensils,
} from 'lucide-react';
import { api } from '../api';

const MEAL_SLOTS = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];
const DEFAULT_ATTENDANCE = { Breakfast: 610, Lunch: 740, Snacks: 520, Dinner: 690 };
const TICKET_STATES = ['Queued', 'Cooking', 'Ready'];

const KDS_STORAGE_KEY = 'nourish_chef_kds_v1';

function readStoredKds() {
  try {
    return JSON.parse(sessionStorage.getItem(KDS_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export default function ChefWorkspace({ initialTab = 'prep', currentUser, alerts = [], onRefreshAlerts, onDataUpdated }) {
  const [subTab, setSubTab] = useState(initialTab);
  const [mealSlot, setMealSlot] = useState('Lunch');
  const [expectedAttendance, setExpectedAttendance] = useState(DEFAULT_ATTENDANCE.Lunch);
  const [weather, setWeather] = useState('Cloudy');

  const [optItems, setOptItems] = useState([]);
  const [summary, setSummary] = useState({});
  const [menuById, setMenuById] = useState({});
  const menuByIdRef = useRef({});
  const [ingredientsById, setIngredientsById] = useState({});
  const [perishables, setPerishables] = useState([]);

  const initialKds = useMemo(() => readStoredKds(), []);
  const [firedReserves, setFiredReserves] = useState(() => initialKds.firedReserves || {});
  const [ticketStates, setTicketStates] = useState(() => initialKds.ticketStates || {});
  const [checkedIngs, setCheckedIngs] = useState(() => initialKds.checkedIngs || {});

  const [handoverRows, setHandoverRows] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [handoverResult, setHandoverResult] = useState(null);

  const [alertDraftId, setAlertDraftId] = useState(null);
  const [alertForm, setAlertForm] = useState({ remaining_servings: 15, alert_level: 'Running Low', note: '' });
  const [alertBusyId, setAlertBusyId] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const abortRef = useRef(null);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    setSubTab(initialTab || 'prep');
  }, [initialTab]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        KDS_STORAGE_KEY,
        JSON.stringify({ firedReserves, ticketStates, checkedIngs })
      );
    } catch {
      // ignore storage quota errors
    }
  }, [firedReserves, ticketStates, checkedIngs]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api.getMenu('', { signal: controller.signal }),
      api.getIngredients({ signal: controller.signal }),
    ])
      .then(([mRes, iRes]) => {
        if (controller.signal.aborted) return;
        const mMap = Object.fromEntries((mRes.items || []).map((m) => [m.menu_item_id, m]));
        const ings = iRes.items || [];
        const iMap = Object.fromEntries(ings.map((i) => [i.ingredient_id, i]));
        menuByIdRef.current = mMap;
        setMenuById(mMap);
        setIngredientsById(iMap);
        setPerishables(
          ings
            .filter((i) => i.perishability_days <= 4 && i.stock_qty > 0)
            .sort((a, b) => a.perishability_days - b.perishability_days)
        );
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message);
      });
    return () => controller.abort();
  }, []);

  const loadSchedule = async (slot = mealSlot, attendance = expectedAttendance, w = weather) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError('');
    try {
      const res = await api.optimizeBatch(
        {
          date: '2026-11-28',
          meal_slot: slot,
          expected_attendance: Number(attendance),
          weather: w,
          model_choice: 'optimal',
          batch_cooking_enabled: true,
        },
        false,
        { signal: controller.signal }
      );
      if (controller.signal.aborted) return;
      const items = res.optimization?.items || [];
      setOptItems(items);
      setSummary(res.optimization?.summary || {});
      setHandoverRows(
        items.map((it) => {
          const meta = menuByIdRef.current[it.menu_item_id] || {};
          const kdsKey = `${slot}:${it.menu_item_id}`;
          const fired = firedReserves[kdsKey] || 0;
          const totalPrep = it.initial_servings + fired * it.batch_size;
          return {
            menu_item_id: it.menu_item_id,
            name: it.name,
            prepared_servings: totalPrep,
            served_servings: Math.max(0, totalPrep - 18),
            holding_temp_c: meta.requires_cold_chain ? 4.0 : 65.0,
            hours_since_cooked: 0.8,
            storage_type: meta.requires_cold_chain ? 'chilled' : 'hot_hold',
            is_sealed: true,
            register_surplus: true,
          };
        })
      );
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasLoadedOnceRef.current) {
      hasLoadedOnceRef.current = true;
      loadSchedule(mealSlot, expectedAttendance, weather);
      return () => abortRef.current?.abort();
    }
    const timer = setTimeout(() => {
      loadSchedule(mealSlot, expectedAttendance, weather);
    }, 220);
    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [mealSlot, expectedAttendance, weather]);

  useEffect(() => {
    if (!optItems.length || !Object.keys(menuById).length) return;
    setHandoverRows((prev) =>
      prev.map((row) => {
        const meta = menuById[row.menu_item_id];
        if (!meta) return row;
        return {
          ...row,
          storage_type: meta.requires_cold_chain ? 'chilled' : row.storage_type,
          holding_temp_c: meta.requires_cold_chain ? 4.0 : row.holding_temp_c,
        };
      })
    );
  }, [menuById, optItems.length]);

  const handleSlotSelect = (slot) => {
    setMealSlot(slot);
    setExpectedAttendance(DEFAULT_ATTENDANCE[slot] || 700);
    setHandoverResult(null);
    setAlertDraftId(null);
  };

  const openAlertComposer = (item) => {
    if (alertDraftId === item.menu_item_id) {
      setAlertDraftId(null);
      return;
    }
    setAlertDraftId(item.menu_item_id);
    setAlertForm({
      remaining_servings: 15,
      alert_level: 'Running Low',
      note: '',
    });
  };

  const handleSendShortageAlert = async (item) => {
    setAlertBusyId(item.menu_item_id);
    setError('');
    try {
      await api.createKitchenAlert({
        menu_item_id: item.menu_item_id,
        menu_item_name: item.name,
        meal_slot: mealSlot,
        remaining_servings: Number(alertForm.remaining_servings),
        batch_size: item.batch_size,
        alert_level: Number(alertForm.remaining_servings) === 0 ? 'Out of Stock' : alertForm.alert_level,
        note: alertForm.note,
      });
      setAlertDraftId(null);
      await onRefreshAlerts?.();
      onDataUpdated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setAlertBusyId('');
    }
  };

  const handleResolveAlert = async (alertId) => {
    setAlertBusyId(alertId);
    setError('');
    try {
      await api.resolveKitchenAlert(alertId);
      await onRefreshAlerts?.();
      onDataUpdated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setAlertBusyId('');
    }
  };

  const fireReserve = (item) => {
    const kdsKey = `${mealSlot}:${item.menu_item_id}`;
    const fired = firedReserves[kdsKey] || 0;
    if (fired >= item.reserve_batches) return;
    const nextFired = fired + 1;
    setFiredReserves((prev) => ({ ...prev, [kdsKey]: nextFired }));
    setHandoverRows((prev) =>
      prev.map((r) =>
        r.menu_item_id === item.menu_item_id
          ? { ...r, prepared_servings: item.initial_servings + nextFired * item.batch_size }
          : r
      )
    );
  };

  const cycleTicketStatus = (menuItemId) => {
    const kdsKey = `${mealSlot}:${menuItemId}`;
    setTicketStates((prev) => {
      const current = prev[kdsKey] || 'Queued';
      const next = TICKET_STATES[(TICKET_STATES.indexOf(current) + 1) % TICKET_STATES.length];
      return { ...prev, [kdsKey]: next };
    });
  };

  const totalExtraFired = useMemo(
    () => optItems.reduce((acc, it) => acc + (firedReserves[`${mealSlot}:${it.menu_item_id}`] || 0) * it.batch_size, 0),
    [optItems, firedReserves, mealSlot]
  );

  const handleHandoverSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setHandoverResult(null);
    try {
      const res = await api.submitPostMealLog({
        date: '2026-11-28',
        meal_slot: mealSlot,
        expected_attendance: Number(expectedAttendance),
        actual_attendance: Number(expectedAttendance),
        weather,
        auto_retrain: false,
        items: handoverRows.map((r) => ({
          menu_item_id: r.menu_item_id,
          prepared_servings: Number(r.prepared_servings),
          served_servings: Number(r.served_servings),
          holding_temp_c: Number(r.holding_temp_c),
          hours_since_cooked: Number(r.hours_since_cooked),
          storage_type: r.storage_type,
          is_sealed: r.is_sealed,
          register_surplus: r.register_surplus,
        })),
      });
      setHandoverResult(res);
      onDataUpdated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Chef Execution Display Header */}
      <section className="module-banner space-y-4">
        <div className="absolute inset-0 hero-grid-overlay pointer-events-none opacity-45" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
              <ChefHat className="w-3.5 h-3.5" />
              Chef Kitchen Display &bull; {currentUser?.organization || 'Central Kitchen'}
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
              {mealSlot} Line Execution Board
            </h2>
            <p className="text-xs text-slate-300">
              Active Stage-1:{' '}
              <strong className="text-white stat-value">
                {((summary.total_initial_servings ?? 0) + totalExtraFired).toLocaleString()} serv
              </strong>{' '}
              &bull; Standby Reserve:{' '}
              <strong className="text-teal-300 stat-value">
                {Math.max(0, (summary.total_reserve_servings ?? 0) - totalExtraFired).toLocaleString()} serv
              </strong>{' '}
              &bull; {optItems.length} Dishes
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex p-1 rounded-xl bg-white/10 border border-white/15">
              {[
                { id: 'prep', label: 'Prep Display (KDS)' },
                { id: 'handover', label: 'End-of-Service Handover' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSubTab(t.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    subTab === t.id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-200 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Slot & Diner Controls */}
        <div className="relative flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
          <div className="flex flex-wrap items-center gap-1.5">
            {MEAL_SLOTS.map((slot) => (
              <button
                key={slot}
                onClick={() => handleSlotSelect(slot)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                  mealSlot === slot
                    ? 'bg-teal-500 text-white shadow-sm'
                    : 'bg-white/10 text-slate-200 hover:bg-white/15'
                }`}
              >
                {slot}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="inline-flex items-center gap-2 text-slate-300">
              <span>Diners Expected:</span>
              <input
                type="number"
                min="50"
                max="3000"
                step="10"
                value={expectedAttendance}
                onChange={(e) => setExpectedAttendance(Number(e.target.value))}
                className="w-20 h-8 rounded-lg bg-white/15 border border-white/20 px-2.5 text-white font-bold stat-value focus:outline-none"
              />
            </label>
            <select
              value={weather}
              onChange={(e) => setWeather(e.target.value)}
              className="h-8 rounded-lg bg-white/15 border border-white/20 px-2.5 text-white text-xs font-semibold focus:outline-none"
            >
              {['Sunny', 'Cloudy', 'Rainy', 'Humid'].map((w) => (
                <option key={w} value={w} className="text-slate-900">
                  {w}
                </option>
              ))}
            </select>
            <button
              onClick={() => loadSchedule()}
              disabled={loading}
              className="h-8 px-3 rounded-lg bg-white text-slate-950 hover:bg-teal-50 font-semibold inline-flex items-center gap-1.5 transition disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-teal-700 ${loading ? 'animate-spin' : ''}`} />
              Sync Plan
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800">
          {error}
        </div>
      )}

      {/* Priority FIFO Perishable Strip */}
      {perishables.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-amber-950">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>FIFO Priority (Use First):</strong>{' '}
              {perishables
                .slice(0, 4)
                .map((p) => `${p.name} (${p.stock_qty} ${p.unit}, ${p.perishability_days}d left)`)
                .join(' • ')}
            </span>
          </div>
        </div>
      )}

      {/* TAB 1: Chef Prep Display (KDS) */}
      {subTab === 'prep' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {optItems.map((item) => {
            const kdsKey = `${mealSlot}:${item.menu_item_id}`;
            const firedCount = firedReserves[kdsKey] || 0;
            const cookedServings = item.initial_servings + firedCount * item.batch_size;
            const remainingReserve = Math.max(0, item.reserve_batches - firedCount);
            const ticketStatus = ticketStates[kdsKey] || 'Queued';
            const recipe = menuById[item.menu_item_id]?.recipe || {};
            const recipeLines = Object.entries(recipe);
            const activeBatches = item.initial_batches + firedCount;

            const statusColors =
              ticketStatus === 'Ready'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : ticketStatus === 'Cooking'
                ? 'bg-sky-50 text-sky-700 border-sky-200'
                : 'bg-amber-50 text-amber-800 border-amber-200';

            return (
              <div key={item.menu_item_id} className="card-interactive p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base leading-snug">{item.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.category} &bull; {item.batch_size} serv / batch
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => cycleTicketStatus(item.menu_item_id)}
                      title="Tap to update kitchen station status"
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition ${statusColors}`}
                    >
                      {ticketStatus}
                    </button>
                  </div>

                  {/* Stage 1 & Reserve Highlight Boxes */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-xl bg-emerald-50/75 border border-emerald-200/80">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Cook Now</p>
                      <p className="text-xl font-extrabold text-emerald-950 stat-value mt-0.5">
                        {activeBatches} {activeBatches === 1 ? 'batch' : 'batches'}
                      </p>
                      <p className="text-[11px] font-semibold text-emerald-700 stat-value">{cookedServings} servings</p>
                    </div>
                    <div className="p-3 rounded-xl bg-sky-50/75 border border-sky-200/80">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700">Standby Hold</p>
                      <p className="text-xl font-extrabold text-sky-950 stat-value mt-0.5">
                        {remainingReserve} {remainingReserve === 1 ? 'batch' : 'batches'}
                      </p>
                      <p className="text-[11px] font-semibold text-sky-700 stat-value">
                        {remainingReserve * item.batch_size} serv reserve
                      </p>
                    </div>
                  </div>

                  {/* Ingredient Prep Breakdown */}
                  {recipeLines.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <Utensils className="w-3 h-3" />
                        Exact Ingredient Scaling ({cookedServings} serv)
                      </p>
                      <div className="space-y-1">
                        {recipeLines.map(([ingId, qtyPerServ]) => {
                          const ingMeta = ingredientsById[ingId];
                          const checkKey = `${mealSlot}:${item.menu_item_id}:${ingId}`;
                          const done = Boolean(checkedIngs[checkKey]);
                          const scaledQty = (Number(qtyPerServ) * cookedServings).toFixed(1);
                          return (
                            <label
                              key={ingId}
                              className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg cursor-pointer transition ${
                                done ? 'bg-slate-100 text-slate-400 line-through' : 'bg-slate-50 text-slate-700 hover:bg-slate-100/80'
                              }`}
                            >
                              <span className="inline-flex items-center gap-2 font-medium">
                                <input
                                  type="checkbox"
                                  checked={done}
                                  onChange={() =>
                                    setCheckedIngs((prev) => ({ ...prev, [checkKey]: !prev[checkKey] }))
                                  }
                                  className="rounded accent-teal-600"
                                />
                                {ingMeta?.name || ingId}
                              </span>
                              <span className="font-bold stat-value">
                                {scaledQty} {ingMeta?.unit || 'kg'}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {item.reserve_batches > 0 && (
                  <button
                    type="button"
                    disabled={remainingReserve <= 0}
                    onClick={() => fireReserve(item)}
                    className="w-full h-9 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-900 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition disabled:opacity-45"
                  >
                    <Flame className="w-3.5 h-3.5 text-sky-700" />
                    {remainingReserve > 0
                      ? `Fire Standby Batch (+${item.batch_size} serv)`
                      : 'All Standby Batches Fired'}
                  </button>
                )}

                {/* Chef -> Kitchen Manager Running Low / Stock Ending Alert */}
                {(() => {
                  const activeAlert = alerts.find(
                    (a) =>
                      a.menu_item_id === item.menu_item_id &&
                      a.meal_slot === mealSlot &&
                      a.status !== 'Resolved'
                  );
                  if (activeAlert?.status === 'Responded') {
                    return (
                      <div className="p-3 rounded-xl bg-teal-50 border border-teal-300 text-xs space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold text-teal-950 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                            <span>
                              Manager Update: {activeAlert.remaining_customers} customers left
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-teal-700 text-white text-[10px] font-bold">
                            Action
                          </span>
                        </div>
                        <p className="text-teal-900 font-semibold">
                          {activeAlert.decision}
                          {activeAlert.batches_requested > 0
                            ? ` (+${activeAlert.batches_requested} batch / ${
                                activeAlert.batches_requested * item.batch_size
                              } serv)`
                            : ''}
                        </p>
                        {activeAlert.manager_note && (
                          <p className="text-[11px] text-teal-800 italic">&ldquo;{activeAlert.manager_note}&rdquo;</p>
                        )}
                        <button
                          type="button"
                          disabled={alertBusyId === activeAlert.alert_id}
                          onClick={() => handleResolveAlert(activeAlert.alert_id)}
                          className="w-full h-8 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-[11px] font-bold transition"
                        >
                          Acknowledge &amp; Clear Alert
                        </button>
                      </div>
                    );
                  }

                  if (activeAlert?.status === 'Pending Manager') {
                    return (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-[11px] font-semibold text-amber-900 flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5">
                          <BellRing className="w-3.5 h-3.5 text-amber-600 animate-pulse shrink-0" />
                          Alert Sent ({activeAlert.remaining_servings} serv left) — Waiting for Manager
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => openAlertComposer(item)}
                        className={`w-full h-8 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition ${
                          remainingReserve === 0
                            ? 'border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900'
                            : 'border-slate-200 bg-white hover:bg-amber-50/70 text-slate-600 hover:text-amber-900'
                        }`}
                      >
                        <BellRing className="w-3.5 h-3.5 text-amber-600" />
                        Alert Manager: Stock Running Low
                      </button>

                      {alertDraftId === item.menu_item_id && (
                        <div className="p-3 rounded-xl bg-amber-50/75 border border-amber-200 space-y-2 text-xs">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-amber-900 mb-1">
                                Servings Left
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="1000"
                                value={alertForm.remaining_servings}
                                onChange={(e) =>
                                  setAlertForm((p) => ({ ...p, remaining_servings: Number(e.target.value) }))
                                }
                                className="field-control h-8 text-xs font-bold stat-value"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-amber-900 mb-1">
                                Status
                              </label>
                              <select
                                value={alertForm.alert_level}
                                onChange={(e) => setAlertForm((p) => ({ ...p, alert_level: e.target.value }))}
                                className="field-control h-8 text-xs"
                              >
                                <option value="Running Low">Running Low</option>
                                <option value="Out of Stock">Out of Stock</option>
                              </select>
                            </div>
                          </div>
                          <input
                            type="text"
                            placeholder="Note for Manager (e.g., High line demand)"
                            value={alertForm.note}
                            onChange={(e) => setAlertForm((p) => ({ ...p, note: e.target.value }))}
                            className="field-control h-8 text-xs"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setAlertDraftId(null)}
                              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 font-semibold"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={alertBusyId === item.menu_item_id}
                              onClick={() => handleSendShortageAlert(item)}
                              className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold inline-flex items-center gap-1"
                            >
                              <Send className="w-3 h-3" />
                              {alertBusyId === item.menu_item_id ? 'Sending...' : 'Notify Manager'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: Chef End-of-Service Leftover & FSSAI Handover */}
      {subTab === 'handover' && (
        <form onSubmit={handleHandoverSubmit} className="card-surface p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-teal-600" />
                End-of-Service Leftover &amp; Safety Handover ({mealSlot})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Any unserved tray ≥ 10 servings passes temperature &amp; seal checks and routes directly to NGO Coordinators
              </p>
            </div>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Submitting...' : 'Submit Kitchen Handover'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left pro-table">
              <thead>
                <tr>
                  <th className="pr-3">Dish</th>
                  <th className="px-2">Cooked</th>
                  <th className="px-2">Served</th>
                  <th className="px-2">Leftover</th>
                  <th className="px-2">Storage</th>
                  <th className="px-2">Temp (°C)</th>
                  <th className="px-2">Age (h)</th>
                  <th className="pl-2 text-center">Sealed</th>
                </tr>
              </thead>
              <tbody>
                {handoverRows.map((row, idx) => {
                  const leftover = Math.max(0, row.prepared_servings - row.served_servings);
                  return (
                    <tr key={row.menu_item_id}>
                      <td className="py-3 pr-3 font-semibold text-slate-800">{row.name}</td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          min="0"
                          value={row.prepared_servings}
                          onChange={(e) =>
                            setHandoverRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, prepared_servings: Number(e.target.value) } : r))
                            )
                          }
                          className="w-20 h-9 rounded-lg border border-slate-200 px-2 stat-value"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          min="0"
                          value={row.served_servings}
                          onChange={(e) =>
                            setHandoverRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, served_servings: Number(e.target.value) } : r))
                            )
                          }
                          className="w-20 h-9 rounded-lg border border-slate-200 px-2 stat-value"
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
                          onChange={(e) =>
                            setHandoverRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, storage_type: e.target.value } : r))
                            )
                          }
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
                          onChange={(e) =>
                            setHandoverRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, holding_temp_c: Number(e.target.value) } : r))
                            )
                          }
                          className="w-16 h-9 rounded-lg border border-slate-200 px-2 stat-value"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          step="0.2"
                          min="0"
                          value={row.hours_since_cooked}
                          onChange={(e) =>
                            setHandoverRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, hours_since_cooked: Number(e.target.value) } : r))
                            )
                          }
                          className="w-16 h-9 rounded-lg border border-slate-200 px-2 stat-value"
                        />
                      </td>
                      <td className="py-3 pl-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.is_sealed}
                          onChange={(e) =>
                            setHandoverRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, is_sealed: e.target.checked } : r))
                            )
                          }
                          className="rounded accent-teal-600"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {handoverResult && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2.5">
              <p className="text-xs font-bold text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Logged {handoverResult.logged_count} dish records cleanly
              </p>
              {handoverResult.detected_surplus?.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {handoverResult.detected_surplus.map((s) => (
                    <div
                      key={s.surplus_id}
                      className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                        s.safety_passed ? 'bg-white border-emerald-300' : 'bg-red-50 border-red-200'
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
                        <p className="text-[11px] text-slate-500 mt-0.5">{s.safety_status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </form>
      )}
    </div>
  );
}

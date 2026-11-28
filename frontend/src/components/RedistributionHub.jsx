import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  Plus,
  Send,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
} from 'lucide-react';
import { api } from '../api';
import { ProximityRadar, SafetyHandoverSlipModal } from './SurplusVisuals';

const AREA_COORDS = {
  Bantakal: { lat: 13.2612, lon: 74.7924 },
  Udupi: { lat: 13.3409, lon: 74.7421 },
  Manipal: { lat: 13.3525, lon: 74.7868 },
  Kaup: { lat: 13.2230, lon: 74.7458 },
  Shirva: { lat: 13.2371, lon: 74.8194 },
  Padubidri: { lat: 13.1394, lon: 74.7734 },
};

const STORAGE_LABELS = { hot_hold: 'Hot Hold', chilled: 'Chilled', ambient: 'Ambient' };
const SAFETY_LABELS = {
  SAFE_FOR_REDISTRIBUTION: 'Safe for Redistribution',
  SAFETY_REJECTED: 'Safety Check Failed (Do Not Distribute)',
};

export default function RedistributionHub({ kitchenInfo, onDataUpdated }) {
  const [subTab, setSubTab] = useState('matching');
  const [surplusList, setSurplusList] = useState([]);
  const [ngos, setNgos] = useState([]);
  const [redistributions, setRedistributions] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedSurplusId, setSelectedSurplusId] = useState(null);
  const [showAddSurplus, setShowAddSurplus] = useState(false);
  const [showAddNgo, setShowAddNgo] = useState(false);
  const [activeSlip, setActiveSlip] = useState(null);
  const [transportMode, setTransportMode] = useState('NGO Pickup Van');
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [newSurplus, setNewSurplus] = useState({
    menu_item_id: 'item_veg_pulao',
    meal_slot: 'Dinner',
    servings_available: 90,
    holding_temp_c: 65.0,
    hours_since_cooked: 0.7,
    storage_type: 'hot_hold',
    is_sealed: true,
    notes: 'Unopened reserve catering tray',
  });

  const [newNgo, setNewNgo] = useState({
    name: '',
    org_type: 'NGO',
    area: 'Udupi',
    lat: 13.3409,
    lon: 74.7421,
    min_servings: 20,
    max_capacity_servings: 200,
    has_cold_chain: true,
    dietary_preference: 'Any',
    contact_person: '',
    phone: '',
  });

  const loadAbortRef = useRef(null);

  const loadAll = async () => {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    setLoading(true);
    setError('');
    try {
      const [sRes, nRes, rRes, mRes] = await Promise.all([
        api.getSurplus({ signal: controller.signal }),
        api.getNgos({ signal: controller.signal }),
        api.getRedistributions({ signal: controller.signal }),
        api.getMenu('', { signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return false;
      const items = sRes.surplus_items || [];
      setSurplusList(items);
      setNgos(nRes.ngos || []);
      setRedistributions(rRes.redistributions || []);
      setMenuItems(mRes.items || []);

      if (!selectedSurplusId || !items.some((i) => i.surplus_id === selectedSurplusId)) {
        const firstEligible = items.find((i) => i.status === 'Eligible') || items[0];
        setSelectedSurplusId(firstEligible?.surplus_id || null);
      }
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false;
      setError(
        `Unable to load surplus and NGO data: ${
          err instanceof Error ? err.message : 'The server returned an unexpected response.'
        }`
      );
      return false;
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    return () => loadAbortRef.current?.abort();
  }, []);

  const selectedSurplus = useMemo(
    () => surplusList.find((s) => s.surplus_id === selectedSurplusId) || null,
    [surplusList, selectedSurplusId]
  );
  const topRecommendedNgoId =
    selectedSurplus?.or_tools_recommended_ngo?.ngo_id || selectedSurplus?.top_matches?.[0]?.ngo_id;

  const handleDispatch = async (surplusId, ngoId) => {
    setError('');
    setStatusMsg('');
    try {
      const res = await api.dispatchRedistribution({
        surplus_id: surplusId,
        ngo_id: ngoId,
        transport_mode: transportMode,
      });
      setStatusMsg(
        `Dispatched ${res.redistribution.servings_delivered} servings (${res.redistribution.weight_kg} kg) to ${res.redistribution.ngo_name}.`
      );
      setActiveSlip(res.redistribution);
      await loadAll();
      onDataUpdated?.();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStatusUpdate = async (redistId, nextStatus) => {
    setError('');
    try {
      await api.updateRedistributionStatus(redistId, nextStatus);
      await loadAll();
      onDataUpdated?.();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateSurplus = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.createSurplus(newSurplus);
      setShowAddSurplus(false);
      setSelectedSurplusId(res.surplus.surplus_id);
      setSubTab('matching');
      await loadAll();
      onDataUpdated?.();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateNgo = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.createNgo(newNgo);
      setShowAddNgo(false);
      setStatusMsg(`Registered NGO partner "${res.ngo.name}" (${res.ngo.distance_km} km from kitchen).`);
      setNewNgo({ ...newNgo, name: '', contact_person: '', phone: '' });
      await loadAll();
      onDataUpdated?.();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleNgo = async (ngo) => {
    setError('');
    try {
      await api.toggleNgoAvailability(ngo.ngo_id, !ngo.is_available);
      await loadAll();
      onDataUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update NGO availability.');
    }
  };

  return (
    <div className="space-y-6">
      <SafetyHandoverSlipModal slip={activeSlip} onClose={() => setActiveSlip(null)} />

      {/* Flagship Surplus & NGO Banner */}
      <section className="module-banner space-y-4">
        <div className="absolute inset-0 hero-grid-overlay pointer-events-none opacity-45" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-teal-300">
              FSSAI Safety Gate &bull; OR-Tools Geo-Matching
            </p>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight">
              Surplus Rescue &amp; NGO Dispatch Network
            </h2>
            <p className="text-xs text-slate-300">
              Eligible Surplus:{' '}
              <strong className="text-white stat-value">
                {surplusList
                  .filter((s) => s.status === 'Eligible')
                  .reduce((sum, s) => sum + (s.servings_available || 0), 0)}{' '}
                servings
              </strong>{' '}
              &bull; {ngos.filter((n) => n.is_available).length} active NGOs &bull; {redistributions.length} dispatches
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {subTab === 'ngos' && (
              <button
                onClick={() => setShowAddNgo(!showAddNgo)}
                className="h-10 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold inline-flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                Add NGO Partner
              </button>
            )}
            <button
              onClick={() => setShowAddSurplus(!showAddSurplus)}
              className="h-10 px-4 rounded-xl bg-white text-slate-950 hover:bg-teal-50 text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-sm transition"
            >
              <Plus className="w-4 h-4 text-teal-700" />
              Log Surplus Batch
            </button>
          </div>
        </div>

        <div className="relative inline-flex flex-wrap gap-1 rounded-xl p-1 bg-white/10 border border-white/15">
          {[
            { id: 'matching', label: `Matching Queue (${surplusList.length})` },
            { id: 'tracker', label: `Dispatch Tracker (${redistributions.length})` },
            { id: 'ngos', label: `NGO Network (${ngos.length})` },
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
      </section>

      {/* Add NGO Partner Form */}
      {showAddNgo && (
        <form onSubmit={handleCreateNgo} className="card-surface p-5 space-y-4 border-emerald-300">
          <p className="text-sm font-bold text-slate-900">Register New NGO / Food Bank Partner</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="col-span-2">
              <label className="field-label">Organization Name</label>
              <input
                required
                type="text"
                placeholder="e.g., Kundapura Seva Food Bank"
                value={newNgo.name}
                onChange={(e) => setNewNgo({ ...newNgo, name: e.target.value })}
                className="field-control"
              />
            </div>
            <div>
              <label className="field-label">Type</label>
              <select
                value={newNgo.org_type}
                onChange={(e) => setNewNgo({ ...newNgo, org_type: e.target.value })}
                className="field-control"
              >
                {['NGO', 'Food Bank', 'Charitable Trust', 'Community Shelter'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Area Preset</label>
              <select
                value={newNgo.area}
                onChange={(e) => {
                  const area = e.target.value;
                  const coords = AREA_COORDS[area] || { lat: 13.34, lon: 74.74 };
                  setNewNgo({ ...newNgo, area, lat: coords.lat, lon: coords.lon });
                }}
                className="field-control"
              >
                {Object.keys(AREA_COORDS).map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Max Capacity</label>
              <input
                type="number"
                min="15"
                value={newNgo.max_capacity_servings}
                onChange={(e) => setNewNgo({ ...newNgo, max_capacity_servings: Number(e.target.value) })}
                className="field-control stat-value"
              />
            </div>
            <div>
              <label className="field-label">Dietary</label>
              <select
                value={newNgo.dietary_preference}
                onChange={(e) => setNewNgo({ ...newNgo, dietary_preference: e.target.value })}
                className="field-control"
              >
                <option value="Any">Any</option>
                <option value="Veg Only">Veg Only</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
            <div>
              <label className="field-label">Contact Person</label>
              <input
                required
                type="text"
                placeholder="Name"
                value={newNgo.contact_person}
                onChange={(e) => setNewNgo({ ...newNgo, contact_person: e.target.value })}
                className="field-control"
              />
            </div>
            <div>
              <label className="field-label">Phone</label>
              <input
                required
                type="text"
                placeholder="+91 ..."
                value={newNgo.phone}
                onChange={(e) => setNewNgo({ ...newNgo, phone: e.target.value })}
                className="field-control"
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 pt-5 cursor-pointer">
              <input
                type="checkbox"
                checked={newNgo.has_cold_chain}
                onChange={(e) => setNewNgo({ ...newNgo, has_cold_chain: e.target.checked })}
                className="rounded accent-emerald-700"
              />
              Has Cold-Chain Vehicle
            </label>
            <div className="flex justify-end gap-2 pt-5">
              <button type="button" onClick={() => setShowAddNgo(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Save NGO Partner
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Optional Add Surplus Form */}
      {showAddSurplus && (
        <form onSubmit={handleCreateSurplus} className="card-surface p-5 space-y-4 border-emerald-300">
          <p className="text-sm font-bold text-slate-900">Register Surplus Food Lot (Automatic Safety Evaluation)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="col-span-2">
              <label className="field-label">Dish</label>
              <select
                value={newSurplus.menu_item_id}
                onChange={(e) => setNewSurplus({ ...newSurplus, menu_item_id: e.target.value })}
                className="field-control"
              >
                {menuItems.map((m) => (
                  <option key={m.menu_item_id} value={m.menu_item_id}>
                    {m.name} ({m.meal_slot})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Servings</label>
              <input
                type="number"
                min="10"
                value={newSurplus.servings_available}
                onChange={(e) => setNewSurplus({ ...newSurplus, servings_available: Number(e.target.value) })}
                className="field-control stat-value"
              />
            </div>
            <div>
              <label className="field-label">Storage</label>
              <select
                value={newSurplus.storage_type}
                onChange={(e) => setNewSurplus({ ...newSurplus, storage_type: e.target.value })}
                className="field-control"
              >
                <option value="hot_hold">Hot Hold</option>
                <option value="chilled">Chilled</option>
                <option value="ambient">Ambient</option>
              </select>
            </div>
            <div>
              <label className="field-label">Temp (°C)</label>
              <input
                type="number"
                step="0.5"
                value={newSurplus.holding_temp_c}
                onChange={(e) => setNewSurplus({ ...newSurplus, holding_temp_c: Number(e.target.value) })}
                className="field-control stat-value"
              />
            </div>
            <div>
              <label className="field-label">Age (hours)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={newSurplus.hours_since_cooked}
                onChange={(e) => setNewSurplus({ ...newSurplus, hours_since_cooked: Number(e.target.value) })}
                className="field-control stat-value"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={newSurplus.is_sealed}
                onChange={(e) => setNewSurplus({ ...newSurplus, is_sealed: e.target.checked })}
                className="rounded accent-emerald-700"
              />
              Sealed food-grade container (unserved)
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAddSurplus(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Run Safety Gate &amp; Save
              </button>
            </div>
          </div>
        </form>
      )}

      {statusMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {statusMsg}
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800">{error}</div>
      )}
      {loading && (
        <div role="status" className="card-surface p-6 text-center text-sm text-slate-500">
          Loading surplus, NGO, and dispatch data...
        </div>
      )}

      {/* Sub-Tab 1: Matching Queue */}
      {subTab === 'matching' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-3">
            {loading ? null : surplusList.filter((s) => !(s.servings_available <= 0 && s.status === 'Dispatched')).length === 0 ? (
              <div className="card-surface p-6 text-center text-sm text-slate-500">
                No surplus batches are available yet. Use <strong>Log Surplus Batch</strong> to add one.
              </div>
            ) : (
              surplusList
                .filter((s) => !(s.servings_available <= 0 && s.status === 'Dispatched'))
                .map((s) => {
              const isSelected = s.surplus_id === selectedSurplusId;
              return (
                <div
                  key={s.surplus_id}
                  onClick={() => setSelectedSurplusId(s.surplus_id)}
                  className={`card-interactive p-4 cursor-pointer ${
                    isSelected
                      ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/30'
                      : 'border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{s.menu_item_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {s.meal_slot} &bull; {s.servings_available} servings ({s.weight_kg} kg)
                      </p>
                    </div>
                    {s.safety_passed ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {s.status}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Blocked
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                      {s.holding_temp_c}°C ({STORAGE_LABELS[s.storage_type] || s.storage_type})
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {s.remaining_safe_hours}h left
                    </span>
                    {s.requires_cold_chain && (
                      <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200 font-semibold inline-flex items-center gap-1">
                        <Snowflake className="w-3 h-3" />
                        Cold Chain
                      </span>
                    )}
                  </div>
                </div>
              );
                })
            )}

            {kitchenInfo && ngos.length > 0 && (
              <ProximityRadar kitchen={kitchenInfo} ngos={ngos} highlightedNgoId={topRecommendedNgoId} />
            )}
          </div>

          <div className="lg:col-span-7">
            {selectedSurplus ? (
              <div className="card-surface p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{selectedSurplus.menu_item_name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{selectedSurplus.notes}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-500">Transport:</span>
                    <select
                      value={transportMode}
                      onChange={(e) => setTransportMode(e.target.value)}
                      className="field-control h-9 w-auto text-xs"
                    >
                      <option value="NGO Pickup Van">NGO Pickup Van</option>
                      <option value="Kitchen E-Cargo">Kitchen E-Cargo</option>
                      <option value="Volunteer Cold-Box">Volunteer Cold-Box</option>
                    </select>
                  </div>
                </div>

                {/* Safety Gate Verdict */}
                <div
                  className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                    selectedSurplus.safety_passed
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      : 'bg-red-50 border-red-200 text-red-950'
                  }`}
                >
                  <p className="font-bold flex items-center gap-1.5">
                    {selectedSurplus.safety_passed ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-red-600" />
                    )}
                    {SAFETY_LABELS[selectedSurplus.safety_status] || selectedSurplus.safety_status}
                  </p>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {(selectedSurplus.safety_reasons || []).map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>

                {/* Compatible & Blocked NGOs */}
                <div className="space-y-2.5">
                  {(selectedSurplus.all_matches || []).map((m, idx) => {
                    const isOrPick = selectedSurplus.or_tools_recommended_ngo?.ngo_id === m.ngo_id;
                    return (
                      <div
                        key={m.ngo_id}
                        className={`p-4 rounded-xl border transition ${
                          m.compatible
                            ? isOrPick
                              ? 'bg-emerald-50/60 border-emerald-300'
                              : 'bg-white border-slate-200'
                            : 'bg-slate-50 border-slate-200/80 opacity-65'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-sm text-slate-900">{m.name}</span>
                              {isOrPick && (
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-700 text-white">
                                  OR-Tools Best #{idx + 1}
                                </span>
                              )}
                              {m.has_cold_chain && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                                  Cold Chain
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {m.area} ({m.distance_km} km &bull; {m.eta_minutes}m)
                              </span>
                              <span>&bull; Cap: {m.max_capacity_servings}</span>
                              <span>&bull; {m.dietary_preference}</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm font-extrabold text-emerald-700 stat-value">{m.match_score}%</p>
                              <p className="text-[10px] text-slate-400 uppercase">Score</p>
                            </div>
                            {m.compatible && selectedSurplus.status === 'Eligible' && (
                              <button
                                onClick={() => handleDispatch(selectedSurplus.surplus_id, m.ngo_id)}
                                className="btn-primary h-9 px-3.5 text-xs"
                              >
                                <Send className="w-3.5 h-3.5" />
                                Dispatch {m.allocatable_servings}
                              </button>
                            )}
                          </div>
                        </div>
                        {!m.compatible && m.blockers?.length > 0 && (
                          <p className="mt-2 text-[11px] text-red-700 font-medium">
                            Blocked: {m.blockers.join(' • ')}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="card-surface p-10 text-center text-sm text-slate-500">
                Select a surplus lot on the left to inspect compatibility and dispatch.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Dispatch Tracker */}
      {subTab === 'tracker' && (
        <div className="card-surface p-6 overflow-x-auto">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Redistribution Dispatch &amp; Delivery Log</h3>
          <table className="w-full text-xs text-left pro-table">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] text-slate-400 uppercase">
                <th className="py-2.5">Dish</th>
                <th className="py-2.5">NGO Partner</th>
                <th className="py-2.5">Volume</th>
                <th className="py-2.5">Distance</th>
                <th className="py-2.5">Transport</th>
                <th className="py-2.5">Status</th>
                <th className="py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {redistributions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No redistribution dispatches have been recorded yet.
                  </td>
                </tr>
              ) : redistributions.map((r) => (
                <tr key={r.redistribution_id}>
                  <td className="py-3 font-semibold text-slate-900">{r.menu_item_name}</td>
                  <td className="py-3 text-slate-600">{r.ngo_name}</td>
                  <td className="py-3 stat-value">
                    {r.servings_delivered} serv ({r.weight_kg} kg)
                  </td>
                  <td className="py-3 stat-value">{r.distance_km} km</td>
                  <td className="py-3 text-slate-500">{r.transport_mode}</td>
                  <td className="py-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-semibold ${
                        r.status === 'Delivered'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3 text-right space-x-3">
                    <button
                      onClick={() => setActiveSlip(r)}
                      className="text-slate-600 hover:text-slate-900 font-semibold inline-flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Safety Slip
                    </button>
                    {r.status === 'Dispatched' && (
                      <button
                        onClick={() => handleStatusUpdate(r.redistribution_id, 'Delivered')}
                        className="text-emerald-700 font-semibold hover:underline"
                      >
                        Mark Delivered
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sub-Tab 3: NGO Network */}
      {subTab === 'ngos' && (
        <div className="card-surface p-6 overflow-x-auto">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Registered NGOs, Food Banks &amp; Shelters</h3>
          <table className="w-full text-xs text-left pro-table">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] text-slate-400 uppercase">
                <th className="py-2.5">Organization</th>
                <th className="py-2.5">Area &amp; Distance</th>
                <th className="py-2.5">Capacity</th>
                <th className="py-2.5">Cold Chain</th>
                <th className="py-2.5">Dietary</th>
                <th className="py-2.5">Contact</th>
                <th className="py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ngos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No NGO partners are registered yet. Use <strong>Add NGO Partner</strong> to add one.
                  </td>
                </tr>
              ) : ngos.map((n) => (
                <tr key={n.ngo_id}>
                  <td className="py-3 font-semibold text-slate-900">
                    {n.name}
                    <span className="block text-[11px] font-normal text-slate-400">{n.org_type}</span>
                  </td>
                  <td className="py-3 stat-value">
                    {n.area} ({n.distance_km} km)
                  </td>
                  <td className="py-3 stat-value">
                    {n.min_servings}–{n.max_capacity_servings} serv
                  </td>
                  <td className="py-3">{n.has_cold_chain ? 'Insulated' : 'Ambient'}</td>
                  <td className="py-3">{n.dietary_preference}</td>
                  <td className="py-3 text-slate-600">
                    {n.contact_person} &bull; {n.phone}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => handleToggleNgo(n)}
                      className={`px-3 py-1 rounded-full font-semibold ${
                        n.is_available
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {n.is_available ? 'Available' : 'Paused'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

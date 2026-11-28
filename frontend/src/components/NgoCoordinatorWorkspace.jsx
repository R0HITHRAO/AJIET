import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  FileText,
  HeartHandshake,
  MapPin,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Truck,
} from 'lucide-react';
import { api } from '../api';
import { ProximityRadar, SafetyHandoverSlipModal } from './SurplusVisuals';

const STORAGE_LABELS = { hot_hold: 'Hot Hold', chilled: 'Chilled', ambient: 'Ambient' };
const SAFETY_LABELS = {
  SAFE_FOR_REDISTRIBUTION: 'Safe for Redistribution',
  SAFETY_REJECTED: 'Safety Check Failed (Do Not Distribute)',
};

export default function NgoCoordinatorWorkspace({ initialTab = 'queue', currentUser, kitchenInfo, onDataUpdated }) {
  const [subTab, setSubTab] = useState(initialTab);
  const [surplusList, setSurplusList] = useState([]);
  const [ngos, setNgos] = useState([]);
  const [redistributions, setRedistributions] = useState([]);
  const [selectedSurplusId, setSelectedSurplusId] = useState(null);
  const [selectedNgoId, setSelectedNgoId] = useState('');
  const [transportMode, setTransportMode] = useState('NGO Pickup Van');
  const [activeSlip, setActiveSlip] = useState(null);
  const [showRegisterNgo, setShowRegisterNgo] = useState(false);

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
    contact_person: currentUser?.name || '',
    phone: '',
  });

  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  useEffect(() => {
    setSubTab(initialTab || 'queue');
  }, [initialTab]);

  const loadAll = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError('');
    try {
      const [sRes, nRes, rRes] = await Promise.all([
        api.getSurplus({ signal: controller.signal }),
        api.getNgos({ signal: controller.signal }),
        api.getRedistributions({ signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return;
      const items = sRes.surplus_items || [];
      const ngoRows = nRes.ngos || [];
      setSurplusList(items);
      setNgos(ngoRows);
      setRedistributions(rRes.redistributions || []);

      if (!selectedSurplusId || !items.some((i) => i.surplus_id === selectedSurplusId)) {
        const firstEligible = items.find((i) => i.status === 'Eligible') || items[0];
        setSelectedSurplusId(firstEligible?.surplus_id || null);
      }
      if (!selectedNgoId && ngoRows.length) {
        const orgMatch = ngoRows.find((n) =>
          (currentUser?.organization || '').toLowerCase().includes(n.name.toLowerCase())
        );
        setSelectedNgoId((orgMatch || ngoRows[0]).ngo_id);
      }
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    return () => abortRef.current?.abort();
  }, []);

  const visibleQueue = useMemo(
    () => surplusList.filter((s) => !(s.servings_available <= 0 && s.status === 'Dispatched')),
    [surplusList]
  );
  const selectedSurplus = useMemo(
    () => surplusList.find((s) => s.surplus_id === selectedSurplusId) || null,
    [surplusList, selectedSurplusId]
  );
  const activePickups = useMemo(
    () => redistributions.filter((r) => r.status !== 'Delivered'),
    [redistributions]
  );
  const completedPickups = useMemo(
    () => redistributions.filter((r) => r.status === 'Delivered'),
    [redistributions]
  );

  const eligibleServings = useMemo(
    () =>
      surplusList
        .filter((s) => s.status === 'Eligible' && s.safety_passed)
        .reduce((sum, s) => sum + (s.servings_available || 0), 0),
    [surplusList]
  );
  const totalRescued = useMemo(
    () => redistributions.reduce((sum, r) => sum + (r.servings_delivered || 0), 0),
    [redistributions]
  );

  const topRecommendedNgoId =
    selectedSurplus?.or_tools_recommended_ngo?.ngo_id || selectedSurplus?.top_matches?.[0]?.ngo_id || selectedNgoId;

  const handleClaimDispatch = async (surplusId, ngoId) => {
    setError('');
    setStatusMsg('');
    try {
      const res = await api.dispatchRedistribution({
        surplus_id: surplusId,
        ngo_id: ngoId,
        transport_mode: transportMode,
      });
      setStatusMsg(
        `Claimed & dispatched ${res.redistribution.servings_delivered} servings (${res.redistribution.weight_kg} kg) to ${res.redistribution.ngo_name}.`
      );
      setActiveSlip(res.redistribution);
      await loadAll();
      onDataUpdated?.();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleConfirmDelivery = async (redistId) => {
    setError('');
    setStatusMsg('');
    try {
      await api.updateRedistributionStatus(redistId, 'Delivered');
      setStatusMsg('Delivery confirmed and recorded on safety audit trail.');
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
      setError(err.message);
    }
  };

  const handleRegisterNgo = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.createNgo(newNgo);
      setShowRegisterNgo(false);
      setStatusMsg(`Registered NGO hub "${res.ngo.name}" (${res.ngo.distance_km} km from kitchen).`);
      setNewNgo({ ...newNgo, name: '', phone: '' });
      await loadAll();
      onDataUpdated?.();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <SafetyHandoverSlipModal slip={activeSlip} onClose={() => setActiveSlip(null)} />

      {/* NGO Rescue Executive Banner */}
      <section className="module-banner space-y-4">
        <div className="absolute inset-0 hero-grid-overlay pointer-events-none opacity-45" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
              <HeartHandshake className="w-3.5 h-3.5" />
              NGO Food Rescue Portal &bull; {currentUser?.organization || 'Partner Network'}
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
              Verified Surplus Rescue &amp; Pickup Dispatch
            </h2>
            <p className="text-xs text-slate-300">
              Available Now: <strong className="text-white stat-value">{eligibleServings} servings</strong> &bull; Active
              Pickups: <strong className="text-amber-300 stat-value">{activePickups.length}</strong> &bull; Total
              Rescued: <strong className="text-teal-300 stat-value">{totalRescued} meals</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadAll}
              disabled={loading}
              className="h-9 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Queue
            </button>
            {subTab === 'partners' && (
              <button
                onClick={() => setShowRegisterNgo(!showRegisterNgo)}
                className="h-9 px-3.5 rounded-xl bg-white text-slate-950 hover:bg-teal-50 text-xs font-bold inline-flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5 text-teal-700" />
                Register NGO Hub
              </button>
            )}
          </div>
        </div>

        <div className="relative inline-flex flex-wrap gap-1 rounded-xl p-1 bg-white/10 border border-white/15">
          {[
            { id: 'queue', label: `Available Surplus (${visibleQueue.length})` },
            { id: 'pickups', label: `Active Pickups & Slips (${redistributions.length})` },
            { id: 'partners', label: `NGO Hubs (${ngos.length})` },
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

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800">{error}</div>
      )}
      {statusMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          {statusMsg}
        </div>
      )}

      {/* TAB 1: Available Surplus Queue & Pickup Claim */}
      {subTab === 'queue' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-3">
            {visibleQueue.length === 0 ? (
              <div className="card-surface p-8 text-center text-sm text-slate-500">
                No unclaimed surplus batches right now. Check back after the next meal service ends.
              </div>
            ) : (
              visibleQueue.map((s) => {
                const isSelected = s.surplus_id === selectedSurplusId;
                return (
                  <div
                    key={s.surplus_id}
                    onClick={() => setSelectedSurplusId(s.surplus_id)}
                    className={`card-interactive p-4 cursor-pointer ${
                      isSelected ? 'border-teal-600 ring-2 ring-teal-500/20 bg-teal-50/25' : ''
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
                          FSSAI Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Safety Blocked
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                        {s.holding_temp_c}°C ({STORAGE_LABELS[s.storage_type] || s.storage_type})
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-semibold inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {s.remaining_safe_hours}h pickup window
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
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedSurplus.servings_available} servings ({selectedSurplus.weight_kg} kg) &bull;{' '}
                      {selectedSurplus.notes}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-500">Pickup Vehicle:</span>
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

                {/* Safety Passport */}
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

                {/* Compatible NGO Assignment */}
                <div className="space-y-2.5">
                  <p className="field-label">Claim &amp; Dispatch to Verified Partner Hub</p>
                  {(selectedSurplus.all_matches || []).map((m, idx) => {
                    const isBest = selectedSurplus.or_tools_recommended_ngo?.ngo_id === m.ngo_id;
                    return (
                      <div
                        key={m.ngo_id}
                        className={`p-4 rounded-xl border transition ${
                          m.compatible
                            ? isBest
                              ? 'bg-teal-50/50 border-teal-300'
                              : 'bg-white border-slate-200'
                            : 'bg-slate-50 border-slate-200/80 opacity-65'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-sm text-slate-900">{m.name}</span>
                              {isBest && (
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-teal-700 text-white">
                                  Recommended #{idx + 1}
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
                                <MapPin className="w-3 h-3" /> {m.area} ({m.distance_km} km &bull; ETA {m.eta_minutes}m)
                              </span>
                              <span>&bull; Max {m.max_capacity_servings} serv</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm font-extrabold text-teal-700 stat-value">{m.match_score}%</p>
                              <p className="text-[10px] text-slate-400 uppercase">Fit</p>
                            </div>
                            {m.compatible && selectedSurplus.status === 'Eligible' && (
                              <button
                                onClick={() => handleClaimDispatch(selectedSurplus.surplus_id, m.ngo_id)}
                                className="btn-primary h-9 px-3.5 text-xs"
                              >
                                <Send className="w-3.5 h-3.5" />
                                Claim {m.allocatable_servings} serv
                              </button>
                            )}
                          </div>
                        </div>
                        {!m.compatible && m.blockers?.length > 0 && (
                          <p className="mt-2 text-[11px] text-red-700 font-medium">
                            Not Eligible: {m.blockers.join(' • ')}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="card-surface p-10 text-center text-sm text-slate-500">
                Select an available surplus batch on the left to inspect its FSSAI safety passport and claim pickup.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Active Pickups & Completed Delivery Archive */}
      {subTab === 'pickups' && (
        <div className="space-y-6">
          {activePickups.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-600" />
                In-Transit Pickups Awaiting Delivery Confirmation ({activePickups.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activePickups.map((r) => (
                  <div key={r.redistribution_id} className="card-interactive p-5 border-l-4 border-l-amber-500 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{r.menu_item_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {r.ngo_name} &bull; {r.servings_delivered} serv ({r.weight_kg} kg)
                        </p>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {r.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <button
                        onClick={() => setActiveSlip(r)}
                        className="text-slate-600 hover:text-slate-900 font-semibold inline-flex items-center gap-1"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Print Handover Slip
                      </button>
                      <button
                        onClick={() => handleConfirmDelivery(r.redistribution_id)}
                        className="btn-primary h-8 px-3 text-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Confirm Delivered
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card-surface p-6 overflow-x-auto">
            <h3 className="text-sm font-bold text-slate-900 mb-4">
              Completed &amp; Logged Rescue Dispatches ({redistributions.length})
            </h3>
            <table className="w-full text-xs text-left pro-table">
              <thead>
                <tr>
                  <th>Dish</th>
                  <th>Partner Hub</th>
                  <th>Volume</th>
                  <th>Distance &amp; Mode</th>
                  <th>Status</th>
                  <th className="text-right">Handover Slip</th>
                </tr>
              </thead>
              <tbody>
                {(completedPickups.length ? completedPickups : redistributions).map((r) => (
                  <tr key={r.redistribution_id}>
                    <td className="py-3 font-semibold text-slate-900">{r.menu_item_name}</td>
                    <td className="py-3 text-slate-600">{r.ngo_name}</td>
                    <td className="py-3 stat-value">
                      {r.servings_delivered} serv ({r.weight_kg} kg)
                    </td>
                    <td className="py-3 text-slate-500 stat-value">
                      {r.distance_km} km &bull; {r.transport_mode}
                    </td>
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
                    <td className="py-3 text-right">
                      <button
                        onClick={() => setActiveSlip(r)}
                        className="text-teal-700 font-semibold hover:underline inline-flex items-center gap-1"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        View Slip
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Partner NGO Hubs */}
      {subTab === 'partners' && (
        <div className="space-y-5">
          {showRegisterNgo && (
            <form onSubmit={handleRegisterNgo} className="card-surface p-6 space-y-4 border-teal-200">
              <h3 className="text-sm font-bold text-slate-900">Register NGO Receiving Hub</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  required
                  type="text"
                  placeholder="Organization Name"
                  value={newNgo.name}
                  onChange={(e) => setNewNgo({ ...newNgo, name: e.target.value })}
                  className="field-control text-xs"
                />
                <input
                  required
                  type="text"
                  placeholder="Area / Neighborhood"
                  value={newNgo.area}
                  onChange={(e) => setNewNgo({ ...newNgo, area: e.target.value })}
                  className="field-control text-xs"
                />
                <input
                  required
                  type="text"
                  placeholder="Contact Person & Phone"
                  value={newNgo.phone}
                  onChange={(e) => setNewNgo({ ...newNgo, phone: e.target.value })}
                  className="field-control text-xs"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowRegisterNgo(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save NGO Partner
                </button>
              </div>
            </form>
          )}

          <div className="card-surface p-6 overflow-x-auto">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Registered Partner Receiving Hubs</h3>
            <table className="w-full text-xs text-left pro-table">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Area &amp; Distance</th>
                  <th>Capacity</th>
                  <th>Cold Chain</th>
                  <th>Contact</th>
                  <th className="text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {ngos.map((n) => (
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
        </div>
      )}
    </div>
  );
}

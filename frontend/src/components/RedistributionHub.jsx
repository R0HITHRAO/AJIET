import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  Plus,
  Send,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
} from 'lucide-react';
import { api } from '../api';

function ProximityRadar({ kitchen, ngos, highlightedNgoId }) {
  const maxKm = 26;
  const cx = 140;
  const cy = 115;
  const scale = 92 / maxKm;

  return (
    <div className="card-surface p-4 bg-slate-900 text-white border-0">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
          <Navigation className="w-3.5 h-3.5" />
          Udupi – Bantakal Zone
        </p>
        <span className="text-[11px] text-slate-400">25 km radius</span>
      </div>
      <svg viewBox="0 0 280 230" className="w-full h-48">
        {[8, 16, 24].map((km) => (
          <g key={km}>
            <circle cx={cx} cy={cy} r={km * scale} fill="none" stroke="#334155" strokeDasharray="3 3" />
            <text x={cx + 3} y={cy - km * scale + 9} fill="#64748b" fontSize="8">
              {km}km
            </text>
          </g>
        ))}

        {ngos.map((ngo) => {
          const dLat = (ngo.lat - kitchen.lat) * 111.0;
          const dLon = (ngo.lon - kitchen.lon) * 108.0;
          const x = Math.max(18, Math.min(262, cx + dLon * scale));
          const y = Math.max(18, Math.min(212, cy - dLat * scale));
          const isHighlighted = ngo.ngo_id === highlightedNgoId;

          return (
            <g key={ngo.ngo_id}>
              <line
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke={isHighlighted ? '#34d399' : ngo.is_available ? '#475569' : '#334155'}
                strokeWidth={isHighlighted ? 2 : 1}
                strokeDasharray={isHighlighted ? '' : '2 2'}
              />
              <circle
                cx={x}
                cy={y}
                r={isHighlighted ? 6 : 4}
                fill={isHighlighted ? '#10b981' : ngo.is_available ? '#38bdf8' : '#64748b'}
                stroke="#0f172a"
                strokeWidth="1.5"
              />
              <text
                x={x + 6}
                y={y + 3}
                fill={isHighlighted ? '#a7f3d0' : '#cbd5e1'}
                fontSize="8.5"
                fontWeight={isHighlighted ? '700' : '500'}
              >
                {ngo.area}
              </text>
            </g>
          );
        })}

        <circle cx={cx} cy={cy} r="6.5" fill="#f59e0b" stroke="#fff" strokeWidth="2" />
        <text x={cx - 28} y={cy + 16} fill="#fde68a" fontSize="8.5" fontWeight="700">
          SMVITM Kitchen
        </text>
      </svg>
    </div>
  );
}

export default function RedistributionHub({ kitchenInfo, onDataUpdated }) {
  const [subTab, setSubTab] = useState('matching');
  const [surplusList, setSurplusList] = useState([]);
  const [ngos, setNgos] = useState([]);
  const [redistributions, setRedistributions] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedSurplusId, setSelectedSurplusId] = useState(null);
  const [showAddSurplus, setShowAddSurplus] = useState(false);
  const [transportMode, setTransportMode] = useState('NGO Pickup Van');
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');

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

  const loadAll = async () => {
    const [sRes, nRes, rRes, mRes] = await Promise.all([
      api.getSurplus(),
      api.getNgos(),
      api.getRedistributions(),
      api.getMenu(),
    ]);
    const items = sRes.surplus_items || [];
    setSurplusList(items);
    setNgos(nRes.ngos || []);
    setRedistributions(rRes.redistributions || []);
    setMenuItems(mRes.items || []);

    if (!selectedSurplusId || !items.some((i) => i.surplus_id === selectedSurplusId)) {
      const firstEligible = items.find((i) => i.status === 'Eligible') || items[0];
      setSelectedSurplusId(firstEligible?.surplus_id || null);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const selectedSurplus = surplusList.find((s) => s.surplus_id === selectedSurplusId) || null;
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

  const handleToggleNgo = async (ngo) => {
    await api.toggleNgoAvailability(ngo.ngo_id, !ngo.is_available);
    await loadAll();
    onDataUpdated?.();
  };

  return (
    <div className="space-y-6">
      {/* Clean Sub-Navigation + Primary Action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-xl bg-slate-200/70">
          {[
            { id: 'matching', label: `Matching Queue (${surplusList.length})` },
            { id: 'tracker', label: `Dispatch Tracker (${redistributions.length})` },
            { id: 'ngos', label: `NGO Network (${ngos.length})` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                subTab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button onClick={() => setShowAddSurplus(!showAddSurplus)} className="btn-primary">
          <Plus className="w-4 h-4" />
          Log Surplus Batch
        </button>
      </div>

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

      {/* Sub-Tab 1: Matching Queue */}
      {subTab === 'matching' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-3">
            {surplusList.map((s) => {
              const isSelected = s.surplus_id === selectedSurplusId;
              return (
                <div
                  key={s.surplus_id}
                  onClick={() => setSelectedSurplusId(s.surplus_id)}
                  className={`card-surface p-4 cursor-pointer transition border ${
                    isSelected
                      ? 'border-emerald-600 ring-2 ring-emerald-500/15'
                      : 'border-slate-200 hover:border-slate-300'
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
                      {s.holding_temp_c}°C ({s.storage_type})
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
            })}

            {kitchenInfo && (
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
                    {selectedSurplus.safety_status}
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
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] text-slate-400 uppercase">
                <th className="py-2.5">Dish</th>
                <th className="py-2.5">NGO Partner</th>
                <th className="py-2.5">Volume</th>
                <th className="py-2.5">Distance</th>
                <th className="py-2.5">Transport</th>
                <th className="py-2.5">Status</th>
                <th className="py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {redistributions.map((r) => (
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
                  <td className="py-3 text-right">
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
          <table className="w-full text-xs text-left">
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

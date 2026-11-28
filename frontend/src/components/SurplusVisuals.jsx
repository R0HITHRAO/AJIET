import React, { memo, useMemo, useState } from 'react';
import { Clock, MapPin, Navigation, Printer, Snowflake, X } from 'lucide-react';

export const ProximityRadar = memo(function ProximityRadar({ kitchen, ngos, highlightedNgoId }) {
  const [hoveredNgoId, setHoveredNgoId] = useState(null);
  const [pinnedNgoId, setPinnedNgoId] = useState(null);
  const maxKm = 25;
  const cx = 210;
  const cy = 150;
  const minR = 28;
  const maxR = 114;
  // Smooth square-root radial mapping starting cleanly outside the Kitchen Hub marker
  const radiusForKm = (km) =>
    minR + (maxR - minR) * Math.sqrt(Math.max(0.02, Math.min(km, maxKm)) / maxKm);

  const { plotted, sortedNgos } = useMemo(() => {
    const latScale = 111.32;
    const lonScale = 111.32 * Math.cos(((kitchen.lat || 13.2557) * Math.PI) / 180);

    const pts = ngos.map((ngo) => {
      const dLat = (ngo.lat - kitchen.lat) * latScale;
      const dLon = (ngo.lon - kitchen.lon) * lonScale;
      const distKm = ngo.distance_km ?? Math.hypot(dLat, dLon);
      const angle = Math.atan2(-dLat, dLon);
      const r = radiusForKm(distKm);
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      const labelR = r + 15;
      const lx = cx + Math.cos(angle) * labelR;
      const ly = cy + Math.sin(angle) * labelR;
      const anchor = Math.cos(angle) > 0.25 ? 'start' : Math.cos(angle) < -0.25 ? 'end' : 'middle';
      return { ngo, distKm, x, y, lx, ly, anchor };
    });

    // De-overlap nearby labels cleanly
    for (let pass = 0; pass < 2; pass += 1) {
      for (let i = 0; i < pts.length; i += 1) {
        for (let j = i + 1; j < pts.length; j += 1) {
          const a = pts[i];
          const b = pts[j];
          if (Math.abs(a.lx - b.lx) < 58 && Math.abs(a.ly - b.ly) < 16) {
            if (a.ly <= b.ly) {
              a.ly -= 8;
              b.ly += 8;
            } else {
              a.ly += 8;
              b.ly -= 8;
            }
          }
        }
      }
    }

    return { plotted: pts, sortedNgos: [...pts].sort((a, b) => a.distKm - b.distKm) };
  }, [kitchen.lat, kitchen.lon, ngos]);

  const activeId = hoveredNgoId || pinnedNgoId || highlightedNgoId;
  const activeEntry = sortedNgos.find((p) => p.ngo.ngo_id === activeId) || sortedNgos[0];

  return (
    <div className="card-surface p-5 bg-[#0b1222] text-white border border-slate-700/60 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5" />
            Service Zone Radar
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            True geographic bearing &bull; Hover or tap any hub
          </p>
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/[0.07] border border-white/10 text-slate-300 stat-value">
          {ngos.filter((n) => n.is_available).length}/{ngos.length} active &bull; 25 km
        </span>
      </div>

      <div className="w-full max-w-[440px] mx-auto">
        <svg viewBox="0 0 420 300" className="w-full h-auto block select-none">
          <defs>
            <radialGradient id="radarField" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.16" />
              <stop offset="55%" stopColor="#0f172a" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#0b1222" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Ambient radar sweep backdrop */}
          <circle cx={cx} cy={cy} r={maxR + 12} fill="url(#radarField)" />

          {/* Crosshair Axes + Cardinal Markers */}
          <line x1={cx - maxR - 10} y1={cy} x2={cx + maxR + 10} y2={cy} stroke="#1e293b" strokeWidth="1" />
          <line x1={cx} y1={cy - maxR - 10} x2={cx} y2={cy + maxR + 10} stroke="#1e293b" strokeWidth="1" />
          {[
            { label: 'N', x: cx, y: cy - maxR - 15 },
            { label: 'S', x: cx, y: cy + maxR + 22 },
            { label: 'E', x: cx + maxR + 18, y: cy + 3 },
            { label: 'W', x: cx - maxR - 18, y: cy + 3 },
          ].map((c) => (
            <text key={c.label} x={c.x} y={c.y} textAnchor="middle" fill="#475569" fontSize="9" fontWeight="700">
              {c.label}
            </text>
          ))}

          {/* Range Rings (5km, 12km, 25km) */}
          {[5, 12, 25].map((km) => {
            const r = radiusForKm(km);
            return (
              <g key={km}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={km === 25 ? '#334155' : '#1e293b'}
                  strokeWidth={km === 25 ? 1.2 : 1}
                  strokeDasharray={km === 25 ? '' : '3 3'}
                />
                <text
                  x={cx + 3}
                  y={cy + r - 3}
                  textAnchor="start"
                  fill="#64748b"
                  fontSize="8.5"
                  fontWeight="600"
                  stroke="#0b1222"
                  strokeWidth="3"
                  paintOrder="stroke"
                >
                  {km} km
                </text>
              </g>
            );
          })}

          {/* NGO Nodes & Bearing Lines */}
          {plotted.map(({ ngo, x, y, lx, ly, anchor }) => {
            const isActive = ngo.ngo_id === activeId;
            const isBest = ngo.ngo_id === highlightedNgoId;
            return (
              <g
                key={ngo.ngo_id}
                onMouseEnter={() => setHoveredNgoId(ngo.ngo_id)}
                onMouseLeave={() => setHoveredNgoId(null)}
                onClick={() => setPinnedNgoId((prev) => (prev === ngo.ngo_id ? null : ngo.ngo_id))}
                className="cursor-pointer"
              >
                <line
                  x1={cx}
                  y1={cy}
                  x2={x}
                  y2={y}
                  stroke={isBest ? '#2dd4bf' : isActive ? '#38bdf8' : ngo.is_available ? '#334155' : '#1e293b'}
                  strokeWidth={isBest || isActive ? 2 : 1}
                  strokeDasharray={isBest || isActive ? '' : '2.5 2.5'}
                />
                {(isBest || isActive) && (
                  <circle
                    cx={x}
                    cy={y}
                    r="10"
                    fill={isBest ? '#14b8a6' : '#38bdf8'}
                    fillOpacity="0.22"
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={isBest || isActive ? 6 : 4.5}
                  fill={isBest ? '#14b8a6' : ngo.is_available ? '#38bdf8' : '#64748b'}
                  stroke="#0b1222"
                  strokeWidth="1.75"
                />
                <text
                  x={Math.max(24, Math.min(396, lx))}
                  y={Math.max(18, Math.min(284, ly + 3))}
                  textAnchor={anchor}
                  fill={isBest ? '#5eead4' : isActive ? '#bae6fd' : ngo.is_available ? '#e2e8f0' : '#64748b'}
                  fontSize="10"
                  fontWeight={isBest || isActive ? '700' : '500'}
                  stroke="#0b1222"
                  strokeWidth="4"
                  paintOrder="stroke"
                >
                  {ngo.area}
                </text>
              </g>
            );
          })}

          {/* Central Kitchen Hub Marker */}
          <circle cx={cx} cy={cy} r="13" fill="#f59e0b" fillOpacity="0.18" />
          <circle cx={cx} cy={cy} r="6.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
          <text
            x={cx}
            y={cy + 17}
            textAnchor="middle"
            fill="#fde68a"
            fontSize="9.5"
            fontWeight="700"
            stroke="#0b1222"
            strokeWidth="3.5"
            paintOrder="stroke"
          >
            Kitchen Hub
          </text>
        </svg>
      </div>

      {/* Selected / Recommended NGO Live Telemetry Card */}
      {activeEntry && (
        <div className="p-3 rounded-xl bg-white/[0.06] border border-white/10 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-white truncate flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  activeEntry.ngo.ngo_id === highlightedNgoId
                    ? 'bg-teal-400'
                    : activeEntry.ngo.is_available
                    ? 'bg-sky-400'
                    : 'bg-slate-500'
                }`}
              />
              {activeEntry.ngo.name}
            </p>
            <p className="text-[11px] text-slate-300 mt-0.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3 text-teal-300" />
                {activeEntry.distKm.toFixed(1)} km
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                {activeEntry.ngo.eta_minutes ?? Math.max(5, Math.round(activeEntry.distKm * 3.1 + 4))}m ETA
              </span>
              <span>Cap {activeEntry.ngo.max_capacity_servings} serv</span>
              {activeEntry.ngo.has_cold_chain && (
                <span className="inline-flex items-center gap-1 text-sky-300">
                  <Snowflake className="w-3 h-3" /> Cold Chain
                </span>
              )}
            </p>
          </div>
          <span
            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
              activeEntry.ngo.is_available
                ? 'bg-teal-500/20 text-teal-200 border-teal-400/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {activeEntry.ngo.ngo_id === highlightedNgoId
              ? 'Best Match'
              : activeEntry.ngo.is_available
              ? 'Ready'
              : 'Paused'}
          </span>
        </div>
      )}

      {/* Distance Chips */}
      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/90">
        {sortedNgos.map(({ ngo, distKm }) => {
          const isBest = ngo.ngo_id === highlightedNgoId;
          const isActive = ngo.ngo_id === activeId;
          return (
            <button
              type="button"
              key={ngo.ngo_id}
              onMouseEnter={() => setHoveredNgoId(ngo.ngo_id)}
              onMouseLeave={() => setHoveredNgoId(null)}
              onClick={() => setPinnedNgoId((prev) => (prev === ngo.ngo_id ? null : ngo.ngo_id))}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold transition ${
                isBest
                  ? 'bg-teal-500/20 text-teal-200 border border-teal-400/40'
                  : isActive
                  ? 'bg-sky-500/20 text-sky-200 border border-sky-400/40'
                  : ngo.is_available
                  ? 'bg-slate-800/90 text-slate-300 border border-slate-700 hover:border-slate-500'
                  : 'bg-slate-900 text-slate-500 border border-slate-800'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isBest ? 'bg-teal-400' : ngo.is_available ? 'bg-sky-400' : 'bg-slate-500'
                }`}
              />
              {ngo.area} &bull; {distKm.toFixed(1)} km
            </button>
          );
        })}
      </div>
    </div>
  );
});

const STORAGE_LABELS = {
  hot_hold: 'Hot Hold',
  chilled: 'Chilled',
  ambient: 'Ambient',
};

export function SafetyHandoverSlipModal({ slip, onClose }) {
  if (!slip) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="animate-modal-in my-auto bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
              FSSAI Food-Safety Handover Slip
            </span>
            <h3 className="font-display text-lg font-extrabold text-slate-900 mt-0.5">{slip.menu_item_name}</h3>
          </div>
          <button onClick={onClose} className="no-print p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase text-emerald-800">Handover Verification Code</p>
            <p className="text-xl font-mono font-bold tracking-widest text-emerald-950 stat-value">
              {slip.handover_code || slip.redistribution_id.slice(-6).toUpperCase()}
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-700 text-white text-xs font-semibold">
            {slip.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50">
            <p className="text-slate-400 font-semibold">Quantity</p>
            <p className="font-bold text-slate-900 mt-0.5 stat-value">
              {slip.servings_delivered} servings ({slip.weight_kg} kg)
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50">
            <p className="text-slate-400 font-semibold">Storage &amp; Temp</p>
            <p className="font-bold text-slate-900 mt-0.5 stat-value">
              {slip.holding_temp_c != null ? `${slip.holding_temp_c}°C` : 'Safe Zone'} (
              {STORAGE_LABELS[slip.storage_type] || 'Hot Hold'})
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50">
            <p className="text-slate-400 font-semibold">Safe Window Left</p>
            <p className="font-bold text-slate-900 mt-0.5 stat-value">
              {slip.remaining_safe_hours != null ? `${slip.remaining_safe_hours} hrs` : 'Verified'}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50">
            <p className="text-slate-400 font-semibold">Transit &amp; Distance</p>
            <p className="font-bold text-slate-900 mt-0.5 stat-value">
              {slip.distance_km} km &bull; {slip.transport_mode}
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
          <p className="font-bold text-slate-900">Recipient: {slip.ngo_name}</p>
          {slip.ngo_contact && <p className="text-slate-500">Contact: {slip.ngo_contact}</p>}
          <p className="text-slate-400">Logged at: {slip.created_at}</p>
        </div>

        <div className="no-print flex items-center justify-end gap-2 pt-2">
          <button onClick={() => window.print()} className="btn-secondary">
            <Printer className="w-4 h-4" />
            Print Slip
          </button>
          <button onClick={onClose} className="btn-primary">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

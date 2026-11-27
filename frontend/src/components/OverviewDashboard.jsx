import React, { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  ChefHat,
  Clock,
  Coffee,
  Cookie,
  HeartHandshake,
  Leaf,
  Moon,
  Sparkles,
  Sun,
  TrendingDown,
  Truck,
  Wallet,
} from 'lucide-react';

const SLOT_META = {
  Breakfast: { icon: Coffee, time: '07:30 – 09:30', badge: 'text-amber-700 bg-amber-50 border-amber-200/80' },
  Lunch: { icon: Sun, time: '12:15 – 14:30', badge: 'text-emerald-700 bg-emerald-50 border-emerald-200/80' },
  Snacks: { icon: Cookie, time: '16:30 – 18:00', badge: 'text-sky-700 bg-sky-50 border-sky-200/80' },
  Dinner: { icon: Moon, time: '19:30 – 21:30', badge: 'text-indigo-700 bg-indigo-50 border-indigo-200/80' },
};

export default function OverviewDashboard({ data, onNavigate, onSelectSlot }) {
  const [chartView, setChartView] = useState('trend');

  if (!data) {
    return (
      <div className="card-surface p-16 text-center text-sm text-slate-500">
        Loading Nourish AI kitchen telemetry...
      </div>
    );
  }

  const {
    kpis,
    daily_trend: dailyTrend,
    slot_breakdown: slotBreakdown,
    top_waste_items: topWaste,
    perishability_alerts: perishabilityAlerts = [],
    ml_summary: ml,
  } = data;

  return (
    <div className="space-y-8">
      {/* 1. Architectural Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl hero-mesh text-white p-7 sm:p-10 shadow-[0_20px_50px_-15px_rgba(4,47,46,0.45)] border border-emerald-800/40">
        <div className="absolute inset-0 hero-grid-overlay pointer-events-none opacity-60" />

        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-xs font-semibold text-emerald-100">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              SMVITM Institutional Kitchen &bull; Sample-data demo
            </div>

            <h1 className="font-display text-3xl sm:text-[42px] font-extrabold tracking-tight leading-[1.12]">
              Cook what&apos;s needed. <br className="hidden sm:block" />
              Rescue what&apos;s left.
            </h1>

            <p className="text-sm sm:text-base text-emerald-100/85 max-w-xl leading-relaxed">
              Forecast institutional meal demand with Random Forest &amp; XGBoost, optimize two-stage batch cooking via
              Google OR-Tools, and screen surplus before recommending nearby NGO matches.
            </p>

            <div className="pt-1 flex flex-wrap items-center gap-3">
              <button
                onClick={() => onSelectSlot?.('Lunch')}
                className="h-11 px-5 rounded-xl bg-white text-emerald-950 hover:bg-emerald-50 text-sm font-bold inline-flex items-center gap-2 shadow-sm transition"
              >
                <ChefHat className="w-4 h-4" />
                Plan Next Meal
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => onNavigate('redistribution')}
                className="h-11 px-5 rounded-xl bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/20 text-white text-sm font-semibold inline-flex items-center gap-2 transition"
              >
                <Truck className="w-4 h-4 text-amber-300" />
                Rescue {kpis.eligible_surplus_servings_live} Surplus Servings
              </button>
            </div>
          </div>

          {/* Illustrative impact estimates based on the checked-in demo dataset. */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-3.5">
            {[
              {
                icon: TrendingDown,
                iconColor: 'text-emerald-300',
                label: 'Projected Waste Prevented / mo',
                value: `${kpis.monthly_waste_prevented_kg.toLocaleString()} kg`,
                sub: `Illustrative estimate · ${kpis.waste_reduction_pct}%`,
              },
              {
                icon: Wallet,
                iconColor: 'text-sky-300',
                label: 'Projected Cost Saved / mo',
                value: `₹${Math.round(kpis.monthly_cost_saved_inr).toLocaleString('en-IN')}`,
                sub: `Demo-data sufficiency · ${kpis.meal_sufficiency_pct}%`,
              },
              {
                icon: HeartHandshake,
                iconColor: 'text-amber-300',
                label: 'Demo Meals Rescued',
                value: kpis.meals_redistributed.toLocaleString(),
                sub: `${kpis.active_ngo_partners} demo NGO partners`,
              },
              {
                icon: Leaf,
                iconColor: 'text-emerald-300',
                label: 'Estimated CO₂ Avoided',
                value: `${kpis.co2_avoided_kg.toLocaleString()} kg`,
                sub: `Illustrative estimate · Model v${ml?.model_version || 1}`,
              },
            ].map((tile) => {
              const TileIcon = tile.icon;
              return (
                <div
                  key={tile.label}
                  className="p-4 rounded-2xl bg-white/[0.08] backdrop-blur-md border border-white/15 hover:bg-white/[0.12] transition"
                >
                  <div className="flex items-center gap-2 text-emerald-100/90 text-xs font-medium">
                    <TileIcon className={`w-4 h-4 ${tile.iconColor}`} />
                    {tile.label}
                  </div>
                  <p className="mt-2 font-display text-2xl font-extrabold stat-value tracking-tight">
                    {tile.value}
                  </p>
                  <p className="text-[11px] text-emerald-200/75 mt-0.5">{tile.sub}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2. Interactive Meal Service Cards */}
      <section className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">Today&apos;s Meal Services</h2>
            <p className="text-xs text-slate-500">Select a service window to view ML demand forecasts and batch plans</p>
          </div>
          <button
            onClick={() => onNavigate('simulator')}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
          >
            Open What-If Simulator <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {slotBreakdown.map((slot) => {
            const meta = SLOT_META[slot.meal_slot] || SLOT_META.Lunch;
            const Icon = meta.icon;
            return (
              <button
                key={slot.meal_slot}
                onClick={() => onSelectSlot?.(slot.meal_slot)}
                className="card-interactive p-5 text-left group flex flex-col justify-between relative overflow-hidden"
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`w-10 h-10 rounded-xl border flex items-center justify-center ${meta.badge}`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 stat-value">
                    {slot.ai_projected_waste_pct}% projected waste
                  </span>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-800 transition">
                      {slot.meal_slot}
                    </h3>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1 inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {meta.time}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400 stat-value">Legacy: {slot.waste_pct}% waste</span>
                  <span className="font-semibold text-emerald-700">Plan batches</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Visual Chart + Refined Action Center */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="card-surface p-6 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {chartView === 'trend' ? '21-Day Prep vs Served Demand' : 'Waste Reduction by Meal Slot'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {chartView === 'trend'
                  ? 'Two-stage batch cooking aligns kitchen output with actual dining turnout'
                  : 'Comparison of baseline single-batch waste vs Nourish AI optimization'}
              </p>
            </div>
            <div className="segmented-track">
              <button
                onClick={() => setChartView('trend')}
                className={`segmented-pill ${
                  chartView === 'trend' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                21-Day Trend
              </button>
              <button
                onClick={() => setChartView('slots')}
                className={`segmented-pill ${
                  chartView === 'slots' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                By Meal Slot
              </button>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              {chartView === 'trend' ? (
                <AreaChart data={dailyTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="servedGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 8px 20px -6px rgba(15,23,42,0.12)',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  <Area
                    type="monotone"
                    dataKey="prepared_servings"
                    name="Traditional Prep"
                    stroke="#f59e0b"
                    fill="none"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="optimized_batch_target"
                    name="Nourish AI Target"
                    stroke="#0284c7"
                    fill="none"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="served_servings"
                    name="Actual Served"
                    stroke="#059669"
                    fill="url(#servedGlow)"
                    strokeWidth={2.5}
                  />
                </AreaChart>
              ) : (
                <BarChart data={slotBreakdown} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="meal_slot" tick={{ fontSize: 12, fill: '#475569' }} />
                  <YAxis unit="%" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 8px 20px -6px rgba(15,23,42,0.12)',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  <Bar dataKey="waste_pct" name="Baseline Waste %" fill="#cbd5e1" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="ai_projected_waste_pct" name="Nourish AI Waste %" fill="#059669" radius={[8, 8, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Clean Kitchen Action Center */}
        <div className="card-surface p-6 lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Kitchen Action Center</h2>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Priority</span>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => onNavigate('redistribution')}
              className="w-full p-4 rounded-xl bg-slate-50/80 hover:bg-emerald-50/60 border border-slate-200/90 border-l-4 border-l-emerald-600 text-left flex items-center justify-between transition"
            >
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Truck className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {kpis.eligible_surplus_servings_live} Safe Surplus Servings
                  </p>
                  <p className="text-xs text-slate-500">Verified &amp; ready for NGO dispatch</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>

            {perishabilityAlerts.length > 0 && (
              <button
                onClick={() => onNavigate('inventory', { subTab: 'inventory', filter: 'perishable' })}
                className="w-full p-4 rounded-xl bg-slate-50/80 hover:bg-sky-50/60 border border-slate-200/90 border-l-4 border-l-sky-600 text-left flex items-center justify-between transition"
              >
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700">
                    Use Soon &bull; {perishabilityAlerts.length} Perishable Item{perishabilityAlerts.length > 1 ? 's' : ''} ({perishabilityAlerts[0].perishability_days}d Shelf Life)
                  </p>
                  <p className="text-xs text-slate-700 mt-0.5">
                    <strong>{perishabilityAlerts[0].name}</strong> ({perishabilityAlerts[0].stock_qty} {perishabilityAlerts[0].unit})
                    {perishabilityAlerts[0].suggested_dishes?.[0]
                      ? ` → Prioritize ${perishabilityAlerts[0].suggested_dishes[0].name}`
                      : ''}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            )}

            {kpis.low_stock_ingredients > 0 && (
              <button
                onClick={() => onNavigate('inventory', { subTab: 'inventory', filter: 'low_stock' })}
                className="w-full p-4 rounded-xl bg-slate-50/80 hover:bg-amber-50/60 border border-slate-200/90 border-l-4 border-l-amber-500 text-left flex items-center justify-between transition"
              >
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {kpis.low_stock_ingredients} Low-Stock Ingredient(s)
                    </p>
                    <p className="text-xs text-slate-500">Review pantry levels before prep</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>
            )}
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Top Dishes to Watch
              </p>
              <button
                onClick={() => onNavigate('feedback', { subTab: 'diagnostics' })}
                className="text-xs font-semibold text-emerald-700 hover:underline"
              >
                AI Validation →
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {topWaste.slice(0, 3).map((dish) => (
                <div key={dish.menu_item_id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-slate-800">{dish.name}</p>
                    <p className="text-slate-400">{dish.meal_slot}</p>
                  </div>
                  <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg stat-value">
                    {dish.waste_kg} kg hist.
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

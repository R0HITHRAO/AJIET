import React, { memo, useState } from 'react';
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
  Sprout,
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

export default memo(function OverviewDashboard({
  data,
  pendingAlertsCount = 0,
  onNavigate,
  onSelectSlot,
  onOpenKitchenAlerts,
}) {
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
      <section className="relative overflow-hidden rounded-3xl hero-mesh text-white p-7 sm:p-10 shadow-[0_24px_60px_-15px_rgba(11,18,34,0.58)] border border-slate-700/60">
        <div className="absolute inset-0 hero-grid-overlay pointer-events-none opacity-65" />
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-teal-400/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-16 w-64 h-64 rounded-full bg-amber-400/12 blur-3xl pointer-events-none" />

        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/[0.07] backdrop-blur-md border border-white/15 text-[11px] font-semibold uppercase tracking-wider text-teal-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              Institutional Kitchen &amp; Mess &bull; Live Operations
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-teal-400/25 via-emerald-400/15 to-amber-300/20 border border-white/20 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_12px_24px_-8px_rgba(0,0,0,0.4)] shrink-0">
                  <Sprout className="w-6 h-6 sm:w-7 sm:h-7 text-teal-200" />
                </div>
                <div>
                  <h1 className="font-display text-4xl sm:text-[52px] font-extrabold tracking-tight leading-none text-white">
                    Nourish{' '}
                    <span className="bg-gradient-to-r from-teal-300 via-cyan-200 to-amber-200 bg-clip-text text-transparent">
                      AI
                    </span>
                  </h1>
                  <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 mt-1.5">
                    Smart Kitchen Forecasting &amp; Surplus Redistribution
                  </p>
                </div>
              </div>

              <p className="font-display text-xl sm:text-[26px] font-bold tracking-tight leading-snug text-slate-100">
                Cook what&apos;s needed.{' '}
                <span className="bg-gradient-to-r from-teal-200 via-cyan-100 to-amber-200 bg-clip-text text-transparent">
                  Rescue what&apos;s left.
                </span>
              </p>
            </div>

            <p className="text-sm sm:text-[15px] text-slate-300/90 max-w-xl leading-relaxed">
              Forecast daily dining turnout, schedule two-stage batch cooking, and verify safe surplus before
              recommending nearby NGO matches.
            </p>

            <div className="pt-1 flex flex-wrap items-center gap-3">
              <button
                onClick={() => onSelectSlot?.('Lunch')}
                className="h-11 px-5 rounded-xl bg-white text-slate-950 hover:bg-teal-50 active:scale-[0.985] text-sm font-bold inline-flex items-center gap-2 shadow-[0_8px_22px_-6px_rgba(255,255,255,0.32)] transition-all"
              >
                <ChefHat className="w-4 h-4 text-teal-700" />
                Plan Next Meal
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => onNavigate('redistribution')}
                className="h-11 px-5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] active:scale-[0.985] backdrop-blur-md border border-white/20 text-white text-sm font-semibold inline-flex items-center gap-2 transition-all"
              >
                <Truck className="w-4 h-4 text-amber-300" />
                Rescue {kpis.eligible_surplus_servings_live} Surplus Servings
              </button>
            </div>
          </div>

          {/* Executive KPI glass tiles */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-3.5">
            {[
              {
                icon: TrendingDown,
                iconBg: 'bg-teal-400/15 border-teal-300/20',
                iconColor: 'text-teal-300',
                label: 'Waste Prevented / mo',
                value: `${kpis.monthly_waste_prevented_kg.toLocaleString()} kg`,
                sub: `${kpis.waste_reduction_pct}% reduction vs baseline`,
              },
              {
                icon: Wallet,
                iconBg: 'bg-sky-400/15 border-sky-300/20',
                iconColor: 'text-sky-300',
                label: 'Cost Saved / mo',
                value: `₹${Math.round(kpis.monthly_cost_saved_inr).toLocaleString('en-IN')}`,
                sub: `${kpis.meal_sufficiency_pct}% meal sufficiency`,
              },
              {
                icon: HeartHandshake,
                iconBg: 'bg-amber-400/15 border-amber-300/20',
                iconColor: 'text-amber-300',
                label: 'Meals Rescued',
                value: kpis.meals_redistributed.toLocaleString(),
                sub: `${kpis.active_ngo_partners} active NGO partners`,
              },
              {
                icon: Leaf,
                iconBg: 'bg-emerald-400/15 border-emerald-300/20',
                iconColor: 'text-emerald-300',
                label: 'CO₂ Avoided',
                value: `${kpis.co2_avoided_kg.toLocaleString()} kg`,
                sub: `Model v${ml?.model_version || 1} active`,
              },
            ].map((tile) => {
              const TileIcon = tile.icon;
              return (
                <div key={tile.label} className="kpi-tile">
                  <div className="flex items-center gap-2 text-slate-200 text-xs font-medium">
                    <span className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${tile.iconBg}`}>
                      <TileIcon className={`w-3.5 h-3.5 ${tile.iconColor}`} />
                    </span>
                    <span className="truncate">{tile.label}</span>
                  </div>
                  <p className="mt-2.5 font-display text-2xl font-extrabold stat-value tracking-tight">
                    {tile.value}
                  </p>
                  <p className="text-[11px] text-slate-300/80 mt-0.5 truncate">{tile.sub}</p>
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
                <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-500/0 via-emerald-500/70 to-teal-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between w-full">
                  <span className={`w-10 h-10 rounded-xl border flex items-center justify-center shadow-sm ${meta.badge}`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 stat-value">
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
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0.01} />
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
                    stroke="#0d9488"
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
                  <Bar dataKey="ai_projected_waste_pct" name="Nourish AI Waste %" fill="#0d9488" radius={[8, 8, 0, 0]} />
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
            {pendingAlertsCount > 0 && (
              <button
                onClick={() => onOpenKitchenAlerts?.()}
                className="w-full p-4 rounded-xl bg-amber-50/90 hover:bg-amber-100/80 border border-amber-300 border-l-4 border-l-amber-600 text-left flex items-center justify-between hover:shadow-md hover:-translate-y-0.5 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0 animate-pulse">
                    <AlertTriangle className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-amber-950">
                      {pendingAlertsCount} Chef Dish-Shortage Alert{pendingAlertsCount > 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-amber-800">
                      Click to notify Chef with remaining customer count
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-700" />
              </button>
            )}

            <button
              onClick={() => onNavigate('redistribution')}
              className="w-full p-4 rounded-xl bg-slate-50/80 hover:bg-emerald-50/70 border border-slate-200/90 border-l-4 border-l-emerald-600 text-left flex items-center justify-between hover:shadow-md hover:-translate-y-0.5 transition"
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
                className="w-full p-4 rounded-xl bg-slate-50/80 hover:bg-sky-50/70 border border-slate-200/90 border-l-4 border-l-sky-600 text-left flex items-center justify-between hover:shadow-md hover:-translate-y-0.5 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </span>
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
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            )}

            {kpis.low_stock_ingredients > 0 && (
              <button
                onClick={() => onNavigate('inventory', { subTab: 'inventory', filter: 'low_stock' })}
                className="w-full p-4 rounded-xl bg-slate-50/80 hover:bg-amber-50/70 border border-slate-200/90 border-l-4 border-l-amber-500 text-left flex items-center justify-between hover:shadow-md hover:-translate-y-0.5 transition"
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
});

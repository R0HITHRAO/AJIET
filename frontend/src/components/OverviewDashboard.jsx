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
  Breakfast: { icon: Coffee, time: '07:30 – 09:30', color: 'text-amber-600 bg-amber-50' },
  Lunch: { icon: Sun, time: '12:15 – 14:30', color: 'text-emerald-700 bg-emerald-50' },
  Snacks: { icon: Cookie, time: '16:30 – 18:00', color: 'text-sky-700 bg-sky-50' },
  Dinner: { icon: Moon, time: '19:30 – 21:30', color: 'text-indigo-700 bg-indigo-50' },
};

export default function OverviewDashboard({ data, onNavigate, onSelectSlot }) {
  const [chartView, setChartView] = useState('trend');

  if (!data) {
    return (
      <div className="card-surface p-16 text-center text-sm text-slate-500">
        Warming up Nourish AI kitchen intelligence...
      </div>
    );
  }

  const { kpis, daily_trend: dailyTrend, slot_breakdown: slotBreakdown, top_waste_items: topWaste, ml_summary: ml } = data;

  return (
    <div className="space-y-8">
      {/* 1. Product Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 text-white p-6 sm:p-10 shadow-lg">
        <div className="absolute -right-24 -top-24 w-80 h-80 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-24 w-72 h-72 rounded-full bg-teal-400/10 blur-3xl pointer-events-none" />

        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-emerald-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              AI Demand Forecasting + OR-Tools Batch Optimization
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
              Cook what&apos;s needed. <br className="hidden sm:block" />
              Rescue what&apos;s left.
            </h1>
            <p className="text-sm sm:text-base text-emerald-100/85 max-w-xl leading-relaxed">
              Predict daily institutional meal turnout, split cooking into smart initial and on-demand reserve batches,
              and route safe surplus food to nearby NGOs within minutes.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
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
                className="h-11 px-5 rounded-xl bg-emerald-800/70 hover:bg-emerald-800 border border-emerald-400/30 text-white text-sm font-semibold inline-flex items-center gap-2 transition"
              >
                <Truck className="w-4 h-4 text-amber-300" />
                Rescue {kpis.eligible_surplus_servings_live} Surplus Servings
              </button>
            </div>
          </div>

          {/* Live Impact Snapshot Panel */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15">
              <div className="flex items-center gap-2 text-emerald-200 text-xs font-medium">
                <TrendingDown className="w-4 h-4 text-emerald-300" />
                Waste Prevented / mo
              </div>
              <p className="mt-2 text-2xl font-extrabold stat-value">
                {kpis.monthly_waste_prevented_kg.toLocaleString()} kg
              </p>
              <p className="text-[11px] text-emerald-200/80 mt-0.5">{kpis.waste_reduction_pct}% less over-prep</p>
            </div>

            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15">
              <div className="flex items-center gap-2 text-emerald-200 text-xs font-medium">
                <Wallet className="w-4 h-4 text-sky-300" />
                Cost Saved / mo
              </div>
              <p className="mt-2 text-2xl font-extrabold stat-value">
                ₹{Math.round(kpis.monthly_cost_saved_inr).toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-emerald-200/80 mt-0.5">{kpis.meal_sufficiency_pct}% meal sufficiency</p>
            </div>

            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15">
              <div className="flex items-center gap-2 text-emerald-200 text-xs font-medium">
                <HeartHandshake className="w-4 h-4 text-amber-300" />
                Meals Rescued
              </div>
              <p className="mt-2 text-2xl font-extrabold stat-value">{kpis.meals_redistributed.toLocaleString()}</p>
              <p className="text-[11px] text-emerald-200/80 mt-0.5">
                Across {kpis.active_ngo_partners} active NGOs
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15">
              <div className="flex items-center gap-2 text-emerald-200 text-xs font-medium">
                <Leaf className="w-4 h-4 text-emerald-300" />
                CO₂ Avoided
              </div>
              <p className="mt-2 text-2xl font-extrabold stat-value">{kpis.co2_avoided_kg.toLocaleString()} kg</p>
              <p className="text-[11px] text-emerald-200/80 mt-0.5">
                ML v{ml?.model_version || 1} active
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Interactive Meal Slot Cards */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Today&apos;s Meal Services</h2>
            <p className="text-xs text-slate-500">Click any meal service to open its AI batch preparation schedule</p>
          </div>
          <button
            onClick={() => onNavigate('simulator')}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
          >
            Test What-If Scenarios <ArrowRight className="w-3.5 h-3.5" />
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
                className="card-interactive p-5 text-left group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${meta.color}`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                    AI target {slot.ai_projected_waste_pct}% waste
                  </span>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-800 transition">
                      {slot.meal_slot}
                    </h3>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition" />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{meta.time}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Baseline waste: {slot.waste_pct}%</span>
                  <span className="font-semibold text-emerald-700">Plan batches</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Visual Insights + Live Kitchen Action Feed */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Single Interactive Chart with Toggle */}
        <div className="card-surface p-6 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {chartView === 'trend' ? '21-Day Kitchen Prep vs Served Demand' : 'Waste Reduction by Meal Slot'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {chartView === 'trend'
                  ? 'See how two-stage batch cooking closes the gap between over-preparation and actual turnout'
                  : 'Traditional single-batch waste % compared with Nourish AI batch-wise cooking'}
              </p>
            </div>
            <div className="inline-flex p-1 rounded-xl bg-slate-100">
              <button
                onClick={() => setChartView('trend')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  chartView === 'trend' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                21-Day Trend
              </button>
              <button
                onClick={() => setChartView('slots')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
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
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
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
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  <Bar dataKey="waste_pct" name="Baseline Waste %" fill="#cbd5e1" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="ai_projected_waste_pct" name="Nourish AI Waste %" fill="#059669" radius={[8, 8, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Action Center */}
        <div className="card-surface p-6 lg:col-span-5 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-900">Kitchen Action Center</h2>

            <button
              onClick={() => onNavigate('redistribution')}
              className="w-full p-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 text-left flex items-center justify-between transition"
            >
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
                  <Truck className="w-5 h-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-emerald-950">
                    {kpis.eligible_surplus_servings_live} Safe Surplus Servings
                  </p>
                  <p className="text-xs text-emerald-800">Ready for NGO pickup &amp; dispatch</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-emerald-700" />
            </button>

            {kpis.low_stock_ingredients > 0 && (
              <button
                onClick={() => onNavigate('inventory')}
                className="w-full p-4 rounded-2xl bg-amber-50 hover:bg-amber-100/70 border border-amber-200 text-left flex items-center justify-between transition"
              >
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-amber-950">
                      {kpis.low_stock_ingredients} Low-Stock Ingredient(s)
                    </p>
                    <p className="text-xs text-amber-800">Review pantry levels before prep</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-700" />
              </button>
            )}

            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Top Dishes to Watch
                </p>
                <button
                  onClick={() => onNavigate('feedback')}
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  AI Accuracy →
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
        </div>
      </section>
    </div>
  );
}

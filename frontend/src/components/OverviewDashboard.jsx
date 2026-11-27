import React from 'react';
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
  BrainCircuit,
  HeartHandshake,
  Leaf,
  TrendingDown,
  Wallet,
} from 'lucide-react';

function KpiCard({ icon: Icon, label, value, subtext, tone = 'emerald' }) {
  const toneStyles = {
    emerald: 'bg-emerald-50 text-emerald-700',
    sky: 'bg-sky-50 text-sky-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
  };

  return (
    <div className="card-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${toneStyles[tone]}`}>
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900 stat-value">{value}</p>
      <p className="mt-1.5 text-xs text-slate-500">{subtext}</p>
    </div>
  );
}

export default function OverviewDashboard({ data, onNavigate }) {
  if (!data) {
    return (
      <div className="card-surface p-12 text-center text-sm text-slate-500">
        Loading kitchen analytics and ML diagnostics...
      </div>
    );
  }

  const {
    kpis,
    daily_trend: dailyTrend,
    slot_breakdown: slotBreakdown,
    top_waste_items: topWaste,
    ml_summary: ml,
  } = data;

  const rf = ml?.metrics?.random_forest || {};
  const xgb = ml?.metrics?.xgboost || {};
  const ens = ml?.metrics?.ensemble || {};

  return (
    <div className="space-y-6">
      {/* 1. Primary Impact KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          icon={TrendingDown}
          label="Monthly Waste Prevented"
          value={`${kpis.monthly_waste_prevented_kg.toLocaleString()} kg`}
          subtext={`${kpis.waste_reduction_pct}% reduction vs single-batch prep`}
          tone="emerald"
        />
        <KpiCard
          icon={Wallet}
          label="Projected Monthly Savings"
          value={`₹${Math.round(kpis.monthly_cost_saved_inr).toLocaleString('en-IN')}`}
          subtext={`${kpis.meal_sufficiency_pct}% historical meal sufficiency`}
          tone="sky"
        />
        <KpiCard
          icon={HeartHandshake}
          label="Surplus Meals Rescued"
          value={`${kpis.meals_redistributed.toLocaleString()}`}
          subtext={`${kpis.kg_redistributed} kg across ${kpis.active_ngo_partners} active NGOs`}
          tone="amber"
        />
        <KpiCard
          icon={Leaf}
          label="CO₂ Emissions Avoided"
          value={`${kpis.co2_avoided_kg.toLocaleString()} kg`}
          subtext={`${kpis.eligible_surplus_servings_live} safe surplus servings queued`}
          tone="slate"
        />
      </section>

      {/* 2. Trend & Meal-Slot Comparison Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card-surface p-6 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900">21-Day Demand vs Preparation Trend</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Traditional over-preparation compared against Nourish AI batch targets and actual served meals
              </p>
            </div>
            <button
              onClick={() => onNavigate('planner')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
            >
              Open Batch Planner <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="servFill" x1="0" y1="0" x2="0" y2="1">
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
                  stroke="#d97706"
                  fill="none"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="optimized_batch_target"
                  name="AI Batch Target"
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
                  fill="url(#servFill)"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-surface p-6">
          <div className="mb-5">
            <h3 className="text-sm font-bold text-slate-900">Waste Rate by Meal Slot (%)</h3>
            <p className="text-xs text-slate-500 mt-0.5">Baseline historical waste vs batch-wise AI target</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={slotBreakdown} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="meal_slot" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis unit="%" tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Bar dataKey="waste_pct" name="Baseline %" fill="#cbd5e1" radius={[6, 6, 0, 0]} />
                <Bar dataKey="ai_projected_waste_pct" name="Nourish AI %" fill="#059669" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* 3. Balanced Two-Column Diagnostics & Priority Watchlist */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-surface p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-emerald-700" />
              <h3 className="text-sm font-bold text-slate-900">ML Demand Forecasting Accuracy</h3>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              Trained on {ml?.training_samples || 0} meal records
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase">
                  <th className="py-2 font-semibold">Model</th>
                  <th className="py-2 font-semibold">MAE</th>
                  <th className="py-2 font-semibold">RMSE</th>
                  <th className="py-2 font-semibold">MAPE</th>
                  <th className="py-2 font-semibold text-right">R² Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 stat-value">
                {[
                  { name: 'Adaptive Ensemble', m: ens, primary: true },
                  { name: 'XGBoost Regressor', m: xgb, primary: false },
                  { name: 'Random Forest', m: rf, primary: false },
                ].map((row) => (
                  <tr key={row.name}>
                    <td className="py-3 font-semibold text-slate-800">
                      {row.name}
                      {row.primary && (
                        <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Default
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-slate-600">{row.m.mae ?? '-'}</td>
                    <td className="py-3 text-slate-600">{row.m.rmse ?? '-'}</td>
                    <td className="py-3 text-slate-600">{row.m.mape_pct ?? '-'}%</td>
                    <td className="py-3 text-right font-bold text-emerald-700">{row.m.r2 ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card-surface p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">Overproduction Watchlist</h3>
              <button
                onClick={() => onNavigate('redistribution')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
              >
                Redistribution Queue <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {topWaste.slice(0, 4).map((dish) => (
                <div key={dish.menu_item_id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-slate-800">{dish.name}</p>
                    <p className="text-slate-400">{dish.meal_slot} &bull; {dish.leftover_servings.toLocaleString()} leftover servings</p>
                  </div>
                  <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg stat-value">
                    {dish.waste_kg} kg
                  </span>
                </div>
              ))}
            </div>
          </div>

          {kpis.low_stock_ingredients > 0 && (
            <button
              onClick={() => onNavigate('inventory')}
              className="w-full p-3 rounded-xl bg-amber-50 hover:bg-amber-100/70 border border-amber-200 text-left flex items-center justify-between transition"
            >
              <span className="flex items-center gap-2 text-xs text-amber-900 font-medium">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>{kpis.low_stock_ingredients} ingredient(s)</strong> near reorder level
                </span>
              </span>
              <ArrowRight className="w-4 h-4 text-amber-700" />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

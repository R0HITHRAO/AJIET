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
  ArrowUpRight,
  BrainCircuit,
  Database,
  HeartHandshake,
  Leaf,
  PackageCheck,
  TrendingDown,
  Wallet,
} from 'lucide-react';

function KpiCard({ icon: Icon, label, value, subtext, accent = 'emerald' }) {
  const accentMap = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
  };

  return (
    <div className="card-surface p-5 flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 stat-value">{value}</p>
        </div>
        <div className={`p-2.5 rounded-xl border ${accentMap[accent] || accentMap.emerald}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500 flex items-center gap-1">{subtext}</p>
    </div>
  );
}

export default function OverviewDashboard({ data, onNavigate }) {
  if (!data) {
    return (
      <div className="card-surface p-10 text-center text-slate-500">
        Loading kitchen analytics and ML diagnostics...
      </div>
    );
  }

  const { kpis, daily_trend: dailyTrend, slot_breakdown: slotBreakdown, top_waste_items: topWaste, ml_summary: ml, database } = data;
  const rf = ml?.metrics?.random_forest || {};
  const xgb = ml?.metrics?.xgboost || {};
  const ens = ml?.metrics?.ensemble || {};

  return (
    <div className="space-y-6">
      {/* Top KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          icon={TrendingDown}
          label="Monthly Waste Prevented"
          value={`${kpis.monthly_waste_prevented_kg.toLocaleString()} kg`}
          subtext={`~${kpis.waste_reduction_pct}% reduction vs traditional single-batch prep`}
          accent="emerald"
        />
        <KpiCard
          icon={Wallet}
          label="Projected Monthly Savings"
          value={`₹${Math.round(kpis.monthly_cost_saved_inr).toLocaleString('en-IN')}`}
          subtext={`${kpis.meal_sufficiency_pct}% historical meal sufficiency rate`}
          accent="sky"
        />
        <KpiCard
          icon={HeartHandshake}
          label="Surplus Meals Rescued"
          value={`${kpis.meals_redistributed.toLocaleString()} meals`}
          subtext={`${kpis.kg_redistributed} kg delivered across ${kpis.active_ngo_partners} active NGOs`}
          accent="amber"
        />
        <KpiCard
          icon={Leaf}
          label="CO₂ Emissions Avoided"
          value={`${kpis.co2_avoided_kg.toLocaleString()} kg`}
          subtext={`${kpis.eligible_surplus_servings_live} safe surplus servings queued live`}
          accent="violet"
        />
      </div>

      {/* Quick Action Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => onNavigate('planner')}
          className="card-surface p-4 text-left hover:border-emerald-400 transition group flex items-center justify-between"
        >
          <div>
            <p className="text-sm font-bold text-slate-900">Plan Today&apos;s Meal Batches</p>
            <p className="text-xs text-slate-500 mt-0.5">Run ML forecast + Google OR-Tools initial &amp; reserve sizing</p>
          </div>
          <ArrowUpRight className="w-5 h-5 text-emerald-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
        </button>
        <button
          onClick={() => onNavigate('simulator')}
          className="card-surface p-4 text-left hover:border-emerald-400 transition group flex items-center justify-between"
        >
          <div>
            <p className="text-sm font-bold text-slate-900">Open What-If Kitchen Simulator</p>
            <p className="text-xs text-slate-500 mt-0.5">Stress-test attendance drops, menu swaps &amp; stock shortages</p>
          </div>
          <ArrowUpRight className="w-5 h-5 text-emerald-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
        </button>
        <button
          onClick={() => onNavigate('redistribution')}
          className="card-surface p-4 text-left hover:border-emerald-400 transition group flex items-center justify-between"
        >
          <div>
            <p className="text-sm font-bold text-slate-900">Redistribute {kpis.eligible_surplus_servings_live} Safe Surplus Servings</p>
            <p className="text-xs text-slate-500 mt-0.5">FSSAI safety checks + OR-Tools NGO matching &amp; dispatch</p>
          </div>
          <ArrowUpRight className="w-5 h-5 text-amber-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
        </button>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card-surface p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">21-Day Consumption vs Traditional Prep vs AI Batch Target</h3>
              <p className="text-xs text-slate-500">Gap between traditional over-preparation and actual demand eliminated by batch-wise cooking</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrend} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="prepGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="servGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area
                  type="monotone"
                  dataKey="prepared_servings"
                  name="Traditional Prep (Servings)"
                  stroke="#d97706"
                  fill="url(#prepGrad)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="optimized_batch_target"
                  name="Nourish AI Batch Target"
                  stroke="#0284c7"
                  fill="none"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="served_servings"
                  name="Actual Meals Served"
                  stroke="#059669"
                  fill="url(#servGrad)"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-surface p-5">
          <h3 className="text-base font-bold text-slate-900">Meal Slot Waste Comparison (%)</h3>
          <p className="text-xs text-slate-500 mb-4">Historical baseline waste vs OR-Tools batch-wise projection</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={slotBreakdown} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="meal_slot" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis unit="%" tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="waste_pct" name="Baseline Waste %" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                <Bar dataKey="ai_projected_waste_pct" name="Nourish AI Batch %" fill="#059669" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Diagnostics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ML Engine Metrics */}
        <div className="card-surface p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-emerald-700" />
              <h3 className="text-base font-bold text-slate-900">ML Demand Engine</h3>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
              v{ml?.model_version || 1} &bull; {ml?.training_samples || 0} logs
            </span>
          </div>
          <div className="space-y-2.5 text-sm">
            {[
              { name: 'Adaptive Ensemble', m: ens, badge: 'Active Default' },
              { name: 'XGBoost Regressor', m: xgb, badge: `${Math.round((ml?.weights?.xgboost || 0.55) * 100)}% wt` },
              { name: 'Random Forest', m: rf, badge: `${Math.round((ml?.weights?.random_forest || 0.45) * 100)}% wt` },
            ].map((row) => (
              <div key={row.name} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">{row.name}</p>
                  <p className="text-xs text-slate-500">
                    MAE: {row.m.mae ?? '-'} serv &bull; MAPE: {row.m.mape_pct ?? '-'}%
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    R² {row.m.r2 ?? '-'}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-1">{row.badge}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* High-Waste Dishes Watchlist */}
        <div className="card-surface p-5">
          <div className="flex items-center gap-2 mb-3">
            <PackageCheck className="w-5 h-5 text-amber-600" />
            <h3 className="text-base font-bold text-slate-900">Top Historical Overproduction Dishes</h3>
          </div>
          <div className="space-y-2.5">
            {topWaste.map((dish) => (
              <div key={dish.menu_item_id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{dish.name}</p>
                  <p className="text-xs text-slate-500">{dish.meal_slot} &bull; {dish.leftover_servings.toLocaleString()} leftover servings</p>
                </div>
                <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full stat-value">
                  {dish.waste_kg} kg
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* System & Inventory Health */}
        <div className="card-surface p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-5 h-5 text-sky-700" />
              <h3 className="text-base font-bold text-slate-900">Architecture &amp; Readiness</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <p className="text-xs text-slate-500 uppercase font-semibold">Persistence Layer</p>
                <p className="font-semibold text-slate-900 mt-0.5">{database?.label}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <p className="text-xs text-slate-500 uppercase font-semibold">Optimization Engine</p>
                <p className="font-semibold text-slate-900 mt-0.5">Google OR-Tools MILP (SCIP/CBC)</p>
                <p className="text-xs text-slate-500">Dual batch-prep &amp; NGO multi-lot assignment</p>
              </div>
              {kpis.low_stock_ingredients > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-900">
                    <strong>{kpis.low_stock_ingredients} ingredient(s)</strong> near reorder threshold. Check Inventory or run What-If Simulator.
                  </p>
                </div>
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-4">
            SMVITM Bantakal Institutional Kitchen Prototype &bull; Team Codeverse
          </p>
        </div>
      </div>
    </div>
  );
}

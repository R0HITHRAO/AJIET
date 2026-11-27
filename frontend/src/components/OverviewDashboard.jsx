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

  const { kpis, daily_trend: dailyTrend, slot_breakdown: slotBreakdown, top_waste_items: topWaste, ml_summary: ml, forecast_error_review: errorReview, database } = data;
  const rf = ml?.metrics?.random_forest || {};
  const xgb = ml?.metrics?.xgboost || {};
  const ens = ml?.metrics?.ensemble || {};
  const baseline = ml?.metrics?.baseline || {};
  const validation = ml?.metrics?.validation || {};
  const selectedModel = validation.selected_model || 'baseline';
  const latestErrorWeek = errorReview?.weekly?.[errorReview.weekly.length - 1];

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
              { key: 'ensemble', name: 'Adaptive Ensemble', m: ens, badge: 'Ensemble' },
              { key: 'xgboost', name: 'XGBoost Regressor', m: xgb, badge: `${Math.round((ml?.weights?.xgboost || 0.55) * 100)}% wt` },
              { key: 'random_forest', name: 'Random Forest', m: rf, badge: `${Math.round((ml?.weights?.random_forest || 0.45) * 100)}% wt` },
            ].map((row) => (
              <div key={row.name} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">{row.name}</p>
                  <p className="text-xs text-slate-500">
                    MAE: {row.m.mae ?? '-'} serv &bull; WAPE: {row.m.wape_pct ?? '-'}% &bull; MAPE: {row.m.mape_pct ?? '-'}%
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${selectedModel === row.key ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-slate-600 bg-white border border-slate-200'}`}>
                    {selectedModel === row.key ? 'Selected' : `${validation.fold_wins?.[row.key] ?? 0}/${validation.fold_count ?? 0} folds`}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-1">{row.badge}</p>
                </div>
              </div>
            ))}
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800">Dish + weekday baseline</p>
                <p className="text-xs text-slate-600">MAE: {baseline.mae ?? '-'} serv &bull; WAPE: {baseline.wape_pct ?? '-'}% &bull; MAPE: {baseline.mape_pct ?? '-'}%</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${selectedModel === 'baseline' ? 'text-amber-800 bg-white border border-amber-300' : 'text-slate-600 bg-white border border-slate-200'}`}>
                {selectedModel === 'baseline' ? 'Forecast fallback' : 'Reference'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Expanding validation across {validation.fold_count ?? 0} future-date folds. ML selection requires lower pooled MAE and wins in at least {validation.required_fold_wins ?? 0} folds.
            </p>
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

      <section className="card-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Weekly Forecast Error Review</h3>
            <p className="text-xs text-slate-500">Prediction-linked meal records from the latest {errorReview?.weeks_included?.length || 0} weeks</p>
          </div>
          <div className="flex gap-5 text-sm">
            <div><span className="text-slate-500">Tracked</span><strong className="ml-2 text-slate-900">{errorReview?.tracked_records ?? 0}</strong></div>
            <div><span className="text-slate-500">Latest week MAE</span><strong className="ml-2 text-slate-900">{latestErrorWeek?.mae ?? '-'} serv</strong></div>
            <div><span className="text-slate-500">WAPE</span><strong className="ml-2 text-slate-900">{latestErrorWeek?.wape_pct ?? '-'}%</strong></div>
          </div>
        </div>
        {errorReview?.tracked_records ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {[['Meal slot', errorReview.by_meal_slot || []], ['Dish', errorReview.by_dish || []]].map(([title, rows]) => (
              <div key={title} className="min-w-0">
                <h4 className="text-sm font-semibold text-slate-800 mb-2">Errors by {title.toLowerCase()}</h4>
                <div className="max-h-72 overflow-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-sm text-left">
                    <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
                      <tr><th className="px-3 py-2 font-semibold">{title}</th><th className="px-3 py-2 font-semibold">Records</th><th className="px-3 py-2 font-semibold">MAE</th><th className="px-3 py-2 font-semibold">WAPE</th></tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.group} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-800">{row.group}</td><td className="px-3 py-2 text-slate-600">{row.samples}</td><td className="px-3 py-2 text-slate-600">{row.mae} serv</td><td className="px-3 py-2 text-slate-600">{row.wape_pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="border-t border-slate-100 pt-4 text-sm text-slate-500">No prediction-linked meal records are available for this review window.</p>
        )}
      </section>
    </div>
  );
}

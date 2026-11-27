import React, { useEffect, useState } from 'react';
import {
  BrainCircuit,
  ChefHat,
  ClipboardCheck,
  Database,
  FlaskConical,
  LayoutDashboard,
  Package,
  RotateCcw,
  Sprout,
  Truck,
} from 'lucide-react';
import { api } from './api';
import OverviewDashboard from './components/OverviewDashboard';
import ForecastBatchPlanner from './components/ForecastBatchPlanner';
import WhatIfSimulator from './components/WhatIfSimulator';
import PostMealFeedback from './components/PostMealFeedback';
import RedistributionHub from './components/RedistributionHub';
import InventoryData from './components/InventoryData';

const TABS = [
  { id: 'overview', label: 'Overview & Impact', icon: LayoutDashboard },
  { id: 'planner', label: 'Forecast & Batch Plan', icon: ChefHat },
  { id: 'simulator', label: 'What-If Simulator', icon: FlaskConical },
  { id: 'feedback', label: 'Post-Meal & ML Retrain', icon: ClipboardCheck },
  { id: 'redistribution', label: 'Surplus & NGO Hub', icon: Truck },
  { id: 'inventory', label: 'Inventory & Logs', icon: Package },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [health, setHealth] = useState(null);
  const [overview, setOverview] = useState(null);
  const [resetting, setResetting] = useState(false);

  const refreshGlobal = async () => {
    try {
      const [hRes, oRes] = await Promise.all([api.health(), api.dashboardOverview()]);
      setHealth(hRes);
      setOverview(oRes);
    } catch {
      // handled gracefully via empty state
    }
  };

  useEffect(() => {
    refreshGlobal();
  }, []);

  const handleResetDemo = async () => {
    setResetting(true);
    try {
      await api.resetDemo();
      await refreshGlobal();
    } finally {
      setResetting(false);
    }
  };

  const liveSurplusCount = overview?.kpis?.eligible_surplus_servings_live || 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f7f5]">
      {/* Top Command Header */}
      <header className="sticky top-0 z-30 bg-emerald-950 text-white border-b border-emerald-900/80 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
              <Sprout className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">NOURISH AI</h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                  Team Codeverse &bull; Sankalp&apos;26
                </span>
              </div>
              <p className="text-xs text-emerald-200/80">
                {health?.kitchen?.name || 'SMVITM Central Hostel & Canteen Kitchen'} &bull;{' '}
                {health?.kitchen?.location || 'Bantakal, Udupi'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {health?.ml_engine && (
              <span className="px-2.5 py-1 rounded-full bg-emerald-900/90 border border-emerald-700/80 text-emerald-100 flex items-center gap-1.5">
                <BrainCircuit className="w-3.5 h-3.5 text-emerald-300" />
                ML v{health.ml_engine.model_version} (R² {health.ml_engine.metrics?.ensemble?.r2 ?? '-'})
              </span>
            )}
            {health?.database && (
              <span className="px-2.5 py-1 rounded-full bg-emerald-900/90 border border-emerald-700/80 text-emerald-100 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-sky-300" />
                {health.database.mode === 'mongodb' ? 'MongoDB' : 'Mongo-Compatible Store'}
              </span>
            )}
            <button
              onClick={handleResetDemo}
              disabled={resetting}
              title="Reset demo data & retrain models"
              className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold flex items-center gap-1 transition"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
              Reset Demo
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto pb-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap flex items-center gap-2 transition ${
                  active
                    ? 'bg-white text-emerald-950 shadow-sm'
                    : 'text-emerald-100/85 hover:bg-emerald-900/70 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.id === 'redistribution' && liveSurplusCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-white">
                    {liveSurplusCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'overview' && <OverviewDashboard data={overview} onNavigate={setActiveTab} />}
        {activeTab === 'planner' && <ForecastBatchPlanner />}
        {activeTab === 'simulator' && <WhatIfSimulator />}
        {activeTab === 'feedback' && <PostMealFeedback onDataUpdated={refreshGlobal} />}
        {activeTab === 'redistribution' && (
          <RedistributionHub kitchenInfo={health?.kitchen} onDataUpdated={refreshGlobal} />
        )}
        {activeTab === 'inventory' && <InventoryData onDataUpdated={refreshGlobal} />}
      </main>
    </div>
  );
}

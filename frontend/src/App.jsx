import React, { useEffect, useState } from 'react';
import {
  ChefHat,
  ClipboardCheck,
  FlaskConical,
  Home,
  Menu,
  Package,
  RotateCcw,
  Sprout,
  Truck,
  X,
} from 'lucide-react';
import { api } from './api';
import OverviewDashboard from './components/OverviewDashboard';
import ForecastBatchPlanner from './components/ForecastBatchPlanner';
import WhatIfSimulator from './components/WhatIfSimulator';
import PostMealFeedback from './components/PostMealFeedback';
import RedistributionHub from './components/RedistributionHub';
import InventoryData from './components/InventoryData';

const NAV_ITEMS = [
  { id: 'overview', label: 'Home', icon: Home },
  { id: 'planner', label: 'Meal Planner', icon: ChefHat },
  { id: 'simulator', label: 'Simulator', icon: FlaskConical },
  { id: 'redistribution', label: 'Surplus & NGOs', icon: Truck },
  { id: 'feedback', label: 'Log & AI', icon: ClipboardCheck },
  { id: 'inventory', label: 'Inventory', icon: Package },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [preferredSlot, setPreferredSlot] = useState('Lunch');
  const [health, setHealth] = useState(null);
  const [overview, setOverview] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const openPlannerForSlot = (slot) => {
    if (slot) setPreferredSlot(slot);
    setActiveTab('planner');
  };

  const liveSurplusCount = overview?.kpis?.eligible_surplus_servings_live || 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f8f7]">
      {/* Modern Sticky Top Web Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <button
            onClick={() => setActiveTab('overview')}
            className="flex items-center gap-2.5 text-left shrink-0"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white flex items-center justify-center shadow-sm">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-slate-900 block leading-none">
                Nourish AI
              </span>
              <span className="text-[11px] font-medium text-slate-500">Smart Kitchen Platform</span>
            </div>
          </button>

          {/* Desktop Navigation Pills */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/60">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    active
                      ? 'bg-white text-emerald-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? 'text-emerald-700' : 'text-slate-400'}`} />
                  {item.label}
                  {item.id === 'redistribution' && liveSurplusCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-white leading-none">
                      {liveSurplusCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Live Status & Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-xs font-semibold text-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              SMVITM Kitchen
            </div>
            <button
              onClick={handleResetDemo}
              disabled={resetting}
              title="Reset demo dataset"
              className="h-9 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold inline-flex items-center gap-1.5 transition"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Reset</span>
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 grid grid-cols-2 gap-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                    active ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-50 text-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-7">
        {activeTab === 'overview' && (
          <OverviewDashboard
            data={overview}
            onNavigate={setActiveTab}
            onSelectSlot={openPlannerForSlot}
          />
        )}
        {activeTab === 'planner' && <ForecastBatchPlanner initialSlot={preferredSlot} onDataUpdated={refreshGlobal} />}
        {activeTab === 'simulator' && <WhatIfSimulator />}
        {activeTab === 'redistribution' && (
          <RedistributionHub kitchenInfo={health?.kitchen} onDataUpdated={refreshGlobal} />
        )}
        {activeTab === 'feedback' && <PostMealFeedback overviewData={overview} onDataUpdated={refreshGlobal} />}
        {activeTab === 'inventory' && <InventoryData onDataUpdated={refreshGlobal} />}
      </main>

      {/* Clean Product Footer */}
      <footer className="border-t border-slate-200/80 bg-white/70 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            <strong className="text-slate-700">Nourish AI</strong> &bull; Team Codeverse (SMVITM Bantakal, Udupi) &bull; Sankalp&apos;26
          </span>
          <span>
            Powered by Scikit-learn, XGBoost, Google OR-Tools &amp;{' '}
            {health?.database?.mode === 'mongodb' ? 'MongoDB' : 'Mongo-Compatible Store'}
          </span>
        </div>
      </footer>
    </div>
  );
}

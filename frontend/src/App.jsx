import React, { useEffect, useState } from 'react';
import {
  BrainCircuit,
  ChefHat,
  ClipboardCheck,
  Database,
  FlaskConical,
  LayoutDashboard,
  Menu,
  Package,
  RefreshCw,
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

const NAV_GROUPS = [
  {
    title: 'Analytics',
    items: [
      {
        id: 'overview',
        label: 'Executive Overview',
        subtitle: 'Kitchen waste reduction, savings, and system diagnostics',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: 'Daily Kitchen Workflow',
    items: [
      {
        id: 'planner',
        label: '1. Forecast & Batch Plan',
        subtitle: 'ML demand forecast paired with Google OR-Tools two-stage batch sizing',
        icon: ChefHat,
      },
      {
        id: 'simulator',
        label: '2. What-If Simulator',
        subtitle: 'Stress-test attendance shifts, menu swaps, and ingredient shortages',
        icon: FlaskConical,
      },
      {
        id: 'feedback',
        label: '3. Post-Meal & Retrain',
        subtitle: 'Log served meals, auto-detect surplus, and retrain ML models',
        icon: ClipboardCheck,
      },
      {
        id: 'redistribution',
        label: '4. Surplus & NGO Hub',
        subtitle: 'FSSAI food-safety screening, OR-Tools NGO matching, and dispatch',
        icon: Truck,
      },
    ],
  },
  {
    title: 'Kitchen Operations',
    items: [
      {
        id: 'inventory',
        label: 'Inventory & Logs',
        subtitle: 'Manage live ingredient stock and inspect historical meal records',
        icon: Package,
      },
    ],
  },
];

const ALL_TABS = NAV_GROUPS.flatMap((g) => g.items);

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [health, setHealth] = useState(null);
  const [overview, setOverview] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const refreshGlobal = async () => {
    setRefreshing(true);
    try {
      const [hRes, oRes] = await Promise.all([api.health(), api.dashboardOverview()]);
      setHealth(hRes);
      setOverview(oRes);
    } catch {
      // handled gracefully via empty state
    } finally {
      setRefreshing(false);
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

  const currentTab = ALL_TABS.find((t) => t.id === activeTab) || ALL_TABS[0];
  const liveSurplusCount = overview?.kpis?.eligible_surplus_servings_live || 0;

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-slate-200/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-sm">
            <Sprout className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-slate-900 leading-none">NOURISH AI</h1>
            <p className="text-[11px] font-medium text-slate-500 mt-1">Team Codeverse &bull; Sankalp&apos;26</p>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Ordered Navigation Groups */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {group.title}
            </p>
            <div className="space-y-1">
              {group.items.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between transition ${
                      active
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border border-transparent'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-emerald-700' : 'text-slate-400'}`} />
                      <span className="truncate">{tab.label}</span>
                    </span>
                    {tab.id === 'redistribution' && liveSurplusCount > 0 && (
                      <span className="ml-2 px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800">
                        {liveSurplusCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Compact System Diagnostics Footer */}
      <div className="p-4 border-t border-slate-200/80 bg-slate-50/70 space-y-2.5">
        <div className="text-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-600">
            <span className="flex items-center gap-1.5 font-medium">
              <BrainCircuit className="w-3.5 h-3.5 text-emerald-700" />
              ML Ensemble
            </span>
            <span className="font-bold text-slate-900 stat-value">
              v{health?.ml_engine?.model_version ?? 1} &bull; R² {health?.ml_engine?.metrics?.ensemble?.r2 ?? '-'}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span className="flex items-center gap-1.5 font-medium">
              <Database className="w-3.5 h-3.5 text-sky-700" />
              Storage
            </span>
            <span className="font-semibold text-slate-800">
              {health?.database?.mode === 'mongodb' ? 'MongoDB' : 'Mongo-Store'}
            </span>
          </div>
        </div>
        <button
          onClick={handleResetDemo}
          disabled={resetting}
          className="w-full h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
          {resetting ? 'Resetting...' : 'Reset Demo Data'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#f8fafc]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 bg-white border-r border-slate-200/90 sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-72 bg-white h-full shadow-xl border-r border-slate-200">
            <SidebarContent />
          </div>
          <div className="flex-1 bg-slate-900/40" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean Contextual Top Bar */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">{currentTab.label}</h2>
                <p className="text-xs text-slate-500 truncate">{currentTab.subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <span className="hidden md:inline-flex items-center px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold">
                {health?.kitchen?.name || 'SMVITM Kitchen'} &bull; Bantakal
              </span>
              <button
                onClick={refreshGlobal}
                disabled={refreshing}
                className="btn-secondary h-9 px-3 text-xs"
                title="Refresh metrics"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main View Canvas */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6">
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
    </div>
  );
}

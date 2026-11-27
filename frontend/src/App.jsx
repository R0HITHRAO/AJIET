import React, { useEffect, useState } from 'react';
import {
  ChefHat,
  ClipboardCheck,
  FlaskConical,
  Home,
  LogIn,
  LogOut,
  Menu,
  Package,
  RotateCcw,
  Sprout,
  Truck,
  User,
  X,
} from 'lucide-react';
import { api } from './api';
import OverviewDashboard from './components/OverviewDashboard';
import ForecastBatchPlanner from './components/ForecastBatchPlanner';
import WhatIfSimulator from './components/WhatIfSimulator';
import PostMealFeedback from './components/PostMealFeedback';
import RedistributionHub from './components/RedistributionHub';
import InventoryData from './components/InventoryData';
import AuthModal from './components/AuthModal';

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
  const [feedbackSubTab, setFeedbackSubTab] = useState('log');
  const [inventoryNav, setInventoryNav] = useState({ subTab: 'inventory', filter: 'all', nonce: 0 });
  const [health, setHealth] = useState(null);
  const [overview, setOverview] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('nourish_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

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
    const token = localStorage.getItem('nourish_auth_token');
    if (token) {
      api
        .me(token)
        .then((res) => {
          setCurrentUser(res.user);
          localStorage.setItem('nourish_auth_user', JSON.stringify(res.user));
        })
        .catch(() => {
          localStorage.removeItem('nourish_auth_token');
          localStorage.removeItem('nourish_auth_user');
          setCurrentUser(null);
        });
    }
  }, []);

  const handleAuthSuccess = (token, user) => {
    localStorage.setItem('nourish_auth_token', token);
    localStorage.setItem('nourish_auth_user', JSON.stringify(user));
    setCurrentUser(user);
  };

  const handleSignOut = () => {
    localStorage.removeItem('nourish_auth_token');
    localStorage.removeItem('nourish_auth_user');
    setCurrentUser(null);
  };

  const handleResetDemo = async () => {
    setResetting(true);
    try {
      await api.resetDemo();
      await refreshGlobal();
    } finally {
      setResetting(false);
    }
  };

  const navigateTo = (tab, opts = {}) => {
    if (tab === 'feedback') {
      setFeedbackSubTab(opts.subTab || 'log');
    } else if (tab === 'inventory') {
      setInventoryNav((prev) => ({
        subTab: opts.subTab || 'inventory',
        filter: opts.filter || 'all',
        nonce: prev.nonce + 1,
      }));
    }
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const openPlannerForSlot = (slot) => {
    if (slot) setPreferredSlot(slot);
    setActiveTab('planner');
  };

  const liveSurplusCount = overview?.kpis?.eligible_surplus_servings_live || 0;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Executive Glass Navigation Bar */}
      <header className="no-print sticky top-0 z-40 bg-white/85 backdrop-blur-lg border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <button
            onClick={() => setActiveTab('overview')}
            className="flex items-center gap-3 text-left shrink-0 group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-900 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display text-base font-extrabold tracking-tight text-slate-900 leading-none">
                  Nourish AI
                </span>
                <span className="hidden xl:inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  Live
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-500 block mt-0.5">
                Smart Kitchen &amp; Redistribution
              </span>
            </div>
          </button>

          {/* Desktop Navigation Pills */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/70">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => navigateTo(item.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all duration-150 ${
                    active
                      ? 'bg-white text-emerald-900 shadow-sm ring-1 ring-slate-200/70'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? 'text-emerald-700' : 'text-slate-400'}`} />
                  {item.label}
                  {item.id === 'redistribution' && liveSurplusCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-white leading-none stat-value">
                      {liveSurplusCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Auth & System Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 pl-2 pr-3 py-1 rounded-full bg-emerald-50/90 border border-emerald-200/80 text-xs font-semibold text-emerald-950">
                  <span className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[11px] font-bold">
                    {currentUser.name?.[0]?.toUpperCase() || <User className="w-3 h-3" />}
                  </span>
                  <span className="max-w-[110px] truncate">{currentUser.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white text-emerald-700 border border-emerald-200/80">
                    {currentUser.role}
                  </span>
                </div>
                <button
                  onClick={handleSignOut}
                  title="Sign out"
                  className="h-9 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold inline-flex items-center gap-1.5 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setAuthModalMode('login');
                    setAuthModalOpen(true);
                  }}
                  className="h-9 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition"
                >
                  <LogIn className="w-3.5 h-3.5 text-emerald-700" />
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setAuthModalMode('register');
                    setAuthModalOpen(true);
                  }}
                  className="hidden sm:inline-flex h-9 px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold items-center shadow-sm transition"
                >
                  Register
                </button>
              </div>
            )}

            <button
              onClick={handleResetDemo}
              disabled={resetting}
              title="Reset demo dataset"
              className="h-9 w-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 inline-flex items-center justify-center transition"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
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
                  onClick={() => navigateTo(item.id)}
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

      {/* Main Content Canvas with Smooth View Transition */}
      <main key={activeTab} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-7 animate-fade-up">
        {activeTab === 'overview' && (
          <OverviewDashboard
            data={overview}
            onNavigate={navigateTo}
            onSelectSlot={openPlannerForSlot}
          />
        )}
        {activeTab === 'planner' && <ForecastBatchPlanner initialSlot={preferredSlot} onDataUpdated={refreshGlobal} />}
        {activeTab === 'simulator' && <WhatIfSimulator />}
        {activeTab === 'redistribution' && (
          <RedistributionHub kitchenInfo={health?.kitchen} onDataUpdated={refreshGlobal} />
        )}
        {activeTab === 'feedback' && (
          <PostMealFeedback
            overviewData={overview}
            initialSubTab={feedbackSubTab}
            onDataUpdated={refreshGlobal}
          />
        )}
        {activeTab === 'inventory' && (
          <InventoryData
            initialSubTab={inventoryNav.subTab}
            initialFilter={inventoryNav.filter}
            navNonce={inventoryNav.nonce}
            onSelectSlot={openPlannerForSlot}
            onDataUpdated={refreshGlobal}
          />
        )}
      </main>

      {/* Clean Editorial Footer */}
      <footer className="no-print border-t border-slate-200/80 bg-white/80 backdrop-blur-sm mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>
              <strong className="text-slate-800 font-semibold">Nourish AI</strong> &bull; Team Codeverse (SMVITM Bantakal, Udupi) &bull; Sankalp&apos;26
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span>ML v{health?.ml_engine?.model_version ?? 1}</span>
            <span>&bull;</span>
            <span>Google OR-Tools</span>
            <span>&bull;</span>
            <span>{health?.database?.mode === 'mongodb' ? 'MongoDB' : 'Mongo-Compatible Store'}</span>
          </div>
        </div>
      </footer>

      <AuthModal
        key={authModalMode + String(authModalOpen)}
        isOpen={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}

import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import {
  BellRing,
  ChefHat,
  ClipboardCheck,
  FlaskConical,
  HeartHandshake,
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
import AuthModal from './components/AuthModal';
import KitchenAlertsPanel from './components/KitchenAlertsPanel';

const OverviewDashboard = lazy(() => import('./components/OverviewDashboard'));
const ForecastBatchPlanner = lazy(() => import('./components/ForecastBatchPlanner'));
const WhatIfSimulator = lazy(() => import('./components/WhatIfSimulator'));
const PostMealFeedback = lazy(() => import('./components/PostMealFeedback'));
const RedistributionHub = lazy(() => import('./components/RedistributionHub'));
const InventoryData = lazy(() => import('./components/InventoryData'));
const ChefWorkspace = lazy(() => import('./components/ChefWorkspace'));
const NgoCoordinatorWorkspace = lazy(() => import('./components/NgoCoordinatorWorkspace'));

function TabSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-36 rounded-3xl bg-slate-200/80" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="h-28 rounded-2xl bg-slate-200/70" />
        ))}
      </div>
      <div className="h-72 rounded-2xl bg-slate-200/60" />
    </div>
  );
}

const MANAGER_NAV_ITEMS = [
  { id: 'overview', label: 'Home', icon: Home },
  { id: 'planner', label: 'Meal Planner', icon: ChefHat },
  { id: 'simulator', label: 'Simulator', icon: FlaskConical },
  { id: 'redistribution', label: 'Surplus & NGOs', icon: Truck },
  { id: 'feedback', label: 'Log & AI', icon: ClipboardCheck },
  { id: 'inventory', label: 'Inventory', icon: Package },
];

const CHEF_NAV_ITEMS = [
  { id: 'chef_prep', label: 'Prep Display', icon: ChefHat },
  { id: 'chef_handover', label: 'Leftover Handover', icon: ClipboardCheck },
];

const NGO_NAV_ITEMS = [
  { id: 'ngo_queue', label: 'Rescue Queue', icon: HeartHandshake },
  { id: 'ngo_pickups', label: 'Active Pickups', icon: Truck },
  { id: 'ngo_partners', label: 'NGO Hubs', icon: Package },
];

const roleToWorkspace = (role) => {
  if (role === 'Chef') return 'chef';
  if (role === 'NGO Coordinator') return 'ngo';
  return 'manager';
};

const defaultTabForWorkspace = (mode) => {
  if (mode === 'chef') return 'chef_prep';
  if (mode === 'ngo') return 'ngo_queue';
  return 'overview';
};

export default function App() {
  const [workspaceMode, setWorkspaceMode] = useState('manager');
  const [activeTab, setActiveTab] = useState('overview');
  const [preferredSlot, setPreferredSlot] = useState('Lunch');
  const [feedbackSubTab, setFeedbackSubTab] = useState('log');
  const [inventoryNav, setInventoryNav] = useState({ subTab: 'inventory', filter: 'all', nonce: 0 });
  const [health, setHealth] = useState(null);
  const [overview, setOverview] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [kitchenAlerts, setKitchenAlerts] = useState([]);
  const [alertsPanelOpen, setAlertsPanelOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(() => Boolean(localStorage.getItem('nourish_auth_token')));

  const refreshInFlightRef = useRef(false);

  const refreshAlerts = useCallback(async (signal) => {
    if (!currentUser?.verified || currentUser?.role === 'NGO Coordinator') return;
    if (refreshInFlightRef.current && !signal) return;
    refreshInFlightRef.current = true;
    try {
      const res = await api.getKitchenAlerts(signal ? { signal } : {});
      if (!signal?.aborted) setKitchenAlerts(res.alerts || []);
    } catch {
      // ignore transient abort
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [currentUser]);

  const refreshGlobal = useCallback(async () => {
    try {
      const [hRes, oRes] = await Promise.all([api.health(), api.dashboardOverview()]);
      setHealth(hRes);
      setOverview(oRes);
      await refreshAlerts();
    } catch {
      // handled gracefully via empty state or unauthorized handler
    }
  }, [refreshAlerts]);

  useEffect(() => {
    if (!currentUser?.verified || currentUser?.role === 'NGO Coordinator') {
      setKitchenAlerts([]);
      return undefined;
    }
    const controller = new AbortController();
    refreshAlerts(controller.signal);
    const interval = setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) {
        refreshAlerts(controller.signal);
      }
    }, 15000);
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [currentUser, refreshAlerts]);

  useEffect(() => {
    const token = localStorage.getItem('nourish_auth_token');
    if (!token) {
      setAuthChecking(false);
      return undefined;
    }
    api
      .me(token)
      .then((res) => {
        if (res.user?.verified) {
          const nextWorkspace = roleToWorkspace(res.user.role);
          setWorkspaceMode(nextWorkspace);
          setActiveTab(defaultTabForWorkspace(nextWorkspace));
          setCurrentUser(res.user);
          localStorage.setItem('nourish_auth_user', JSON.stringify(res.user));
        } else {
          localStorage.removeItem('nourish_auth_token');
          localStorage.removeItem('nourish_auth_user');
          setCurrentUser(null);
        }
      })
      .catch(() => {
        localStorage.removeItem('nourish_auth_token');
        localStorage.removeItem('nourish_auth_user');
        setCurrentUser(null);
      })
      .finally(() => setAuthChecking(false));
    return undefined;
  }, []);

  useEffect(() => {
    if (currentUser?.verified) {
      refreshGlobal();
    } else {
      setOverview(null);
    }
  }, [currentUser, refreshGlobal]);

  useEffect(() => {
    const onUnauthorized = () => {
      localStorage.removeItem('nourish_auth_token');
      localStorage.removeItem('nourish_auth_user');
      setCurrentUser(null);
    };
    window.addEventListener('nourish:unauthorized', onUnauthorized);
    return () => window.removeEventListener('nourish:unauthorized', onUnauthorized);
  }, []);

  const handleAuthSuccess = (token, user) => {
    localStorage.setItem('nourish_auth_token', token);
    localStorage.setItem('nourish_auth_user', JSON.stringify(user));
    const nextWorkspace = roleToWorkspace(user?.role);
    setWorkspaceMode(nextWorkspace);
    setActiveTab(defaultTabForWorkspace(nextWorkspace));
    setCurrentUser(user);
  };

  const handleSignOut = () => {
    localStorage.removeItem('nourish_auth_token');
    localStorage.removeItem('nourish_auth_user');
    setCurrentUser(null);
  };

  const handleResetDemo = useCallback(async () => {
    setResetting(true);
    try {
      await api.resetDemo();
      await refreshGlobal();
    } catch {
      // handled gracefully via refresh / next action
    } finally {
      setResetting(false);
    }
  }, [refreshGlobal]);

  const navigateTo = useCallback((tab, opts = {}) => {
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
  }, []);

  const openPlannerForSlot = useCallback((slot) => {
    if (slot) setPreferredSlot(slot);
    setActiveTab('planner');
  }, []);

  const isManagerOrAdmin = currentUser?.role === 'Kitchen Manager' || currentUser?.role === 'Admin';
  const effectiveWorkspace = isManagerOrAdmin ? workspaceMode : roleToWorkspace(currentUser?.role);
  const currentNavItems =
    effectiveWorkspace === 'chef'
      ? CHEF_NAV_ITEMS
      : effectiveWorkspace === 'ngo'
      ? NGO_NAV_ITEMS
      : MANAGER_NAV_ITEMS;

  const switchWorkspace = useCallback(
    (mode) => {
      if (!isManagerOrAdmin) return;
      setWorkspaceMode(mode);
      setActiveTab(defaultTabForWorkspace(mode));
      setMobileMenuOpen(false);
    },
    [isManagerOrAdmin]
  );

  const liveSurplusCount = overview?.kpis?.eligible_surplus_servings_live || 0;

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center hero-mesh">
        <div className="text-center space-y-2.5">
          <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/15 text-teal-200 flex items-center justify-center mx-auto animate-pulse">
            <Sprout className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-slate-300">Verifying Nourish AI session...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <AuthModal
          locked
          isOpen
          initialMode={authModalMode}
          onClose={() => {}}
          onAuthSuccess={handleAuthSuccess}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      {/* Executive Glass Navigation Bar */}
      <header className="no-print sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-slate-200/70 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-5 h-16 flex items-center justify-between gap-2">
          {/* Brand */}
          <button
            onClick={() => navigateTo(defaultTabForWorkspace(effectiveWorkspace))}
            className="flex items-center gap-2.5 text-left shrink-0 group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-900 via-teal-700 to-teal-500 text-white flex items-center justify-center shadow-[0_4px_12px_-2px_rgba(13,148,136,0.4)] group-hover:scale-105 transition-transform">
              <Sprout className="w-5 h-5" />
            </div>
            <div className="whitespace-nowrap">
              <span className="font-display text-base font-extrabold tracking-tight text-slate-900 leading-none block">
                Nourish AI
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-700 block mt-0.5">
                {effectiveWorkspace === 'chef' ? 'Chef KDS' : effectiveWorkspace === 'ngo' ? 'NGO Hub' : 'Kitchen Ops'}
              </span>
            </div>
          </button>

          {/* Desktop Navigation Pills */}
          <nav className="hidden lg:flex items-center gap-0.5 bg-slate-100/85 backdrop-blur-sm p-1 rounded-2xl border border-slate-200/75 shadow-[inset_0_1px_1px_rgba(15,23,42,0.03)] shrink-0">
            {currentNavItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => navigateTo(item.id)}
                  className={`px-2.5 xl:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all duration-150 ${
                    active
                      ? 'bg-white text-slate-950 shadow-[0_1px_3px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/5'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-teal-700' : 'text-slate-400'}`} />
                  {item.label}
                  {(item.id === 'redistribution' || item.id === 'ngo_queue') && liveSurplusCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-white leading-none stat-value">
                      {liveSurplusCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Auth & System Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isManagerOrAdmin && (
              <div
                title="Switch portal view for live role demo"
                className="hidden sm:inline-flex items-center p-0.5 rounded-xl bg-slate-100 border border-slate-200/80 text-[11px] font-semibold shrink-0"
              >
                {[
                  { id: 'manager', label: 'Manager' },
                  { id: 'chef', label: 'Chef' },
                  { id: 'ngo', label: 'NGO' },
                ].map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => switchWorkspace(w.id)}
                    className={`px-2 py-1 rounded-lg whitespace-nowrap transition ${
                      effectiveWorkspace === w.id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            )}
            {currentUser ? (
              <div className="flex items-center gap-1.5">
                <div
                  title={`${currentUser.name} (${currentUser.role})`}
                  className="hidden xl:flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full bg-teal-50/90 border border-teal-200/80 text-xs font-semibold text-slate-900 whitespace-nowrap"
                >
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                    {currentUser.name?.[0]?.toUpperCase() || <User className="w-3 h-3" />}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white text-teal-700 border border-teal-200/80">
                    {currentUser.role}
                  </span>
                </div>
                {isManagerOrAdmin && (() => {
                  const pendingAlerts = kitchenAlerts.filter((a) => a.status === 'Pending Manager').length;
                  const activeAlerts = kitchenAlerts.filter((a) => a.status !== 'Resolved').length;
                  return (
                    <button
                      type="button"
                      onClick={() => setAlertsPanelOpen(true)}
                      title="Live Chef dish-shortage notifications"
                      className={`h-9 px-2.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition ${
                        pendingAlerts > 0
                          ? 'border-amber-300 bg-amber-50 text-amber-900 shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <BellRing className={`w-3.5 h-3.5 ${pendingAlerts > 0 ? 'text-amber-600 animate-pulse' : 'text-slate-400'}`} />
                      {(pendingAlerts > 0 || activeAlerts > 0) && (
                        <span
                          className={`px-1.5 py-0.5 text-[10px] rounded-full text-white leading-none stat-value ${
                            pendingAlerts > 0 ? 'bg-amber-600' : 'bg-teal-600'
                          }`}
                        >
                          {pendingAlerts > 0 ? pendingAlerts : activeAlerts}
                        </span>
                      )}
                    </button>
                  );
                })()}
                <button
                  onClick={handleSignOut}
                  title="Sign out"
                  aria-label="Sign out"
                  className="hidden sm:inline-flex h-9 w-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 items-center justify-center shrink-0 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
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
                  <LogIn className="w-3.5 h-3.5 text-teal-700" />
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setAuthModalMode('register');
                    setAuthModalOpen(true);
                  }}
                  className="hidden sm:inline-flex h-9 px-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold items-center shadow-sm transition"
                >
                  Register
                </button>
              </div>
            )}

            {isManagerOrAdmin && (
              <button
                onClick={handleResetDemo}
                disabled={resetting}
                title="Reset demo dataset"
                className="hidden sm:inline-flex h-9 w-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 items-center justify-center shrink-0 transition"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 shrink-0"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-2.5">
            {isManagerOrAdmin && (
              <div className="flex sm:hidden items-center gap-1 p-1 rounded-xl bg-slate-100 text-xs font-semibold">
                {[
                  { id: 'manager', label: 'Manager' },
                  { id: 'chef', label: 'Chef' },
                  { id: 'ngo', label: 'NGO' },
                ].map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => switchWorkspace(w.id)}
                    className={`flex-1 py-1.5 rounded-lg transition ${
                      effectiveWorkspace === w.id ? 'bg-slate-900 text-white' : 'text-slate-600'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {currentNavItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigateTo(item.id)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                      active ? 'bg-teal-50 text-teal-800 border border-teal-200' : 'bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
            {currentUser && (
              <div className="sm:hidden pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 truncate">
                  {currentUser.name} ({currentUser.role})
                </span>
                <div className="flex items-center gap-2">
                  {isManagerOrAdmin && (
                    <button
                      onClick={handleResetDemo}
                      disabled={resetting}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white font-semibold"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Content Canvas with Lazy-Loaded Role-Based Views */}
      <main
        key={effectiveWorkspace === 'manager' ? activeTab : effectiveWorkspace}
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-7 animate-fade-up"
      >
        <Suspense fallback={<TabSkeleton />}>
          {effectiveWorkspace === 'chef' && (
            <ChefWorkspace
              initialTab={activeTab === 'chef_handover' ? 'handover' : 'prep'}
              currentUser={currentUser}
              alerts={kitchenAlerts}
              onRefreshAlerts={refreshAlerts}
              onDataUpdated={refreshGlobal}
            />
          )}

          {effectiveWorkspace === 'ngo' && (
            <NgoCoordinatorWorkspace
              initialTab={
                activeTab === 'ngo_pickups' ? 'pickups' : activeTab === 'ngo_partners' ? 'partners' : 'queue'
              }
              currentUser={currentUser}
              kitchenInfo={health?.kitchen}
              onDataUpdated={refreshGlobal}
            />
          )}

          {effectiveWorkspace === 'manager' && (
            <>
              {activeTab === 'overview' && (
                <OverviewDashboard
                  data={overview}
                  pendingAlertsCount={kitchenAlerts.filter((a) => a.status === 'Pending Manager').length}
                  onNavigate={navigateTo}
                  onSelectSlot={openPlannerForSlot}
                  onOpenKitchenAlerts={() => setAlertsPanelOpen(true)}
                />
              )}
              {activeTab === 'planner' && (
                <ForecastBatchPlanner initialSlot={preferredSlot} onDataUpdated={refreshGlobal} />
              )}
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
            </>
          )}
        </Suspense>
      </main>

      {/* Clean Editorial Footer */}
      <footer className="no-print border-t border-slate-200/80 bg-white/80 backdrop-blur-sm mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-500" />
            <span>
              <strong className="text-slate-800 font-semibold">Nourish AI</strong> &bull; Institutional Kitchen &amp;
              Surplus Redistribution Platform
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

      <KitchenAlertsPanel
        isOpen={alertsPanelOpen}
        alerts={kitchenAlerts}
        onClose={() => setAlertsPanelOpen(false)}
        onUpdated={refreshGlobal}
      />

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

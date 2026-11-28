const BASE = '/api';
const PUBLIC_PREFIXES = ['/health', '/auth/login', '/auth/register', '/auth/forgot-password', '/auth/verify-otp', '/auth/reset-password', '/auth/email-status'];

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = localStorage.getItem('nourish_auth_token');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const err = await res.json();
      message = err.detail || err.message || message;
    } catch {
      // ignore non-json error body
    }
    const isPublic = PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix));
    if ((res.status === 401 || res.status === 403) && !isPublic) {
      window.dispatchEvent(new CustomEvent('nourish:unauthorized'));
    }
    throw new Error(message);
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

export const api = {
  health: (opts = {}) => request('/health', opts),
  dashboardOverview: (opts = {}) => request('/dashboard/overview', opts),
  getMenu: (mealSlot, opts = {}) => request(`/menu${mealSlot ? `?meal_slot=${encodeURIComponent(mealSlot)}` : ''}`, opts),
  createMenuItem: (payload) =>
    request('/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  deleteMenuItem: (menuItemId, removeHistory = true, retrain = true) =>
    request(
      `/menu/${encodeURIComponent(menuItemId)}?remove_history=${removeHistory ? 'true' : 'false'}&retrain=${retrain ? 'true' : 'false'}`,
      { method: 'DELETE' }
    ),
  getIngredients: (opts = {}) => request('/ingredients', opts),
  updateIngredient: (id, stockQty) =>
    request(`/ingredients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock_qty: Number(stockQty) }),
    }),
  forecast: (payload, { signal } = {}) =>
    request('/forecast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    }),
  optimizeBatch: (payload, save = false, { signal } = {}) =>
    request(`/optimize-batch?save=${save ? 'true' : 'false'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    }),
  simulate: (payload, { signal } = {}) =>
    request('/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    }),
  getMealLogs: (limitOrOpts = 80, mealSlot = '', fetchOpts = {}) => {
    const limit = typeof limitOrOpts === 'object' && limitOrOpts !== null ? (limitOrOpts.limit ?? 80) : limitOrOpts;
    const slot = typeof limitOrOpts === 'object' && limitOrOpts !== null ? (limitOrOpts.mealSlot ?? '') : mealSlot;
    return request(`/meal-logs?limit=${limit}${slot ? `&meal_slot=${encodeURIComponent(slot)}` : ''}`, fetchOpts);
  },
  submitPostMealLog: (payload) =>
    request('/meal-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  importMealLogsCsv: (file, retrain = true) => {
    const fd = new FormData();
    fd.append('file', file);
    return request(`/meal-logs/import-csv?retrain=${retrain ? 'true' : 'false'}`, {
      method: 'POST',
      body: fd,
    });
  },
  retrainModels: () => request('/models/retrain', { method: 'POST' }),
  getModelRuns: (opts = {}) => request('/models/runs', opts),
  getSurplus: (opts = {}) => request('/surplus', opts),
  createSurplus: (payload) =>
    request('/surplus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  getNgos: (opts = {}) => request('/ngos', opts),
  createNgo: (payload) =>
    request('/ngos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  toggleNgoAvailability: (ngoId, isAvailable) =>
    request(`/ngos/${ngoId}/availability?is_available=${isAvailable ? 'true' : 'false'}`, {
      method: 'PATCH',
    }),
  getRedistributions: (opts = {}) => request('/redistributions', opts),
  getKitchenAlerts: (opts = {}) => request('/kitchen-alerts', opts),
  createKitchenAlert: (payload) =>
    request('/kitchen-alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  respondKitchenAlert: (alertId, payload) =>
    request(`/kitchen-alerts/${encodeURIComponent(alertId)}/respond`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  resolveKitchenAlert: (alertId) =>
    request(`/kitchen-alerts/${encodeURIComponent(alertId)}/resolve`, { method: 'PATCH' }),
  dispatchRedistribution: (payload) =>
    request('/redistributions/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  updateRedistributionStatus: (id, status) =>
    request(`/redistributions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }),
  resetDemo: () => request('/admin/reset-demo', { method: 'POST' }),
  register: (payload) =>
    request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  login: (payload) =>
    request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  me: (token) =>
    request('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    }),
  forgotPassword: (email) =>
    request('/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }),
  emailStatus: () => request('/auth/email-status'),
  configureEmail: (payload) =>
    request('/auth/email-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  downloadSampleCsv: () => request('/meal-logs/sample-csv'),
  verifyOtp: (email, otp) =>
    request('/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    }),
  resetPassword: (payload) =>
    request('/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
};

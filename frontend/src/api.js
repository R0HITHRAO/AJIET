const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const err = await res.json();
      message = err.detail || err.message || message;
    } catch {
      // ignore non-json error body
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
  health: () => request('/health'),
  dashboardOverview: () => request('/dashboard/overview'),
  getMenu: (mealSlot) => request(`/menu${mealSlot ? `?meal_slot=${encodeURIComponent(mealSlot)}` : ''}`),
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
  getIngredients: () => request('/ingredients'),
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
  getMealLogs: (limitOrOpts = 80, mealSlot = '') => {
    const limit = typeof limitOrOpts === 'object' && limitOrOpts !== null ? (limitOrOpts.limit ?? 80) : limitOrOpts;
    const slot = typeof limitOrOpts === 'object' && limitOrOpts !== null ? (limitOrOpts.mealSlot ?? '') : mealSlot;
    return request(`/meal-logs?limit=${limit}${slot ? `&meal_slot=${encodeURIComponent(slot)}` : ''}`);
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
  getModelRuns: () => request('/models/runs'),
  getSurplus: () => request('/surplus'),
  createSurplus: (payload) =>
    request('/surplus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  getNgos: () => request('/ngos'),
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
  getRedistributions: () => request('/redistributions'),
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

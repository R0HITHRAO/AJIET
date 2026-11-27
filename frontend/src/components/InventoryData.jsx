import React, { useEffect, useState } from 'react';
import { CheckCircle2, Package, Save, Search, Trash2, UtensilsCrossed } from 'lucide-react';
import { api } from '../api';

export default function InventoryData({ onDataUpdated }) {
  const [subTab, setSubTab] = useState('inventory');
  const [query, setQuery] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [logs, setLogs] = useState([]);
  const [editing, setEditing] = useState({});
  const [savedId, setSavedId] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');

  const loadData = async () => {
    const [ingRes, menuRes, logRes] = await Promise.all([
      api.getIngredients(),
      api.getMenu(),
      api.getMealLogs(60),
    ]);
    setIngredients(ingRes.items || []);
    setMenuItems(menuRes.items || []);
    setLogs(logRes.logs || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveStock = async (ing) => {
    const val = editing[ing.ingredient_id] ?? ing.stock_qty;
    await api.updateIngredient(ing.ingredient_id, Number(val));
    setSavedId(ing.ingredient_id);
    await loadData();
    onDataUpdated?.();
    setTimeout(() => setSavedId(''), 1800);
  };

  const handleDeleteDish = async (item) => {
    setDeletingId(item.menu_item_id);
    setStatusMsg('');
    try {
      const res = await api.deleteMenuItem(item.menu_item_id, true, true);
      setConfirmDeleteId(null);
      setStatusMsg(
        `Removed "${item.name}" and deleted ${res.removed_logs_count} historical meal record(s).`
      );
      await loadData();
      onDataUpdated?.();
    } finally {
      setDeletingId(null);
    }
  };

  const q = query.trim().toLowerCase();
  const filteredIngredients = ingredients.filter((i) => i.name.toLowerCase().includes(q));
  const filteredMenu = menuItems.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      m.meal_slot.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q)
  );
  const filteredLogs = logs.filter(
    (l) =>
      l.menu_item_name.toLowerCase().includes(q) ||
      l.meal_slot.toLowerCase().includes(q) ||
      l.date.includes(q)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-xl bg-slate-200/70">
          <button
            onClick={() => setSubTab('inventory')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
              subTab === 'inventory' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pantry Stock ({ingredients.length})
          </button>
          <button
            onClick={() => setSubTab('menu')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
              subTab === 'menu' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Menu Dishes ({menuItems.length})
          </button>
          <button
            onClick={() => setSubTab('logs')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
              subTab === 'logs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Meal Logs ({logs.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={
              subTab === 'inventory'
                ? 'Search ingredients...'
                : subTab === 'menu'
                ? 'Search dishes or slot...'
                : 'Search dish or date...'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="field-control pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {statusMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          {statusMsg}
        </div>
      )}

      {/* Visual Card Grid for Pantry Stock */}
      {subTab === 'inventory' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIngredients.map((ing) => {
            const isLow = ing.stock_qty <= ing.reorder_level * 1.2;
            const ratio = Math.min(100, Math.round((ing.stock_qty / Math.max(ing.reorder_level * 3, 1)) * 100));
            return (
              <div key={ing.ingredient_id} className="card-surface p-5 space-y-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        isLow ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      <Package className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{ing.name}</h3>
                      <p className="text-[11px] text-slate-400">
                        ₹{ing.unit_cost}/{ing.unit} &bull; {ing.perishability_days}d shelf life
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                      isLow
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {isLow ? 'Low Stock' : 'Healthy'}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isLow ? 'bg-amber-500' : 'bg-emerald-600'}`}
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">Reorder alert below {ing.reorder_level} {ing.unit}</p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={editing[ing.ingredient_id] ?? ing.stock_qty}
                      onChange={(e) => setEditing({ ...editing, [ing.ingredient_id]: e.target.value })}
                      className="w-24 h-9 rounded-xl border border-slate-200 px-2.5 text-sm font-semibold stat-value"
                    />
                    <span className="text-xs text-slate-500 font-medium">{ing.unit}</span>
                  </div>
                  <button onClick={() => saveStock(ing)} className="btn-secondary h-9 px-3 text-xs">
                    <Save className="w-3.5 h-3.5" />
                    {savedId === ing.ingredient_id ? 'Saved' : 'Save'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Menu Dishes Manager (Remove dish + clear its history) */}
      {subTab === 'menu' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMenu.map((item) => {
            const isConfirming = confirmDeleteId === item.menu_item_id;
            return (
              <div key={item.menu_item_id} className="card-surface p-5 space-y-3.5 flex flex-col justify-between">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                      <UtensilsCrossed className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{item.name}</h3>
                      <p className="text-[11px] text-slate-500">
                        {item.meal_slot} &bull; {item.category}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {item.batch_size} serv/batch
                  </span>
                </div>

                <div className="text-xs text-slate-500 flex items-center justify-between">
                  <span>Cost: ₹{item.cost_per_serving}/serv</span>
                  <span>Uptake: {Math.round(item.uptake_rate * 100)}%</span>
                </div>

                {isConfirming ? (
                  <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between gap-2 text-xs">
                    <span className="text-red-900 font-medium">Remove dish &amp; history?</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={deletingId === item.menu_item_id}
                        onClick={() => handleDeleteDish(item)}
                        className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold"
                      >
                        {deletingId === item.menu_item_id ? 'Removing...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(item.menu_item_id)}
                    className="w-full h-9 rounded-xl border border-slate-200 hover:border-red-300 hover:bg-red-50 text-slate-600 hover:text-red-700 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove Dish &amp; History
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {subTab === 'logs' && (
        <div className="card-surface p-6 overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] text-slate-400 uppercase">
                <th className="py-2.5">Date</th>
                <th className="py-2.5">Meal</th>
                <th className="py-2.5">Dish</th>
                <th className="py-2.5">Attendance (Exp/Act)</th>
                <th className="py-2.5">Prepared</th>
                <th className="py-2.5">Served</th>
                <th className="py-2.5">Leftover</th>
                <th className="py-2.5 text-right">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((l) => (
                <tr key={l.log_id}>
                  <td className="py-2.5 stat-value">{l.date}</td>
                  <td className="py-2.5">{l.meal_slot}</td>
                  <td className="py-2.5 font-semibold text-slate-800">{l.menu_item_name}</td>
                  <td className="py-2.5 stat-value text-slate-500">
                    {l.expected_attendance} / {l.actual_attendance}
                  </td>
                  <td className="py-2.5 stat-value">{l.prepared_servings}</td>
                  <td className="py-2.5 stat-value text-emerald-700 font-semibold">{l.served_servings}</td>
                  <td className="py-2.5 stat-value text-amber-700 font-semibold">{l.leftover_servings}</td>
                  <td className="py-2.5 text-right text-slate-400">{l.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

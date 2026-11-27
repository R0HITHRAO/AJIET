import React, { useEffect, useState } from 'react';
import { CheckCircle2, Package, Plus, Save, Search, Trash2, UtensilsCrossed } from 'lucide-react';
import { api } from '../api';

export default function InventoryData({
  initialSubTab = 'inventory',
  initialFilter = 'all',
  navNonce = 0,
  onSelectSlot,
  onDataUpdated,
}) {
  const [subTab, setSubTab] = useState(initialSubTab);
  const [pantryFilter, setPantryFilter] = useState(initialFilter);
  const [query, setQuery] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [logs, setLogs] = useState([]);
  const [editing, setEditing] = useState({});
  const [savedId, setSavedId] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [showAddDish, setShowAddDish] = useState(false);
  const [newDish, setNewDish] = useState({
    name: '',
    meal_slot: 'Lunch',
    category: 'Custom Special',
    batch_size: 35,
    cost_per_serving: 26,
    uptake_rate: 0.78,
    requires_cold_chain: false,
    primary_ing: 'ing_rice',
    primary_qty: 0.10,
    secondary_ing: 'ing_mixed_veg',
    secondary_qty: 0.06,
  });
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    setSubTab(initialSubTab || 'inventory');
    setPantryFilter(initialFilter || 'all');
  }, [initialSubTab, initialFilter, navNonce]);

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

  const handleCreateDish = async (e) => {
    e.preventDefault();
    if (!newDish.name.trim()) return;
    setStatusMsg('');
    const recipe = {};
    if (newDish.primary_ing && Number(newDish.primary_qty) > 0) {
      recipe[newDish.primary_ing] = Number(newDish.primary_qty);
    }
    if (newDish.secondary_ing && Number(newDish.secondary_qty) > 0) {
      recipe[newDish.secondary_ing] = Number(newDish.secondary_qty);
    }
    const res = await api.createMenuItem({
      name: newDish.name,
      meal_slot: newDish.meal_slot,
      category: newDish.category,
      batch_size: Number(newDish.batch_size),
      cost_per_serving: Number(newDish.cost_per_serving),
      uptake_rate: Number(newDish.uptake_rate),
      requires_cold_chain: newDish.requires_cold_chain,
      recipe,
    });
    setShowAddDish(false);
    setNewDish({ ...newDish, name: '' });
    setStatusMsg(`Added "${res.item.name}" to ${res.item.meal_slot} menu.`);
    await loadData();
    onDataUpdated?.();
  };

  const q = query.trim().toLowerCase();
  const lowCount = ingredients.filter((i) => i.stock_qty <= i.reorder_level * 1.2).length;
  const perishableCount = ingredients.filter((i) => i.perishability_days <= 3).length;
  const filteredIngredients = ingredients.filter((i) => {
    if (!i.name.toLowerCase().includes(q)) return false;
    if (pantryFilter === 'low_stock') return i.stock_qty <= i.reorder_level * 1.2;
    if (pantryFilter === 'perishable') return i.perishability_days <= 3;
    return true;
  });
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
        <div className="segmented-track">
          <button
            onClick={() => setSubTab('inventory')}
            className={`segmented-pill ${
              subTab === 'inventory' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pantry Stock ({ingredients.length})
          </button>
          <button
            onClick={() => setSubTab('menu')}
            className={`segmented-pill ${
              subTab === 'menu' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Menu Dishes ({menuItems.length})
          </button>
          <button
            onClick={() => setSubTab('logs')}
            className={`segmented-pill ${
              subTab === 'logs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Meal Logs ({logs.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
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
          {subTab === 'menu' && (
            <button onClick={() => setShowAddDish(!showAddDish)} className="btn-primary h-9 px-3.5 text-xs">
              <Plus className="w-3.5 h-3.5" />
              Add Custom Dish
            </button>
          )}
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
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: `All Ingredients (${ingredients.length})` },
              { id: 'low_stock', label: `Low Stock (${lowCount})` },
              { id: 'perishable', label: `Use Soon ≤3d (${perishableCount})` },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setPantryFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                  pantryFilter === f.id
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredIngredients.map((ing) => {
            const isLow = ing.stock_qty <= ing.reorder_level * 1.2;
            const isPerishable = ing.perishability_days <= 3;
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
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                        isLow
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {isLow ? 'Low Stock' : 'Healthy'}
                    </span>
                    {isPerishable && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                        Use Soon ({ing.perishability_days}d)
                      </span>
                    )}
                  </div>
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
        </div>
      )}

      {/* Menu Dishes Manager */}
      {subTab === 'menu' && (
        <div className="space-y-5">
          {showAddDish && (
            <form onSubmit={handleCreateDish} className="card-surface p-6 space-y-4 border-emerald-300">
              <p className="text-sm font-bold text-slate-900">Add Custom Dish to Institutional Menu</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="col-span-2">
                  <label className="field-label">Dish Name</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g., Bisibele Bath"
                    value={newDish.name}
                    onChange={(e) => setNewDish({ ...newDish, name: e.target.value })}
                    className="field-control"
                  />
                </div>
                <div>
                  <label className="field-label">Meal Slot</label>
                  <select
                    value={newDish.meal_slot}
                    onChange={(e) => setNewDish({ ...newDish, meal_slot: e.target.value })}
                    className="field-control"
                  >
                    {['Breakfast', 'Lunch', 'Snacks', 'Dinner'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Batch Size</label>
                  <input
                    type="number"
                    min="5"
                    value={newDish.batch_size}
                    onChange={(e) => setNewDish({ ...newDish, batch_size: Number(e.target.value) })}
                    className="field-control stat-value"
                  />
                </div>
                <div>
                  <label className="field-label">Cost / Serv (₹)</label>
                  <input
                    type="number"
                    min="5"
                    value={newDish.cost_per_serving}
                    onChange={(e) => setNewDish({ ...newDish, cost_per_serving: Number(e.target.value) })}
                    className="field-control stat-value"
                  />
                </div>
                <div>
                  <label className="field-label">Expected Uptake</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    max="1.0"
                    value={newDish.uptake_rate}
                    onChange={(e) => setNewDish({ ...newDish, uptake_rate: Number(e.target.value) })}
                    className="field-control stat-value"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div>
                  <label className="field-label">Key Ingredient 1</label>
                  <select
                    value={newDish.primary_ing}
                    onChange={(e) => setNewDish({ ...newDish, primary_ing: e.target.value })}
                    className="field-control text-xs"
                  >
                    {ingredients.map((i) => (
                      <option key={i.ingredient_id} value={i.ingredient_id}>{i.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Qty / Serving</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newDish.primary_qty}
                    onChange={(e) => setNewDish({ ...newDish, primary_qty: Number(e.target.value) })}
                    className="field-control stat-value"
                  />
                </div>
                <div>
                  <label className="field-label">Key Ingredient 2</label>
                  <select
                    value={newDish.secondary_ing}
                    onChange={(e) => setNewDish({ ...newDish, secondary_ing: e.target.value })}
                    className="field-control text-xs"
                  >
                    {ingredients.map((i) => (
                      <option key={i.ingredient_id} value={i.ingredient_id}>{i.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Qty / Serving</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newDish.secondary_qty}
                    onChange={(e) => setNewDish({ ...newDish, secondary_qty: Number(e.target.value) })}
                    className="field-control stat-value"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newDish.requires_cold_chain}
                    onChange={(e) => setNewDish({ ...newDish, requires_cold_chain: e.target.checked })}
                    className="rounded accent-emerald-700"
                  />
                  Requires Cold-Chain Transport if Redistributed
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowAddDish(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Save Dish to Menu
                  </button>
                </div>
              </div>
            </form>
          )}

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

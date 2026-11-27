import React, { useEffect, useState } from 'react';
import { Save, Search } from 'lucide-react';
import { api } from '../api';

export default function InventoryData({ onDataUpdated }) {
  const [subTab, setSubTab] = useState('inventory');
  const [query, setQuery] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [logs, setLogs] = useState([]);
  const [editing, setEditing] = useState({});
  const [savedId, setSavedId] = useState('');

  const loadData = async () => {
    const [ingRes, logRes] = await Promise.all([api.getIngredients(), api.getMealLogs(60)]);
    setIngredients(ingRes.items || []);
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

  const q = query.trim().toLowerCase();
  const filteredIngredients = ingredients.filter((i) => i.name.toLowerCase().includes(q));
  const filteredLogs = logs.filter(
    (l) =>
      l.menu_item_name.toLowerCase().includes(q) ||
      l.meal_slot.toLowerCase().includes(q) ||
      l.date.includes(q)
  );

  return (
    <div className="space-y-6">
      {/* Clean Segmented Sub-Tab & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-xl bg-slate-200/70">
          <button
            onClick={() => setSubTab('inventory')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
              subTab === 'inventory' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ingredient Inventory ({ingredients.length})
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
            placeholder={subTab === 'inventory' ? 'Filter ingredients...' : 'Search logs by dish or date...'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="field-control pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {subTab === 'inventory' && (
        <div className="card-surface p-6 overflow-x-auto">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Live Kitchen Ingredient Stock</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Stock updates constrain Google OR-Tools batch optimization immediately
            </p>
          </div>

          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] text-slate-400 uppercase">
                <th className="py-2.5">Ingredient</th>
                <th className="py-2.5">Status</th>
                <th className="py-2.5">Stock Quantity</th>
                <th className="py-2.5">Reorder Level</th>
                <th className="py-2.5">Unit Cost</th>
                <th className="py-2.5">Shelf Life</th>
                <th className="py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredIngredients.map((ing) => {
                const isLow = ing.stock_qty <= ing.reorder_level * 1.2;
                return (
                  <tr key={ing.ingredient_id}>
                    <td className="py-3 font-semibold text-slate-900">{ing.name}</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold ${
                          isLow
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {isLow ? 'Low Stock' : 'Healthy'}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={editing[ing.ingredient_id] ?? ing.stock_qty}
                          onChange={(e) => setEditing({ ...editing, [ing.ingredient_id]: e.target.value })}
                          className="w-24 h-8 rounded-lg border border-slate-200 px-2.5 stat-value"
                        />
                        <span className="text-slate-500">{ing.unit}</span>
                      </div>
                    </td>
                    <td className="py-3 text-slate-500 stat-value">
                      {ing.reorder_level} {ing.unit}
                    </td>
                    <td className="py-3 stat-value">
                      ₹{ing.unit_cost}/{ing.unit}
                    </td>
                    <td className="py-3 text-slate-500">{ing.perishability_days} days</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => saveStock(ing)}
                        className="btn-secondary h-8 px-3 text-xs"
                      >
                        <Save className="w-3 h-3" />
                        {savedId === ing.ingredient_id ? 'Saved' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {subTab === 'logs' && (
        <div className="card-surface p-6 overflow-x-auto">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Historical Consumption &amp; Leftover Logs</h3>
            <p className="text-xs text-slate-500 mt-0.5">Training records used by Random Forest &amp; XGBoost</p>
          </div>
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

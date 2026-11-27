import React, { useEffect, useState } from 'react';
import { Package, Save, ScrollText } from 'lucide-react';
import { api } from '../api';

export default function InventoryData({ onDataUpdated }) {
  const [ingredients, setIngredients] = useState([]);
  const [logs, setLogs] = useState([]);
  const [editing, setEditing] = useState({});
  const [savedId, setSavedId] = useState('');

  const loadData = async () => {
    const [ingRes, logRes] = await Promise.all([api.getIngredients(), api.getMealLogs(40)]);
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

  return (
    <div className="space-y-6">
      <div className="card-surface p-5 overflow-x-auto">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-700" />
            Live Kitchen Ingredient Inventory
          </h2>
          <p className="text-xs text-slate-500">
            Edit available stock quantities—changes immediately constrain Google OR-Tools batch optimization
          </p>
        </div>

        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 uppercase">
              <th className="py-2">Ingredient</th>
              <th className="py-2">Current Stock</th>
              <th className="py-2">Reorder Level</th>
              <th className="py-2">Unit Cost</th>
              <th className="py-2">Shelf Life</th>
              <th className="py-2 text-right">Update</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ingredients.map((ing) => {
              const isLow = ing.stock_qty <= ing.reorder_level * 1.2;
              return (
                <tr key={ing.ingredient_id}>
                  <td className="py-2.5 font-semibold text-slate-900">{ing.name}</td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={editing[ing.ingredient_id] ?? ing.stock_qty}
                        onChange={(e) =>
                          setEditing({ ...editing, [ing.ingredient_id]: e.target.value })
                        }
                        className={`w-24 rounded-lg border px-2.5 py-1 stat-value ${
                          isLow ? 'border-amber-400 bg-amber-50' : 'border-slate-300'
                        }`}
                      />
                      <span className="text-slate-500">{ing.unit}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-slate-500 stat-value">{ing.reorder_level} {ing.unit}</td>
                  <td className="py-2.5 stat-value">₹{ing.unit_cost}/{ing.unit}</td>
                  <td className="py-2.5 text-slate-500">{ing.perishability_days} days</td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => saveStock(ing)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-900 hover:bg-emerald-700 text-white font-semibold transition"
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

      <div className="card-surface p-5 overflow-x-auto">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-3">
          <ScrollText className="w-4 h-4 text-sky-700" />
          Recent Kitchen Consumption &amp; Leftover Records
        </h3>
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 uppercase">
              <th className="py-2">Date</th>
              <th className="py-2">Meal</th>
              <th className="py-2">Menu Item</th>
              <th className="py-2">Attendance (Exp/Act)</th>
              <th className="py-2">Prepared</th>
              <th className="py-2">Served</th>
              <th className="py-2">Leftover</th>
              <th className="py-2">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((l) => (
              <tr key={l.log_id}>
                <td className="py-2 stat-value">{l.date}</td>
                <td className="py-2">{l.meal_slot}</td>
                <td className="py-2 font-semibold text-slate-800">{l.menu_item_name}</td>
                <td className="py-2 stat-value text-slate-500">{l.expected_attendance} / {l.actual_attendance}</td>
                <td className="py-2 stat-value">{l.prepared_servings}</td>
                <td className="py-2 stat-value text-emerald-700 font-semibold">{l.served_servings}</td>
                <td className="py-2 stat-value text-amber-700 font-semibold">{l.leftover_servings}</td>
                <td className="py-2 text-slate-400">{l.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

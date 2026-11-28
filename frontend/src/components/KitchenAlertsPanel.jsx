import React, { useState } from 'react';
import { BellRing, CheckCircle2, Clock, Send, Users, X } from 'lucide-react';
import { api } from '../api';

export default function KitchenAlertsPanel({ isOpen, alerts = [], onClose, onUpdated }) {
  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const activeAlerts = alerts.filter((a) => a.status !== 'Resolved');

  const getDraft = (alert) =>
    drafts[alert.alert_id] || {
      remaining_customers: Math.max(20, alert.batch_size || 50),
      decision: 'Prepare Additional Batch',
      batches_requested: 1,
      manager_note: '',
    };

  const setDraftField = (alertId, field, value, baseAlert) => {
    setDrafts((prev) => ({
      ...prev,
      [alertId]: { ...(prev[alertId] || getDraft(baseAlert)), [field]: value },
    }));
  };

  const handleRespond = async (alert) => {
    const draft = getDraft(alert);
    setBusyId(alert.alert_id);
    setError('');
    try {
      await api.respondKitchenAlert(alert.alert_id, {
        remaining_customers: Number(draft.remaining_customers),
        decision: draft.decision,
        batches_requested: draft.decision === 'Hold Counter (No More Batches)' ? 0 : Number(draft.batches_requested),
        manager_note: draft.manager_note,
      });
      await onUpdated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  };

  const handleResolve = async (alertId) => {
    setBusyId(alertId);
    setError('');
    try {
      await api.resolveKitchenAlert(alertId);
      await onUpdated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="animate-modal-in my-auto bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="hero-mesh text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-300/30 flex items-center justify-center">
              <BellRing className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h3 className="font-display text-base font-extrabold">Live Chef Dish-Shortage Alerts</h3>
              <p className="text-[11px] text-slate-300">
                Notify the Chef with remaining customer turnout to prevent mid-service stockouts
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          {activeAlerts.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-teal-600 mx-auto" />
              <p className="text-sm font-bold text-slate-800">No active dish-shortage alerts from the kitchen</p>
              <p className="text-xs text-slate-500">
                When the Chef flags a dish running low or out of stock, it will appear here immediately.
              </p>
            </div>
          ) : (
            activeAlerts.map((alert) => {
              const draft = getDraft(alert);
              const isPending = alert.status === 'Pending Manager';
              return (
                <div
                  key={alert.alert_id}
                  className={`p-4 rounded-2xl border space-y-3 ${
                    isPending ? 'bg-amber-50/55 border-amber-300' : 'bg-teal-50/45 border-teal-200'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{alert.menu_item_name}</span>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                            alert.alert_level === 'Out of Stock'
                              ? 'bg-red-100 text-red-800 border-red-200'
                              : 'bg-amber-100 text-amber-800 border-amber-200'
                          }`}
                        >
                          {alert.alert_level} &bull; {alert.remaining_servings} serv left
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        <span>{alert.meal_slot}</span>
                        <span>&bull;</span>
                        <span>Reported by {alert.reported_by}</span>
                        <span>&bull;</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {alert.created_at?.slice(11, 16) || 'Now'}
                        </span>
                      </p>
                      {alert.note && <p className="text-xs text-slate-700 mt-1 italic">&ldquo;{alert.note}&rdquo;</p>}
                    </div>

                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        isPending ? 'bg-amber-600 text-white' : 'bg-teal-700 text-white'
                      }`}
                    >
                      {isPending ? 'Needs Customer Count' : 'Chef Notified'}
                    </span>
                  </div>

                  {isPending ? (
                    <div className="pt-3 border-t border-amber-200/80 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                      <div className="sm:col-span-3">
                        <label className="field-label flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          Customers Left
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="5000"
                          value={draft.remaining_customers}
                          onChange={(e) => setDraftField(alert.alert_id, 'remaining_customers', e.target.value, alert)}
                          className="field-control h-9 text-xs font-bold stat-value"
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <label className="field-label">Decision</label>
                        <select
                          value={draft.decision}
                          onChange={(e) => setDraftField(alert.alert_id, 'decision', e.target.value, alert)}
                          className="field-control h-9 text-xs"
                        >
                          <option value="Prepare Additional Batch">Prepare Additional Batch</option>
                          <option value="Hold Counter (No More Batches)">Hold Counter (No More Batches)</option>
                          <option value="Switch to Standby Alternate">Switch to Standby Alternate</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="field-label">Batches</label>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          disabled={draft.decision === 'Hold Counter (No More Batches)'}
                          value={draft.decision === 'Hold Counter (No More Batches)' ? 0 : draft.batches_requested}
                          onChange={(e) => setDraftField(alert.alert_id, 'batches_requested', e.target.value, alert)}
                          className="field-control h-9 text-xs stat-value"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <button
                          type="button"
                          disabled={busyId === alert.alert_id}
                          onClick={() => handleRespond(alert)}
                          className="btn-primary h-9 w-full text-xs"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {busyId === alert.alert_id ? 'Sending...' : 'Notify Chef'}
                        </button>
                      </div>
                      <div className="sm:col-span-12">
                        <input
                          type="text"
                          placeholder="Optional note to Chef (e.g., Queue still active near hostel gate)"
                          value={draft.manager_note}
                          onChange={(e) => setDraftField(alert.alert_id, 'manager_note', e.target.value, alert)}
                          className="field-control h-9 text-xs"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2.5 border-t border-teal-200/70 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-slate-700">
                        Sent to Chef: <strong className="text-slate-950">{alert.remaining_customers} customers waiting</strong>{' '}
                        &rarr; <strong>{alert.decision}</strong>
                        {alert.batches_requested > 0 ? ` (${alert.batches_requested} batch)` : ''}
                        {alert.manager_note ? ` — "${alert.manager_note}"` : ''}
                      </span>
                      <button
                        type="button"
                        disabled={busyId === alert.alert_id}
                        onClick={() => handleResolve(alert.alert_id)}
                        className="text-teal-700 font-semibold hover:underline"
                      >
                        Mark Resolved
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

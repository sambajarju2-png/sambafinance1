'use client';

import { useState, useEffect } from 'react';
import {
  Home, Zap, Droplets, Shield, Heart, Smartphone, Wifi, Repeat, Car, ShoppingCart,
  MoreHorizontal, Plus, Loader2, Trash2, Pencil, X, Check, CircleDot
} from 'lucide-react';
import { formatCents } from '@/lib/bills';

interface Expense {
  id: string;
  name: string;
  category: string;
  amount: number;
  interval: string;
  monthly_amount: number;
  payment_day: number | null;
  iban: string | null;
  is_active: boolean;
  last_paid_month: string | null;
}

const CATEGORY_CONFIG: Record<string, { icon: typeof Home; label: string; color: string }> = {
  huur: { icon: Home, label: 'Huur', color: 'text-blue-600' },
  energie: { icon: Zap, label: 'Energie', color: 'text-amber-500' },
  water: { icon: Droplets, label: 'Water', color: 'text-cyan-500' },
  verzekering: { icon: Shield, label: 'Verzekering', color: 'text-purple-500' },
  zorgverzekering: { icon: Heart, label: 'Zorgverzekering', color: 'text-red-500' },
  telecom: { icon: Smartphone, label: 'Telecom', color: 'text-green-600' },
  internet: { icon: Wifi, label: 'Internet', color: 'text-indigo-500' },
  abonnement: { icon: Repeat, label: 'Abonnement', color: 'text-pink-500' },
  vervoer: { icon: Car, label: 'Vervoer', color: 'text-orange-500' },
  boodschappen: { icon: ShoppingCart, label: 'Boodschappen', color: 'text-emerald-500' },
  overig: { icon: CircleDot, label: 'Overig', color: 'text-gray-500' },
};

const INTERVAL_LABELS: Record<string, string> = {
  weekly: 'per week',
  monthly: 'per maand',
  quarterly: 'per kwartaal',
  yearly: 'per jaar',
};

function AddExpenseForm({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('overig');
  const [amount, setAmount] = useState('');
  const [interval, setInterval] = useState('monthly');
  const [paymentDay, setPaymentDay] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!name || !amount) return;
    setSaving(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category,
          amount: Math.round(parseFloat(amount) * 100),
          interval,
          payment_day: paymentDay ? parseInt(paymentDay) : null,
        }),
      });
      if (res.ok) {
        setName('');
        setAmount('');
        setPaymentDay('');
        onAdded();
      }
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-3 rounded-xl border border-pw-blue/20 bg-pw-blue/[0.03] p-4">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Bijv. Ziggo, Eneco..."
          className="flex-1 rounded-xl border border-pw-border bg-pw-surface px-3 py-2.5 text-[14px] outline-none focus:border-pw-blue"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <input
          type="number"
          inputMode="decimal"
          placeholder="€"
          className="w-24 rounded-xl border border-pw-border bg-pw-surface px-3 py-2.5 text-[14px] text-right outline-none focus:border-pw-blue"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="flex-1 rounded-xl border border-pw-border bg-pw-surface px-3 py-2 text-[13px] outline-none"
        >
          {Object.entries(CATEGORY_CONFIG).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          value={interval}
          onChange={e => setInterval(e.target.value)}
          className="flex-1 rounded-xl border border-pw-border bg-pw-surface px-3 py-2 text-[13px] outline-none"
        >
          <option value="weekly">Per week</option>
          <option value="monthly">Per maand</option>
          <option value="quarterly">Per kwartaal</option>
          <option value="yearly">Per jaar</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <input
            type="number"
            min={1}
            max={31}
            placeholder="Afschrijfdag (optioneel)"
            className="w-full rounded-xl border border-pw-border bg-pw-surface px-3 py-2 text-[13px] outline-none focus:border-pw-blue"
            value={paymentDay}
            onChange={e => setPaymentDay(e.target.value)}
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={saving || !name || !amount}
          className="flex items-center gap-1.5 rounded-xl bg-pw-blue px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Toevoegen
        </button>
      </div>
    </div>
  );
}

export default function ExpensesList({ onChanged }: { onChanged?: () => void }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchExpenses() {
    try {
      const res = await fetch('/api/expenses');
      if (res.ok) setExpenses(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchExpenses(); }, []);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setExpenses(prev => prev.filter(e => e.id !== id));
        onChanged?.();
      }
    } catch { /* silent */ }
    finally { setDeletingId(null); }
  }

  async function handleMarkPaid(id: string) {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    try {
      await fetch(`/api/expenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ last_paid_at: now.toISOString(), last_paid_month: month }),
      });
      setExpenses(prev => prev.map(e =>
        e.id === id ? { ...e, last_paid_month: month } : e
      ));
    } catch { /* silent */ }
  }

  const totalMonthly = expenses.filter(e => e.is_active).reduce((sum, e) => sum + e.monthly_amount, 0);
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-pw-muted" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-pw-muted">Vaste lasten</h3>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 rounded-lg bg-pw-blue/10 px-2.5 py-1 text-[12px] font-medium text-pw-blue"
        >
          {showAdd ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {showAdd ? 'Sluiten' : 'Toevoegen'}
        </button>
      </div>

      {showAdd && (
        <AddExpenseForm onAdded={() => {
          fetchExpenses();
          setShowAdd(false);
          onChanged?.();
        }} />
      )}

      {expenses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-pw-border bg-pw-bg p-6 text-center">
          <p className="text-[13px] text-pw-muted">Nog geen vaste lasten toegevoegd</p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-2 text-[13px] font-medium text-pw-blue"
          >
            Voeg je eerste vaste last toe
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map(expense => {
            const config = CATEGORY_CONFIG[expense.category] || CATEGORY_CONFIG.overig;
            const Icon = config.icon;
            const isPaidThisMonth = expense.last_paid_month === currentMonth;

            return (
              <div
                key={expense.id}
                className="flex items-center gap-3 rounded-xl border border-pw-border/60 bg-pw-surface p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
              >
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-pw-bg ${config.color}`}>
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[14px] font-semibold text-pw-text">{expense.name}</p>
                    {isPaidThisMonth && (
                      <span className="flex items-center gap-0.5 rounded-full bg-pw-green/10 px-1.5 py-0.5 text-[10px] font-medium text-pw-green">
                        <Check className="h-2.5 w-2.5" /> betaald
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-pw-muted">
                    {config.label}
                    {expense.interval !== 'monthly' && ` · ${INTERVAL_LABELS[expense.interval]}`}
                    {expense.payment_day && ` · dag ${expense.payment_day}`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-[14px] font-bold text-pw-text">{formatCents(expense.monthly_amount)}</p>
                    <p className="text-[10px] text-pw-muted">/mnd</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    {!isPaidThisMonth && (
                      <button
                        onClick={() => handleMarkPaid(expense.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-pw-muted hover:bg-pw-green/10 hover:text-pw-green"
                        title="Markeer als betaald"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(expense.id)}
                      disabled={deletingId === expense.id}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-pw-muted hover:bg-pw-red/10 hover:text-pw-red"
                      title="Verwijderen"
                    >
                      {deletingId === expense.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Total */}
      {expenses.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-pw-border/60 bg-pw-bg px-4 py-3">
          <span className="text-[13px] text-pw-muted">Totaal vaste lasten per maand</span>
          <span className="text-[16px] font-bold text-pw-text">{formatCents(totalMonthly)}</span>
        </div>
      )}
    </div>
  );
}

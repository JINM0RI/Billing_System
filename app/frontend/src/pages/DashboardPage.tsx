import { useEffect, useState } from 'react';
import StatCard from '../components/ui/StatCard';
import { apiFetch } from '../lib/api';
import type { Summary } from '../types';

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    apiFetch<Summary>('/dashboard/summary').then(setSummary).catch(() => setSummary(null));
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Revenue" value={summary ? `$${summary.total_revenue.toFixed(2)}` : '—'} hint="Net sales today" />
        <StatCard label="Invoices" value={summary ? String(summary.invoice_count) : '—'} hint="Completed transactions" />
        <StatCard label="Low Stock" value={summary ? String(summary.low_stock_count) : '—'} hint="Products below threshold" />
        <StatCard label="Products" value={summary ? String(summary.active_products) : '—'} hint="Active catalog items" />
        <StatCard label="Employees" value={summary ? String(summary.total_employees) : '—'} hint="Managed user accounts" />
      </div>

      <div className="panel p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="chip">Realtime operations</p>
            <h3 className="mt-3 text-2xl font-semibold text-white">Operational overview</h3>
          </div>
          <div className="text-sm text-slate-400">Local-first architecture with API-backed persistence</div>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {[
            ['Billing', 'Fast keyboard-driven checkout and invoice generation.'],
            ['Inventory', 'Tracked product stock across storage locations.'],
            ['Security', 'Password hashing, session tokens, and RBAC.'],
          ].map(([title, body]) => (
            <div key={title} className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <h4 className="text-lg font-semibold text-white">{title}</h4>
              <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

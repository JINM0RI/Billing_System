import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { Invoice } from '../types';

export default function SalesPage() {
  const [transactions, setTransactions] = useState<Invoice[]>([]);
  const [report, setReport] = useState<{ range: string; revenue: number; invoice_count: number } | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<Invoice[]>('/sales/transactions'),
      apiFetch<{ range: string; revenue: number; invoice_count: number }>('/sales/reports?range=daily'),
    ])
      .then(([transactionData, reportData]) => {
        setTransactions(transactionData);
        setReport(reportData);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="panel p-6">
        <p className="chip">Sales analytics</p>
        <h3 className="mt-3 text-2xl font-semibold text-white">Daily / monthly reports</h3>
        {report ? (
          <div className="mt-6 space-y-3 text-slate-300">
            <div className="flex justify-between"><span>Range</span><span>{report.range}</span></div>
            <div className="flex justify-between"><span>Revenue</span><span>${report.revenue.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Invoices</span><span>{report.invoice_count}</span></div>
          </div>
        ) : (
          <div className="mt-4 text-sm text-slate-400">Report loading unavailable.</div>
        )}
      </div>

      <div className="panel p-6">
        <h3 className="text-2xl font-semibold text-white">Transactions</h3>
        <div className="mt-5 overflow-hidden rounded-3xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-white/5 text-slate-300">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/40 text-slate-100">
              {transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="px-4 py-3">{transaction.invoice_number}</td>
                  <td className="px-4 py-3">${transaction.total_amount.toFixed(2)}</td>
                  <td className="px-4 py-3">{transaction.payment_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

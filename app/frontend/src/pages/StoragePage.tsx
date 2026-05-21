import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch } from '../lib/api';
import type { PurchaseRecord } from '../types';

const measureOptions = ['kg', 'liter', 'pieces'];

export default function PurchasePage() {
  const [records, setRecords] = useState<PurchaseRecord[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [form, setForm] = useState({
    category: '',
    product_name: '',
    purchased_from: '',
    purchase_price: '',
    measuring_type: 'pieces',
    count: '',
    code: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadRecords() {
    const data = await apiFetch<PurchaseRecord[]>('/purchases');
    setRecords(data);
  }

  async function loadCategories() {
    const data = await apiFetch<string[]>('/categories');
    setCategories(data);
  }

  useEffect(() => {
    loadRecords().catch(() => setRecords([]));
    loadCategories().catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const { category, product_name, measuring_type } = form;
    if (!category.trim() || !product_name.trim() || !measuring_type) {
      setForm((current) => ({ ...current, code: '' }));
      return;
    }

    const params = new URLSearchParams({
      name: product_name.trim(),
      category: category.trim(),
      measuring_type,
    });

    apiFetch<{ code: string; exists: boolean }>(`/purchases/code?${params.toString()}`)
      .then((data) => setForm((current) => ({ ...current, code: data.code })))
      .catch(() => setForm((current) => ({ ...current, code: '' })));
  }, [form.category, form.product_name, form.measuring_type]);

  async function submitPurchase(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.category.trim() || !form.product_name.trim() || !form.purchased_from.trim()) {
      setError('Category, product name, and purchased from are required.');
      return;
    }
    if (!form.purchase_price || !form.count) {
      setError('Purchase price and count are required.');
      return;
    }

    const payload = {
      category: form.category.trim(),
      product_name: form.product_name.trim(),
      purchased_from: form.purchased_from.trim(),
      purchase_price: Number(form.purchase_price),
      measuring_type: form.measuring_type,
      count: Number(form.count),
    };

    try {
      await apiFetch('/purchases', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setForm({
        category: '',
        product_name: '',
        purchased_from: '',
        purchase_price: '',
        measuring_type: 'pieces',
        count: '',
        code: '',
      });
      await loadRecords();
      setSuccess('Purchase record saved.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save purchase.');
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <form className="panel p-6" onSubmit={submitPurchase}>
        <p className="chip">Purchase management</p>
        <h3 className="mt-3 text-2xl font-semibold text-white">Add purchase</h3>
        <div className="mt-6 space-y-4">
          <input
            className="field"
            placeholder="Category"
            list="category-options"
            value={form.category}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
          />
          <datalist id="category-options">
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
          <input className="field" placeholder="Product name" value={form.product_name} onChange={(event) => setForm({ ...form, product_name: event.target.value })} />
          <input className="field" placeholder="Purchased from" value={form.purchased_from} onChange={(event) => setForm({ ...form, purchased_from: event.target.value })} />
          <input className="field" type="number" placeholder="Purchase price" value={form.purchase_price} onChange={(event) => setForm({ ...form, purchase_price: event.target.value })} />
          <div className="grid gap-4 md:grid-cols-2">
            <select className="field" value={form.measuring_type} onChange={(event) => setForm({ ...form, measuring_type: event.target.value })}>
              {measureOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <input className="field" type="number" placeholder="Count" value={form.count} onChange={(event) => setForm({ ...form, count: event.target.value })} />
          </div>
          <input className="field" placeholder="Code" value={form.code} readOnly />
          {error ? <p className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}
          {success ? <p className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{success}</p> : null}
          <button className="btn-primary w-full" type="submit">Register</button>
        </div>
      </form>

      <div className="panel p-6">
        <h3 className="text-2xl font-semibold text-white">Purchase records</h3>
        <div className="mt-5 overflow-hidden rounded-3xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-white/5 text-slate-300">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Purchase price</th>
                <th className="px-4 py-3">Measure</th>
                <th className="px-4 py-3">Count</th>
                <th className="px-4 py-3">Purchased from</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/40 text-slate-100">
              {records.map((record) => (
                <tr key={record.id}>
                  <td className="px-4 py-3">{record.code}</td>
                  <td className="px-4 py-3">{record.category}</td>
                  <td className="px-4 py-3">{record.product_name}</td>
                  <td className="px-4 py-3">Rs {record.purchase_price.toFixed(2)}</td>
                  <td className="px-4 py-3">{record.measuring_type}</td>
                  <td className="px-4 py-3">{record.count}</td>
                  <td className="px-4 py-3">{record.purchased_from}</td>
                  <td className="px-4 py-3">{new Date(record.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

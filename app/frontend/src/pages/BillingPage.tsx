import { useMemo, useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { Invoice, Product } from '../types';

type CartItem = {
  product: Product;
  quantity: number;
};

export default function BillingPage() {
  const [employeeId, setEmployeeId] = useState<number>(1);
  const [customerName, setCustomerName] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [codeInput, setCodeInput] = useState('');
  const [items, setItems] = useState<CartItem[]>([]);
  const [recentInvoice, setRecentInvoice] = useState<Invoice | null>(null);

  const [error, setError] = useState<string | null>(null);

  function roundTo2(value: number) {
    return Math.round(value * 100) / 100;
  }

  async function addByCode() {
    const code = codeInput.trim();
    if (!code) {
      return;
    }
    setError(null);
    try {
      const product = await apiFetch<Product>(`/products/code/${encodeURIComponent(code)}`);
      setItems((current) => {
        const existing = current.find((entry) => entry.product.id === product.id);
        if (existing) {
          return current.map((entry) => (entry.product.id === product.id ? { ...entry, quantity: entry.quantity + 1 } : entry));
        }
        return [...current, { product, quantity: 1 }];
      });
      setCodeInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch product by code.');
    }
  }

  const subtotal = useMemo(() => {
    return roundTo2(items.reduce((total, item) => total + item.product.unit_price * item.quantity, 0));
  }, [items]);

  const discountAmount = useMemo(() => roundTo2(subtotal * (discountPercent / 100)), [subtotal, discountPercent]);

  const total = useMemo(() => roundTo2(subtotal - discountAmount), [subtotal, discountAmount]);

  async function submitInvoice() {
    setError(null);
    const payload = {
      customer_name: customerName || null,
      employee_id: employeeId,
      items: items.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
      discount_amount: discountAmount,
      payment_method: paymentMethod,
      tax_rate_override: 0,
    };
    try {
      const invoice = await apiFetch<Invoice>('/invoices', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setRecentInvoice(invoice);
      setItems([]);
      setCustomerName('');
      setDiscountPercent(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save invoice.');
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="panel p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="chip">Billing engine</p>
            <h3 className="mt-3 text-2xl font-semibold text-white">Create invoice</h3>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <input className="field" placeholder="Customer name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
          <input className="field" type="number" placeholder="Employee id" value={employeeId} onChange={(event) => setEmployeeId(Number(event.target.value))} />
          <input
            className="field"
            placeholder="Enter product code"
            value={codeInput}
            onChange={(event) => setCodeInput(event.target.value)}
            inputMode="numeric"
            pattern="[0-9]*"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addByCode();
              }
            }}
          />
          <button className="btn-secondary" type="button" onClick={addByCode}>
            Add by code
          </button>
          <input
            className="field"
            type="number"
            placeholder="Discount %"
            value={discountPercent}
            onChange={(event) => setDiscountPercent(Number(event.target.value))}
          />
          <select className="field" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="wallet">Wallet</option>
            <option value="bank_transfer">Bank transfer</option>
          </select>
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

        <div className="mt-6 space-y-3">
          {items.map((item) => (
            <div key={item.product.id} className="grid gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 md:grid-cols-[1fr_150px_140px_120px]">
              <div>
                <div className="font-semibold text-white">{item.product.name}</div>
                <div className="text-sm text-slate-400">{item.product.sku} • {item.product.measuring_type}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => setItems((current) => current.map((entry) => (entry.product.id === item.product.id ? { ...entry, quantity: Math.max(1, entry.quantity - 1) } : entry)))}
                >
                  <Minus size={16} />
                </button>
                <input
                  className="field w-20 text-right"
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(event) =>
                    setItems((current) => current.map((entry) => (entry.product.id === item.product.id ? { ...entry, quantity: Number(event.target.value) } : entry)))
                  }
                />
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => setItems((current) => current.map((entry) => (entry.product.id === item.product.id ? { ...entry, quantity: entry.quantity + 1 } : entry)))}
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="text-sm text-slate-300">
                ₹{item.product.unit_price.toFixed(2)} per {item.product.measuring_type}
              </div>
              <div className="flex items-center justify-between gap-2 text-sm text-slate-200">
                <span>₹{roundTo2(item.product.unit_price * item.quantity).toFixed(2)}</span>
                <button className="btn-secondary gap-2" type="button" onClick={() => setItems((current) => current.filter((entry) => entry.product.id !== item.product.id))}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {!items.length ? <div className="text-sm text-slate-400">Scan or enter a code to start the cart.</div> : null}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button className="btn-primary" type="button" onClick={submitInvoice} disabled={!items.length}>
            Save invoice
          </button>
          <div className="text-sm text-slate-400">Pricing uses product selling price. FIFO cost is applied on submit.</div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="panel p-6">
          <h3 className="text-xl font-semibold text-white">Totals</h3>
          <div className="mt-4 space-y-2 text-sm text-slate-300">
            <div className="flex justify-between"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Discount</span><span>-₹{discountAmount.toFixed(2)}</span></div>
            {recentInvoice?.profit != null ? (
              <div className="flex justify-between"><span>Profit</span><span>₹{recentInvoice.profit.toFixed(2)}</span></div>
            ) : null}
            <div className="mt-3 flex justify-between border-t border-white/10 pt-3 text-base font-semibold text-white"><span>Total</span><span>₹{total.toFixed(2)}</span></div>
          </div>
        </div>

        <div className="panel p-6">
          <h3 className="text-xl font-semibold text-white">Last invoice</h3>
          {recentInvoice ? (
            <div className="mt-4 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-50">
              <div className="font-semibold">{recentInvoice.invoice_number}</div>
              <div>Total: ₹{recentInvoice.total_amount.toFixed(2)}</div>
              {recentInvoice.cost_price != null ? <div>Cost price: ₹{recentInvoice.cost_price.toFixed(2)}</div> : null}
              {recentInvoice.profit != null ? <div>Profit: ₹{recentInvoice.profit.toFixed(2)}</div> : null}
              <div>Status: {recentInvoice.payment_status}</div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-400">No invoice saved yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

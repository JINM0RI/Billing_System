import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { Invoice, InvoiceItemDraft, Product } from '../types';

export default function BillingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [employeeId, setEmployeeId] = useState<number>(1);
  const [customerName, setCustomerName] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [items, setItems] = useState<InvoiceItemDraft[]>([]);
  const [recentInvoice, setRecentInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    apiFetch<Product[]>('/products').then(setProducts).catch(() => setProducts([]));
  }, []);

  const subtotal = useMemo(() => {
    return items.reduce((total, item) => {
      const product = products.find((candidate) => candidate.id === item.product_id);
      return total + (product ? product.unit_price * item.quantity : 0);
    }, 0);
  }, [items, products]);

  const taxAmount = useMemo(() => {
    return items.reduce((total, item) => {
      const product = products.find((candidate) => candidate.id === item.product_id);
      return total + (product ? product.unit_price * item.quantity * product.tax_rate : 0);
    }, 0);
  }, [items, products]);

  const total = subtotal - discountAmount + taxAmount;

  function addLine() {
    const product = products[0];
    if (!product) {
      return;
    }
    setItems((current) => [...current, { product_id: product.id, quantity: 1, product }]);
  }

  async function submitInvoice() {
    const payload = {
      customer_name: customerName || null,
      employee_id: employeeId,
      items: items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
      discount_amount: discountAmount,
      payment_method: paymentMethod,
    };
    const invoice = await apiFetch<Invoice>('/invoices', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setRecentInvoice(invoice);
    setItems([]);
    setCustomerName('');
    setDiscountAmount(0);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="panel p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="chip">Billing engine</p>
            <h3 className="mt-3 text-2xl font-semibold text-white">Create invoice</h3>
          </div>
          <button className="btn-secondary gap-2" type="button" onClick={addLine}>
            <Plus size={16} /> Add item
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <input className="field" placeholder="Customer name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
          <input className="field" type="number" placeholder="Employee id" value={employeeId} onChange={(event) => setEmployeeId(Number(event.target.value))} />
          <input className="field" type="number" placeholder="Discount amount" value={discountAmount} onChange={(event) => setDiscountAmount(Number(event.target.value))} />
          <select className="field" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="wallet">Wallet</option>
            <option value="bank_transfer">Bank transfer</option>
          </select>
        </div>

        <div className="mt-6 space-y-3">
          {items.map((item, index) => {
            const product = products.find((candidate) => candidate.id === item.product_id);
            return (
              <div key={`${item.product_id}-${index}`} className="grid gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 md:grid-cols-[1fr_120px_120px]">
                <select
                  className="field"
                  value={item.product_id}
                  onChange={(event) => {
                    const productId = Number(event.target.value);
                    const productMatch = products.find((candidate) => candidate.id === productId);
                    setItems((current) => current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, product_id: productId, product: productMatch } : entry)));
                  }}
                >
                  {products.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
                <input
                  className="field"
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(event) => setItems((current) => current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, quantity: Number(event.target.value) } : entry)))}
                />
                <button className="btn-secondary gap-2" type="button" onClick={() => setItems((current) => current.filter((_, entryIndex) => entryIndex !== index))}>
                  <Trash2 size={16} /> Remove
                </button>
                <div className="text-sm text-slate-400 md:col-span-3">
                  {product ? `${product.category} • ${product.unit_price.toFixed(2)} each` : 'Select a product'}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button className="btn-primary" type="button" onClick={submitInvoice} disabled={!items.length}>
            Save invoice
          </button>
          <div className="text-sm text-slate-400">Keyboard-friendly billing flow with auto calculation.</div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="panel p-6">
          <h3 className="text-xl font-semibold text-white">Totals</h3>
          <div className="mt-4 space-y-2 text-sm text-slate-300">
            <div className="flex justify-between"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Tax</span><span>${taxAmount.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Discount</span><span>-${discountAmount.toFixed(2)}</span></div>
            <div className="mt-3 flex justify-between border-t border-white/10 pt-3 text-base font-semibold text-white"><span>Total</span><span>${total.toFixed(2)}</span></div>
          </div>
        </div>

        <div className="panel p-6">
          <h3 className="text-xl font-semibold text-white">Last invoice</h3>
          {recentInvoice ? (
            <div className="mt-4 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-50">
              <div className="font-semibold">{recentInvoice.invoice_number}</div>
              <div>Total: ${recentInvoice.total_amount.toFixed(2)}</div>
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

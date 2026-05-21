import { useEffect, useMemo, useRef, useState } from 'react';
import { Barcode, Clock, Minus, Plus, ReceiptText, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiFetch } from '../lib/api';
import type { Invoice, Product } from '../types';

type CartItem = {
  product: Product;
  quantity: number;
};

export default function BillingPage() {
  const [employeeId, setEmployeeId] = useState<number>(1);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [existingCustomer, setExistingCustomer] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi' | 'wallet'>('cash');
  const [amountReceived, setAmountReceived] = useState(0);
  const [codeInput, setCodeInput] = useState('');
  const [items, setItems] = useState<CartItem[]>([]);
  const [recentInvoice, setRecentInvoice] = useState<Invoice | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoicePreview, setInvoicePreview] = useState(() => generateInvoiceNumber());
  const [now, setNow] = useState(() => new Date());

  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const codeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    apiFetch<Product[]>('/products')
      .then((data) => setProducts(data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    codeInputRef.current?.focus();
  }, []);

  function generateInvoiceNumber() {
    const timestamp = Date.now().toString().slice(-5);
    const year = new Date().getFullYear();
    return `INV-${year}-${timestamp}`;
  }

  function roundTo2(value: number) {
    return Math.round(value * 100) / 100;
  }

  function formatCurrency(value: number) {
    return `₹${roundTo2(value).toFixed(2)}`;
  }

  function getMaxStock(product: Product) {
    return Number.isFinite(product.current_stock) ? product.current_stock : Infinity;
  }

  function focusCodeInput() {
    requestAnimationFrame(() => codeInputRef.current?.focus());
  }

  function addProductToCart(product: Product) {
    const maxStock = getMaxStock(product);
    setError(null);
    setItems((current) => {
      const existing = current.find((entry) => entry.product.id === product.id);
      const nextQuantity = existing ? existing.quantity + 1 : 1;
      if (Number.isFinite(maxStock) && maxStock <= 0) {
        setError(`No stock available for ${product.name}.`);
        return current;
      }
      if (Number.isFinite(maxStock) && nextQuantity > maxStock) {
        setError(`Insufficient stock for ${product.name}. Available: ${maxStock}.`);
        return current;
      }
      if (existing) {
        return current.map((entry) => (entry.product.id === product.id ? { ...entry, quantity: nextQuantity } : entry));
      }
      return [...current, { product, quantity: 1 }];
    });
    focusCodeInput();
  }

  async function addByCode() {
    const code = codeInput.trim();
    if (!code) {
      return;
    }
    setError(null);
    try {
      const product = await apiFetch<Product>(`/products/code/${encodeURIComponent(code)}`);
      addProductToCart(product);
      setCodeInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch product by code.');
    }
  }

  const subtotal = useMemo(() => {
    return roundTo2(items.reduce((total, item) => total + item.product.unit_price * item.quantity, 0));
  }, [items]);

  const discountAmount = useMemo(() => {
    const raw = discountType === 'percent' ? subtotal * (discountValue / 100) : discountValue;
    return roundTo2(Math.min(subtotal, Math.max(0, raw)));
  }, [subtotal, discountType, discountValue]);

  const taxAmount = useMemo(() => 0, []);

  const total = useMemo(() => roundTo2(subtotal - discountAmount + taxAmount), [subtotal, discountAmount, taxAmount]);

  const changeDue = useMemo(() => (paymentMethod === 'cash' ? roundTo2(amountReceived - total) : 0), [paymentMethod, amountReceived, total]);

  const stockIssues = useMemo(() => {
    return items.filter((item) => {
      const maxStock = getMaxStock(item.product);
      return Number.isFinite(maxStock) && item.quantity > maxStock;
    });
  }, [items]);

  const quickProducts = useMemo(() => {
    return products.filter((product) => product.is_active).slice(0, 8);
  }, [products]);

  const formattedDate = useMemo(() => now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), [now]);
  const formattedTime = useMemo(() => now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), [now]);

  const customerOptions = useMemo(() => ['Walk-in', 'Retail Member', 'Corporate Partner'], []);

  function updateQuantity(productId: number, nextQuantity: number) {
    setItems((current) =>
      current.map((entry) => {
        if (entry.product.id !== productId) {
          return entry;
        }
        const maxStock = getMaxStock(entry.product);
        const normalized = Math.max(1, Math.floor(nextQuantity));
        if (Number.isFinite(maxStock) && maxStock > 0 && normalized > maxStock) {
          setError(`Insufficient stock for ${entry.product.name}. Available: ${maxStock}.`);
          return { ...entry, quantity: maxStock };
        }
        return { ...entry, quantity: normalized };
      }),
    );
  }

  function incrementQuantity(productId: number) {
    setItems((current) =>
      current.map((entry) => {
        if (entry.product.id !== productId) {
          return entry;
        }
        const maxStock = getMaxStock(entry.product);
        const nextQuantity = entry.quantity + 1;
        if (Number.isFinite(maxStock) && nextQuantity > maxStock) {
          setError(`Insufficient stock for ${entry.product.name}. Available: ${maxStock}.`);
          return entry;
        }
        return { ...entry, quantity: nextQuantity };
      }),
    );
  }

  function decrementQuantity(productId: number) {
    setItems((current) =>
      current.map((entry) => (entry.product.id === productId ? { ...entry, quantity: Math.max(1, entry.quantity - 1) } : entry)),
    );
  }

  function clearBill() {
    setItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setExistingCustomer('');
    setDiscountType('percent');
    setDiscountValue(0);
    setAmountReceived(0);
    setStatus(null);
    setError(null);
    setInvoicePreview(generateInvoiceNumber());
    focusCodeInput();
  }

  async function submitInvoice() {
    setError(null);
    setStatus(null);
    if (!items.length) {
      setError('Add at least one product to create an invoice.');
      return;
    }
    if (stockIssues.length) {
      setError('Resolve stock warnings before submitting the invoice.');
      return;
    }
    const payload = {
      customer_name: existingCustomer || customerName || null,
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
      setCustomerPhone('');
      setExistingCustomer('');
      setDiscountValue(0);
      setAmountReceived(0);
      setInvoicePreview(generateInvoiceNumber());
      setStatus('Invoice generated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save invoice.');
    }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 18 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.6fr_0.95fr]">
      <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="visible">
        <motion.section variants={itemVariants} className="panel relative overflow-hidden p-6">
          <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-amber-300/60 via-amber-200/20 to-transparent" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="chip">Billing console</p>
              <h3 className="mt-3 text-3xl font-semibold text-white">Retail POS billing</h3>
              <p className="mt-2 text-sm text-slate-400">Fast cashier workflow with real-time totals.</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Clock size={16} />
                <span>{formattedDate}</span>
                <span className="text-slate-500">•</span>
                <span>{formattedTime}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <ReceiptText size={16} />
                <span className="text-slate-400">Invoice</span>
                <span className="font-semibold text-amber-200">{recentInvoice?.invoice_number ?? invoicePreview}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Operator ID</p>
              <input
                className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2 text-sm text-slate-100 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
                type="number"
                value={employeeId}
                min={1}
                onChange={(event) => setEmployeeId(Number(event.target.value))}
              />
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Shift Status</p>
              <div className="mt-3 flex items-center justify-between text-sm text-slate-200">
                <span>Active</span>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-xs text-emerald-200">Ready</span>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Session Total</p>
              <div className="mt-3 text-xl font-semibold text-emerald-200">{formatCurrency(subtotal)}</div>
              <p className="mt-1 text-xs text-slate-400">Excludes discount & tax</p>
            </div>
          </div>
        </motion.section>

        <motion.section variants={itemVariants} className="panel p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Barcode size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-300" />
              <input
                ref={codeInputRef}
                className="w-full rounded-3xl border border-white/10 bg-slate-900/80 py-4 pl-12 pr-4 text-base text-white outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
                placeholder="Scan or enter product code"
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
            </div>
            <button className="btn-primary min-w-[160px] rounded-3xl" type="button" onClick={addByCode}>
              Add to cart
            </button>
          </div>

          <div className="mt-6">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Quick products</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {quickProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-amber-300/60 hover:text-white hover:shadow-[0_0_20px_rgba(251,191,36,0.22)]"
                  onClick={() => addProductToCart(product)}
                >
                  {product.name}
                </button>
              ))}
              {!quickProducts.length ? <span className="text-sm text-slate-400">No quick products found.</span> : null}
            </div>
          </div>
        </motion.section>

        <motion.section variants={itemVariants} className="panel p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="chip">Cart</p>
              <h4 className="mt-2 text-xl font-semibold text-white">Billing cart</h4>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{items.length} items</span>
          </div>

          <div className="mt-4 overflow-hidden rounded-3xl border border-white/10">
            <div className="max-h-[420px] overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-900/80 text-xs uppercase tracking-[0.2em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Remove</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Quantity</th>
                    <th className="px-4 py-3">Measure</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-slate-950/40">
                  {items.map((item) => {
                    const maxStock = getMaxStock(item.product);
                    const atLimit = Number.isFinite(maxStock) && item.quantity >= maxStock;
                    const stockWarning = Number.isFinite(maxStock) && item.quantity > maxStock;

                    return (
                      <tr key={item.product.id} className={`transition hover:bg-white/5 ${stockWarning ? 'bg-red-500/10' : ''}`}>
                        <td className="px-4 py-3">
                          <button
                            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:border-red-400/60 hover:text-red-200"
                            type="button"
                            onClick={() => setItems((current) => current.filter((entry) => entry.product.id !== item.product.id))}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{item.product.sku}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{item.product.name}</div>
                          <div className="text-xs text-slate-500">Stock: {Number.isFinite(maxStock) ? maxStock : '—'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button className="btn-secondary h-9 w-9 p-0" type="button" onClick={() => decrementQuantity(item.product.id)}>
                              <Minus size={14} />
                            </button>
                            <input
                              className="field h-9 w-16 px-2 text-center"
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(event) => updateQuantity(item.product.id, Number(event.target.value))}
                            />
                            <button
                              className="btn-secondary h-9 w-9 p-0"
                              type="button"
                              onClick={() => incrementQuantity(item.product.id)}
                              disabled={atLimit}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{item.product.measuring_type}</td>
                        <td className="px-4 py-3 text-slate-200">{formatCurrency(item.product.unit_price)}</td>
                        <td className="px-4 py-3 font-semibold text-white">{formatCurrency(item.product.unit_price * item.quantity)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {!items.length ? <div className="mt-4 text-sm text-slate-400">Scan or enter a code to start the cart.</div> : null}
        </motion.section>

        <motion.section variants={itemVariants} className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-3">
            <button className="btn-secondary gap-2" type="button">
              Hold Bill
            </button>
            <button className="inline-flex items-center gap-2 rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/20" type="button" onClick={clearBill}>
              Cancel Bill
            </button>
          </div>
          <div className="text-sm text-slate-400">Pricing uses product selling price. FIFO stock is applied on submit.</div>
        </motion.section>
      </motion.div>

      <motion.aside className="space-y-6" variants={containerVariants} initial="hidden" animate="visible">
        <motion.section variants={itemVariants} className="panel p-6">
          <h4 className="text-lg font-semibold text-white">Customer details</h4>
          <div className="mt-4 space-y-3">
            <input className="field" placeholder="Customer name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
            <input className="field" placeholder="Phone number" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
            <select className="field" value={existingCustomer} onChange={(event) => setExistingCustomer(event.target.value)}>
              <option value="">Select customer (optional)</option>
              {customerOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </motion.section>

        <motion.section variants={itemVariants} className="panel p-6">
          <h4 className="text-lg font-semibold text-white">Discount</h4>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr]">
            <select className="field" value={discountType} onChange={(event) => setDiscountType(event.target.value as 'percent' | 'fixed')}>
              <option value="percent">Percentage</option>
              <option value="fixed">Fixed amount</option>
            </select>
            <input
              className="field"
              type="number"
              min={0}
              placeholder={discountType === 'percent' ? 'Discount %' : 'Discount amount'}
              value={discountValue}
              onChange={(event) => setDiscountValue(Number(event.target.value))}
            />
          </div>
        </motion.section>

        <motion.section variants={itemVariants} className="panel bg-panel-radial p-6">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-white">Payment summary</h4>
            <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-xs text-amber-200">Live</span>
          </div>
          <div className="mt-5 space-y-3 text-sm text-slate-200">
            <div className="flex justify-between"><span className="text-slate-400">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Discount</span><span>-{formatCurrency(discountAmount)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Tax</span><span>{formatCurrency(taxAmount)}</span></div>
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-base font-semibold text-amber-200">
              <span>Grand Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
            {recentInvoice?.profit != null ? (
              <div className="flex justify-between text-emerald-200"><span>Last profit</span><span>{formatCurrency(recentInvoice.profit)}</span></div>
            ) : null}
          </div>
        </motion.section>

        <motion.section variants={itemVariants} className="panel p-6">
          <h4 className="text-lg font-semibold text-white">Payment method</h4>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {['cash', 'card', 'upi', 'wallet'].map((method) => (
              <button
                key={method}
                type="button"
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  paymentMethod === method
                    ? 'border-amber-300 bg-amber-300/20 text-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.25)]'
                    : 'border-white/10 bg-white/5 text-slate-200 hover:border-amber-300/50'
                }`}
                onClick={() => setPaymentMethod(method as 'cash' | 'card' | 'upi' | 'wallet')}
              >
                {method.toUpperCase()}
              </button>
            ))}
          </div>
        </motion.section>

        {paymentMethod === 'cash' ? (
          <motion.section variants={itemVariants} className="panel p-6">
            <h4 className="text-lg font-semibold text-white">Cash handling</h4>
            <div className="mt-4 space-y-3">
              <input
                className="field"
                type="number"
                min={0}
                placeholder="Amount received"
                value={amountReceived}
                onChange={(event) => setAmountReceived(Number(event.target.value))}
              />
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
                Change: {formatCurrency(changeDue)}
              </div>
            </div>
          </motion.section>
        ) : null}

        {error ? <motion.div variants={itemVariants} className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</motion.div> : null}
        {status ? <motion.div variants={itemVariants} className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{status}</motion.div> : null}
        {stockIssues.length ? (
          <motion.div variants={itemVariants} className="rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-200">
            Stock warning: reduce quantities to available stock before checkout.
          </motion.div>
        ) : null}

        <motion.section variants={itemVariants} className="space-y-3">
          <button
            className="w-full rounded-3xl bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-300 px-6 py-4 text-base font-semibold text-slate-950 shadow-[0_20px_40px_rgba(251,191,36,0.25)] transition hover:scale-[1.01] hover:shadow-[0_25px_50px_rgba(251,191,36,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={submitInvoice}
            disabled={!items.length || stockIssues.length > 0}
          >
            Pay & Generate Invoice
          </button>
          {recentInvoice ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
              <div className="font-semibold text-white">Last invoice: {recentInvoice.invoice_number}</div>
              <div>Total: {formatCurrency(recentInvoice.total_amount)}</div>
              {recentInvoice.cost_price != null ? <div>Cost price: {formatCurrency(recentInvoice.cost_price)}</div> : null}
              {recentInvoice.profit != null ? <div>Profit: {formatCurrency(recentInvoice.profit)}</div> : null}
              <div>Status: {recentInvoice.payment_status}</div>
            </div>
          ) : null}
        </motion.section>
      </motion.aside>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { Product, PurchaseBatch } from '../types';

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [lowStock, setLowStock] = useState<Array<{ id: number; name: string; stock: number; threshold: number }>>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [batches, setBatches] = useState<PurchaseBatch[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [alertDrafts, setAlertDrafts] = useState<Record<number, number>>({});
  const [alertError, setAlertError] = useState<string | null>(null);
  const [isSavingAlerts, setIsSavingAlerts] = useState(false);

  const lowStockMap = useMemo(() => new Map(lowStock.map((item) => [item.id, item])), [lowStock]);

  useEffect(() => {
    Promise.all([apiFetch<Product[]>('/products'), apiFetch<Array<{ id: number; name: string; stock: number; threshold: number }>>('/products/low-stock')])
      .then(([productData, lowStockData]) => {
        setProducts(productData);
        setLowStock(lowStockData);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!products.length) {
      return;
    }
    setAlertDrafts((current) => {
      const next = { ...current };
      products.forEach((product) => {
        if (next[product.id] == null) {
          next[product.id] = product.low_stock_threshold;
        }
      });
      return next;
    });
  }, [products]);

  useEffect(() => {
    if (!selectedProduct) {
      setBatches([]);
      return;
    }
    setIsLoadingBatches(true);
    apiFetch<PurchaseBatch[]>(`/products/${selectedProduct.id}/batches`)
      .then((data) => setBatches(data))
      .catch(() => setBatches([]))
      .finally(() => setIsLoadingBatches(false));
  }, [selectedProduct]);

  function openAlertModal() {
    const initialDrafts: Record<number, number> = {};
    products.forEach((product) => {
      initialDrafts[product.id] = product.low_stock_threshold;
    });
    setAlertDrafts(initialDrafts);
    setAlertError(null);
    setIsAlertOpen(true);
  }

  async function saveAlerts() {
    setIsSavingAlerts(true);
    setAlertError(null);
    try {
      const updates = products.filter((product) => alertDrafts[product.id] !== product.low_stock_threshold);
      await Promise.all(
        updates.map((product) =>
          apiFetch<Product>(`/products/${product.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ low_stock_threshold: alertDrafts[product.id] ?? product.low_stock_threshold }),
          }),
        ),
      );

      if (updates.length) {
        const refreshed = await apiFetch<Product[]>('/products');
        setProducts(refreshed);
        const refreshedLowStock = await apiFetch<Array<{ id: number; name: string; stock: number; threshold: number }>>('/products/low-stock');
        setLowStock(refreshedLowStock);
      }

      setIsAlertOpen(false);
    } catch (error) {
      setAlertError(error instanceof Error ? error.message : 'Unable to save alert thresholds.');
    } finally {
      setIsSavingAlerts(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="panel p-6">
        <p className="chip">Stock management</p>
        <h3 className="mt-3 text-2xl font-semibold text-white">Products and inventory levels</h3>
        <div className="mt-6 overflow-hidden rounded-3xl border border-white/10">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm">
            <thead className="bg-white/5 text-slate-300">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/40 text-slate-100">
              {products.map((product) => (
                <tr
                  key={product.id}
                  className={`cursor-pointer transition ${selectedProduct?.id === product.id ? 'bg-amber-400/10' : 'hover:bg-white/5'} ${lowStockMap.has(product.id) ? 'text-amber-200' : ''}`}
                  onClick={() => setSelectedProduct(product)}
                >
                  <td className="px-4 py-3">{product.name}</td>
                  <td className="px-4 py-3">
                    {product.current_stock} {product.measuring_type}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-6">
        <div className="panel p-6">
          <h3 className="text-2xl font-semibold text-white">Batch breakdown</h3>
          {selectedProduct ? (
            <div className="mt-4 space-y-4">
              <div className="text-sm text-slate-300">
                <div className="font-semibold text-white">{selectedProduct.name}</div>
                <div>
                  Total: {selectedProduct.current_stock} {selectedProduct.measuring_type}
                </div>
              </div>
              <div className="space-y-3">
                {isLoadingBatches ? <div className="text-sm text-slate-400">Loading batches...</div> : null}
                {!isLoadingBatches && !batches.length ? <div className="text-sm text-slate-400">No batches found.</div> : null}
                {batches.map((batch, index) => {
                  const isOldest = index === 0;
                  const isNewest = index === batches.length - 1 && batches.length > 1;
                  const status = isOldest ? 'NEXT FIFO BATCH' : isNewest ? 'LATEST BATCH' : 'ACTIVE BATCH';
                  const batchCode = `BATCH-${String(batch.batch_id).padStart(3, '0')}`;
                  return (
                    <div key={batch.batch_id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-100">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold">{batchCode}</div>
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-slate-300">{status}</span>
                      </div>
                      <div className="mt-2 font-semibold">
                        {batch.remaining_quantity} / {batch.original_quantity} {selectedProduct.measuring_type}
                      </div>
                      <div className="mt-1 text-slate-300">Unit cost: ₹{batch.unit_cost.toFixed(2)} per {selectedProduct.measuring_type}</div>
                      <div className="mt-1 text-slate-300">Purchased: {new Date(batch.created_at).toLocaleDateString()}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-400">Select a product to view FIFO batches.</div>
          )}
        </div>

        <div className="panel p-6">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-2xl font-semibold text-white">Low stock alerts</h3>
            <button className="btn-secondary" type="button" onClick={openAlertModal}>Configure Alerts</button>
          </div>
          <div className="mt-5 space-y-3">
            {lowStock.map((item) => {
              const product = products.find((candidate) => candidate.id === item.id);
              const measure = product?.measuring_type ?? '';
              return (
                <div key={item.id} className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-amber-100">
                  <div className="font-semibold">{item.name} is low in stock</div>
                  <div className="text-sm">Current: {item.stock} {measure} • Minimum: {item.threshold} {measure}</div>
                </div>
              );
            })}
            {!lowStock.length ? <div className="text-sm text-slate-400">No low stock items.</div> : null}
          </div>
        </div>
      </div>

      {isAlertOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 px-4 py-10">
          <div className="panel w-full max-w-3xl p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="chip">Alert configuration</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Configure low stock thresholds</h3>
              </div>
              <button className="btn-secondary" type="button" onClick={() => setIsAlertOpen(false)}>Close</button>
            </div>

            {alertError ? <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{alertError}</div> : null}

            <div className="mt-5 max-h-[320px] overflow-auto rounded-3xl border border-white/10">
              <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                <thead className="bg-white/5 text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Current stock</th>
                    <th className="px-4 py-3">Minimum stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-slate-950/40 text-slate-100">
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td className="px-4 py-3 font-medium text-white">{product.name}</td>
                      <td className="px-4 py-3">{product.current_stock} {product.measuring_type}</td>
                      <td className="px-4 py-3">
                        <input
                          className="field w-32"
                          type="number"
                          min={0}
                          value={alertDrafts[product.id] ?? product.low_stock_threshold}
                          onChange={(event) =>
                            setAlertDrafts((current) => ({
                              ...current,
                              [product.id]: Number(event.target.value),
                            }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button className="btn-secondary" type="button" onClick={() => setIsAlertOpen(false)}>Cancel</button>
              <button className="btn-primary" type="button" onClick={saveAlerts} disabled={isSavingAlerts}>
                {isSavingAlerts ? 'Saving…' : 'Save alerts'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

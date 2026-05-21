import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { Product } from '../types';

type PriceControl = {
  sellingPrice: number;
  priceCount: number;
  measureType: string;
  fifoCost: number;
  fifoError?: string;
  fifoLoaded: boolean;
  dirty: boolean;
};

export default function ProductPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [controls, setControls] = useState<Record<number, PriceControl>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    apiFetch<Product[]>('/products')
      .then((productData) => {
        setProducts(productData);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setControls((current) => {
      const next = { ...current };
      products.forEach((product) => {
        if (!next[product.id]) {
          const count = product.price_unit_count > 0 ? product.price_unit_count : 1;
          const defaultPrice = product.unit_price > 0 ? product.unit_price * count : product.fifo_avg_cost * count;
          next[product.id] = {
            sellingPrice: defaultPrice,
            priceCount: count,
            measureType: product.measuring_type,
            fifoCost: 0,
            fifoLoaded: false,
            dirty: false,
          };
        }
      });
      return next;
    });
  }, [products]);

  useEffect(() => {
    products.forEach((product) => {
      const control = controls[product.id];
      if (control && !control.fifoLoaded) {
        refreshFifoCost(product.id, control.priceCount).catch(() => undefined);
      }
    });
  }, [products, controls]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach((product) => {
      const category = product.category.trim();
      if (!category) {
        return;
      }
      counts.set(category, (counts.get(category) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const categoryProducts = useMemo(() => {
    if (!selectedCategory) {
      return [] as Product[];
    }
    return products.filter((product) => product.category === selectedCategory);
  }, [products, selectedCategory]);

  function toNumber(value: string) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function roundTo2(num: number) {
    return Math.round(num * 100) / 100;
  }

  function updateSellingPrice(productId: number, value: number) {
    setControls((current) => ({
      ...current,
      [productId]: {
        sellingPrice: value,
        priceCount: current[productId]?.priceCount ?? 1,
        measureType: current[productId]?.measureType ?? 'pieces',
        fifoCost: current[productId]?.fifoCost ?? 0,
        fifoError: current[productId]?.fifoError,
        fifoLoaded: current[productId]?.fifoLoaded ?? false,
        dirty: true,
      },
    }));
  }

  function updateMeasureCount(productId: number, value: number) {
    const count = Math.max(1, Math.floor(value));
    setControls((current) => ({
      ...current,
      [productId]: {
        sellingPrice: current[productId]?.sellingPrice ?? 0,
        priceCount: count,
        measureType: current[productId]?.measureType ?? 'pieces',
        fifoCost: 0,
        fifoError: undefined,
        fifoLoaded: false,
        dirty: true,
      },
    }));
    refreshFifoCost(productId, count).catch(() => undefined);
  }

  function updateMeasureType(productId: number, value: string) {
    setControls((current) => ({
      ...current,
      [productId]: {
        sellingPrice: current[productId]?.sellingPrice ?? 0,
        priceCount: current[productId]?.priceCount ?? 1,
        measureType: value,
        fifoCost: current[productId]?.fifoCost ?? 0,
        fifoError: current[productId]?.fifoError,
        fifoLoaded: current[productId]?.fifoLoaded ?? false,
        dirty: true,
      },
    }));
  }

  async function refreshFifoCost(productId: number, count: number) {
    if (count <= 0) {
      return;
    }
    try {
      const data = await apiFetch<{ fifo_cost: number }>(`/products/${productId}/fifo-cost?quantity=${count}`);
      setControls((current) => ({
        ...current,
        [productId]: {
          sellingPrice: current[productId]?.sellingPrice ?? 0,
          priceCount: current[productId]?.priceCount ?? count,
          measureType: current[productId]?.measureType ?? 'pieces',
          fifoCost: data.fifo_cost,
          fifoError: undefined,
          fifoLoaded: true,
          dirty: current[productId]?.dirty ?? false,
        },
      }));
    } catch (error) {
      setControls((current) => ({
        ...current,
        [productId]: {
          sellingPrice: current[productId]?.sellingPrice ?? 0,
          priceCount: current[productId]?.priceCount ?? count,
          measureType: current[productId]?.measureType ?? 'pieces',
          fifoCost: 0,
          fifoError: error instanceof Error ? error.message : 'Unable to load FIFO cost.',
          fifoLoaded: true,
          dirty: current[productId]?.dirty ?? false,
        },
      }));
    }
  }

  async function savePrices() {
    if (!selectedCategory) {
      return;
    }
    setIsSaving(true);
    setStatus(null);
    try {
      const updates = categoryProducts
        .map((product) => ({ product, control: controls[product.id] }))
        .filter((item) => item.control?.dirty);

      await Promise.all(
        updates.map(({ product, control }) => {
          const count = Math.max(1, Math.floor(control?.priceCount ?? product.price_unit_count ?? 1));
          const sellingPrice = roundTo2(control?.sellingPrice ?? product.unit_price * count);
          const unitPrice = count > 0 ? roundTo2(sellingPrice / count) : 0;
          return apiFetch(`/products/${product.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              unit_price: unitPrice,
              price_unit_count: count,
              measuring_type: control?.measureType ?? product.measuring_type,
            }),
          }).then((updated: Product) => updated);
        }),
      );

      setProducts((current) =>
        current.map((product) => {
          const control = controls[product.id];
          if (!control?.dirty) {
            return product;
          }
          const count = Math.max(1, Math.floor(control.priceCount));
          const sellingPrice = roundTo2(control.sellingPrice);
          const unitPrice = count > 0 ? roundTo2(sellingPrice / count) : 0;
          return {
            ...product,
            unit_price: unitPrice,
            price_unit_count: count,
            measuring_type: control.measureType,
          };
        }),
      );
      setControls((current) => {
        const next = { ...current };
        Object.entries(next).forEach(([key, value]) => {
          if (value.dirty) {
            next[Number(key)] = { ...value, dirty: false };
          }
        });
        return next;
      });
      setStatus('Selling prices updated.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to update prices.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!selectedCategory) {
    return (
      <div className="panel p-6">
        <p className="chip">Product</p>
        <h3 className="mt-3 text-2xl font-semibold text-white">Choose a category</h3>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <button
              key={category.name}
              type="button"
              className="rounded-3xl border border-white/10 bg-white/5 p-5 text-left transition hover:border-amber-400/40 hover:bg-white/10"
              onClick={() => setSelectedCategory(category.name)}
            >
              <div className="text-lg font-semibold text-white">{category.name}</div>
              <div className="mt-2 text-sm text-slate-400">{category.count} products</div>
            </button>
          ))}
          {!categories.length ? <div className="text-sm text-slate-400">No categories available.</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button className="btn-secondary gap-2" type="button" onClick={() => setSelectedCategory(null)}>
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <p className="chip">Product</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">{selectedCategory} dashboard</h3>
          </div>
        </div>
        <button className="btn-primary" type="button" onClick={savePrices}>
          {isSaving ? 'Saving…' : 'Set price'}
        </button>
      </div>

      {status ? <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">{status}</div> : null}

      <div className="mt-6 overflow-hidden rounded-3xl border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-left text-sm">
          <thead className="bg-white/5 text-slate-300">
            <tr>
              <th className="px-4 py-3">Product name</th>
              <th className="px-4 py-3">Measure</th>
              <th className="px-4 py-3">FIFO cost</th>
              <th className="px-4 py-3">Selling price</th>
              <th className="px-4 py-3">Profit margin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 bg-slate-950/40 text-slate-100">
            {categoryProducts.map((product) => {
              const control = controls[product.id];
              const sellingPrice = roundTo2(control?.sellingPrice ?? product.unit_price * (product.price_unit_count || 1));
              const fifoCost = roundTo2(control?.fifoCost ?? 0);
              const hasCost = fifoCost > 0;
              const marginRaw = hasCost && sellingPrice > 0 ? ((sellingPrice - fifoCost) / sellingPrice) * 100 : 0;
              const margin = Number.isFinite(marginRaw) ? roundTo2(marginRaw) : 0;

              return (
                <tr key={product.id}>
                  <td className="px-4 py-3 font-medium text-white">{product.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        className="field w-24 text-right"
                        type="number"
                        min={1}
                        step={1}
                        value={control?.priceCount ?? product.price_unit_count}
                        onChange={(event) => updateMeasureCount(product.id, toNumber(event.target.value))}
                      />
                      <select
                        className="field w-28"
                        value={control?.measureType ?? product.measuring_type}
                        onChange={(event) => updateMeasureType(product.id, event.target.value)}
                      >
                        {['kg', 'liter', 'pieces'].map((option) => (
                          <option key={option} value={option}>
                            {option.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {control?.fifoError ? (
                      <span className="text-sm text-red-300">{control.fifoError}</span>
                    ) : fifoCost > 0 ? (
                      <span>₹{fifoCost.toFixed(2)}</span>
                    ) : (
                      <span className="text-slate-400">No stock</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      className="field w-32 text-right"
                      type="number"
                      min={0}
                      step={0.1}
                      value={Number.isFinite(sellingPrice) ? sellingPrice : 0}
                      onChange={(event) => updateSellingPrice(product.id, toNumber(event.target.value))}
                    />
                  </td>
                  <td className="px-4 py-3 font-semibold text-emerald-200">{margin.toFixed(2)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!categoryProducts.length ? <div className="mt-4 text-sm text-slate-400">No products found in this category.</div> : null}
    </div>
  );
}

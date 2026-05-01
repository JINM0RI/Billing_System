import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { Product, PurchaseRecord } from '../types';

type ProductControl = {
  value: number;
  measureType: string;
  sellingPrice: number | null;
};

const measureOptions = ['kg', 'liter', 'pieces'];
const DEFAULT_VALUE = 1;
const STORAGE_KEY = 'billing_product_controls_v1';

export default function ProductPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [controls, setControls] = useState<Record<number, ProductControl>>({});

  useEffect(() => {
    Promise.all([apiFetch<Product[]>('/products'), apiFetch<PurchaseRecord[]>('/purchases')])
      .then(([productData, purchaseData]) => {
        setProducts(productData);
        setPurchases(purchaseData);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, Partial<ProductControl>>;
      const next: Record<number, ProductControl> = {};
      Object.entries(parsed).forEach(([key, value]) => {
        const productId = Number(key);
        if (!Number.isFinite(productId) || !value) {
          return;
        }
        const valueNumber = Number(value.value);
        const sellingPriceNumber = Number(value.sellingPrice);
        const measureType = typeof value.measureType === 'string' ? value.measureType : 'pieces';
        next[productId] = {
          value: Number.isFinite(valueNumber) ? valueNumber : DEFAULT_VALUE,
          measureType,
          sellingPrice: Number.isFinite(sellingPriceNumber) ? sellingPriceNumber : null,
        };
      });
      setControls(next);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    setControls((current) => {
      const next = { ...current };
      products.forEach((product) => {
        if (!next[product.id]) {
          next[product.id] = { value: DEFAULT_VALUE, measureType: product.measuring_type, sellingPrice: null };
        }
      });
      return next;
    });
  }, [products]);

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

  const purchaseSummary = useMemo(() => {
    const summary = new Map<string, { totalPrice: number; totalCount: number }>();
    purchases.forEach((record) => {
      const key = `${record.product_name}||${record.category}||${record.measuring_type}`;
      const current = summary.get(key) ?? { totalPrice: 0, totalCount: 0 };
      current.totalPrice += record.purchase_price;
      current.totalCount += record.count;
      summary.set(key, current);
    });
    return summary;
  }, [purchases]);

  const categoryProducts = useMemo(() => {
    if (!selectedCategory) {
      return [] as Product[];
    }
    return products.filter((product) => product.category === selectedCategory);
  }, [products, selectedCategory]);

  function getPurchaseUnitPrice(product: Product, measureType: string) {
    const key = `${product.name}||${product.category}||${measureType}`;
    const summary = purchaseSummary.get(key);
    if (!summary || summary.totalCount <= 0) {
      return 0;
    }
    return summary.totalPrice / summary.totalCount;
  }

  function toNumber(value: string) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function roundTo2(num: number) {
    return Math.round(num * 100) / 100;
  }

  function updateControl(productId: number, field: 'value' | 'sellingPrice', value: number) {
    setControls((current) => ({
      ...current,
      [productId]: {
        value: current[productId]?.value ?? DEFAULT_VALUE,
        measureType: current[productId]?.measureType ?? 'pieces',
        sellingPrice: current[productId]?.sellingPrice ?? null,
        [field]: value,
      },
    }));
  }

  function updateMeasureType(productId: number, measureType: string) {
    setControls((current) => ({
      ...current,
      [productId]: {
        value: current[productId]?.value ?? DEFAULT_VALUE,
        measureType,
        sellingPrice: current[productId]?.sellingPrice ?? null,
      },
    }));
  }

  function persistControls() {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(controls));
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
        <button className="btn-primary" type="button" onClick={persistControls}>
          Set price
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-left text-sm">
          <thead className="bg-white/5 text-slate-300">
            <tr>
              <th className="px-4 py-3">Product name</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">Selling price</th>
              <th className="px-4 py-3">Profit margin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 bg-slate-950/40 text-slate-100">
            {categoryProducts.map((product) => {
              const control = controls[product.id] ?? { value: DEFAULT_VALUE, measureType: product.measuring_type, sellingPrice: null };
              const measureType = control.measureType || product.measuring_type;
              const purchaseUnit = getPurchaseUnitPrice(product, measureType);
              const purchasePrice = roundTo2(purchaseUnit * control.value);
              const sellingPrice = roundTo2(control.sellingPrice ?? purchasePrice);
              const marginRaw = sellingPrice > 0 ? ((sellingPrice - purchasePrice) / sellingPrice) * 100 : 0;
              const margin = Number.isFinite(marginRaw) ? roundTo2(marginRaw) : 0;

              return (
                <tr key={product.id}>
                  <td className="px-4 py-3 font-medium text-white">{product.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        className="field w-24 text-right"
                        type="number"
                        min={0}
                        step={0.01}
                        value={control.value}
                        onChange={(event) => updateControl(product.id, 'value', toNumber(event.target.value))}
                      />
                      <select
                        className="field w-28 uppercase"
                        value={measureType}
                        onChange={(event) => updateMeasureType(product.id, event.target.value)}
                      >
                        {measureOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      className="field w-32 text-right"
                      type="number"
                      min={0}
                      step={0.1}
                      value={Number.isFinite(sellingPrice) ? sellingPrice : 0}
                      onChange={(event) => updateControl(product.id, 'sellingPrice', toNumber(event.target.value))}
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

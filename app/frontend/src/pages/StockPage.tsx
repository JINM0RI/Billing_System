import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { Product } from '../types';

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [lowStock, setLowStock] = useState<Array<{ id: number; name: string; stock: number; threshold: number }>>([]);

  useEffect(() => {
    Promise.all([apiFetch<Product[]>('/products'), apiFetch<Array<{ id: number; name: string; stock: number; threshold: number }>>('/products/low-stock')])
      .then(([productData, lowStockData]) => {
        setProducts(productData);
        setLowStock(lowStockData);
      })
      .catch(() => undefined);
  }, []);

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
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/40 text-slate-100">
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="px-4 py-3">{product.name}</td>
                  <td className="px-4 py-3">{product.category}</td>
                  <td className="px-4 py-3">{product.current_stock}</td>
                  <td className="px-4 py-3">${product.unit_price.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel p-6">
        <h3 className="text-2xl font-semibold text-white">Low stock alerts</h3>
        <div className="mt-5 space-y-3">
          {lowStock.map((item) => (
            <div key={item.id} className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-amber-100">
              <div className="font-semibold">{item.name}</div>
              <div className="text-sm">{item.stock} left, threshold {item.threshold}</div>
            </div>
          ))}
          {!lowStock.length ? <div className="text-sm text-slate-400">No low stock items.</div> : null}
        </div>
      </div>
    </div>
  );
}

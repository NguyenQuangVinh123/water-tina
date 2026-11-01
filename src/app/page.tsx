"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/db";
import { formatVND } from "@/lib/format";

export default function SellPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [customer, setCustomer] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setProducts(data.filter((p: Product) => p.is_active));
        } else {
          setError(data?.error || "Không tải được sản phẩm");
        }
      })
      .catch(() => setError("Không kết nối được database. Kiểm tra DATABASE_URL."))
      .finally(() => setLoaded(true));
  }, []);

  const add = (id: number, d: number) =>
    setCart((c) => {
      const q = (c[id] || 0) + d;
      const next = { ...c };
      if (q <= 0) delete next[id];
      else next[id] = q;
      return next;
    });

  const total = useMemo(
    () =>
      Object.entries(cart).reduce((s, [id, q]) => {
        const p = products.find((x) => x.id === Number(id));
        return s + (p ? Number(p.price) * q : 0);
      }, 0),
    [cart, products]
  );

  async function checkout() {
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const items = Object.entries(cart).map(([product_id, qty]) => ({
        product_id: Number(product_id),
        qty,
      }));
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_name: customer, note, items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Tạo đơn thất bại");
      setOk(`✔ Đã tạo đơn #${data.id} · ${formatVND(data.total)}`);
      setCart({});
      setCustomer("");
      setNote("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-5">
      {/* Cột sản phẩm */}
      <section className="md:col-span-3">
        <h1 className="mb-3 text-lg font-bold text-slate-800">Chọn đồ uống</h1>
        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {!loaded ? (
          <p className="text-sm text-slate-400">Đang tải...</p>
        ) : products.length === 0 && !error ? (
          <p className="text-sm text-slate-400">
            Chưa có sản phẩm. Vào <b>Sản phẩm</b> (admin) để thêm.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {products.map((p) => {
              const q = cart[p.id] || 0;
              return (
                <div
                  key={p.id}
                  className={`rounded-xl border bg-white p-3 shadow-sm transition ${
                    q ? "border-sky-400 ring-2 ring-sky-100" : "border-slate-200"
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-800">{p.name}</div>
                  <div className="mb-2 text-xs text-slate-500">{p.category}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-sky-700">{formatVND(p.price)}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => add(p.id, -1)}
                        className="h-7 w-7 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                      >
                        −
                      </button>
                      <span className="w-5 text-center text-sm font-bold">{q}</span>
                      <button
                        onClick={() => add(p.id, 1)}
                        className="h-7 w-7 rounded-lg bg-sky-600 text-white hover:bg-sky-700"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Cột giỏ hàng */}
      <aside className="md:col-span-2">
        <div className="sticky top-20 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-bold text-slate-800">Đơn hàng</h2>

          {Object.keys(cart).length === 0 ? (
            <p className="text-sm text-slate-400">Chưa chọn món nào.</p>
          ) : (
            <ul className="mb-3 space-y-1 text-sm">
              {Object.entries(cart).map(([id, q]) => {
                const p = products.find((x) => x.id === Number(id));
                if (!p) return null;
                return (
                  <li key={id} className="flex justify-between text-slate-700">
                    <span>
                      {p.name} <span className="text-slate-400">× {q}</span>
                    </span>
                    <span>{formatVND(Number(p.price) * q)}</span>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mb-3 flex items-center justify-between border-t border-dashed pt-2 text-base font-bold text-slate-900">
            <span>Tổng</span>
            <span className="text-sky-700">{formatVND(total)}</span>
          </div>

          <input
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="Tên khách (không bắt buộc)"
            className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú"
            className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500"
          />

          <button
            onClick={checkout}
            disabled={saving || Object.keys(cart).length === 0}
            className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : "Chốt đơn"}
          </button>

          {ok && <p className="mt-3 text-sm font-medium text-emerald-600">{ok}</p>}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
      </aside>
    </div>
  );
}

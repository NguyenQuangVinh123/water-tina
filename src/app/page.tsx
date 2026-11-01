"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product, SizeOption } from "@/lib/db";
import { formatVND } from "@/lib/format";
import OrdersPanel from "@/components/OrdersPanel";

/** Chìa khóa dòng giỏ: món + size */
const lineKey = (id: number, size: string | null) => `${id}__${size ?? ""}`;

type CartLine = { product_id: number; size: string | null; qty: number };

/** Chọn emoji theo nhóm/tên món cho sinh động */
function emojiFor(p: Product): string {
  const t = `${p.category || ""} ${p.name}`.toLowerCase();
  if (t.includes("trà sữa")) return "🧋";
  if (t.includes("soda")) return "🥤";
  if (t.includes("sinh tố") || t.includes("smoothie")) return "🥤";
  if (t.includes("ép") || t.includes("nước ép")) return "🧃";
  if (t.includes("cà phê") || t.includes("coffee")) return "☕";
  if (t.includes("trà")) return "🍵";
  if (t.includes("dừa")) return "🥥";
  return "🍹";
}

function priceOf(p: Product, size: string | null): number {
  if (size && Array.isArray(p.sizes)) {
    const s = p.sizes.find((x) => x.name.toLowerCase() === size.toLowerCase());
    if (s) return Number(s.price);
  }
  return Number(p.price);
}

export default function SellPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [customer, setCustomer] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

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
      .catch(() =>
        setError("Không kết nối được database. Kiểm tra DATABASE_URL.")
      )
      .finally(() => setLoaded(true));
  }, []);

  const add = (product_id: number, size: string | null, d: number) =>
    setCart((c) => {
      const key = lineKey(product_id, size);
      const qty = (c[key]?.qty || 0) + d;
      const next = { ...c };
      if (qty <= 0) delete next[key];
      else next[key] = { product_id, size, qty };
      return next;
    });

  const lines = Object.values(cart);
  const cartCount = lines.reduce((s, l) => s + l.qty, 0);

  const total = useMemo(
    () =>
      lines.reduce((s, l) => {
        const p = products.find((x) => x.id === l.product_id);
        return s + (p ? priceOf(p, l.size) * l.qty : 0);
      }, 0),
    [lines, products]
  );

  const qtyOf = (id: number, size: string | null) =>
    cart[lineKey(id, size)]?.qty || 0;

  async function checkout() {
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const items = lines.map((l) => ({
        product_id: l.product_id,
        qty: l.qty,
        size: l.size,
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
      setReloadToken((t) => t + 1);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Menu */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-xl font-extrabold tracking-tight text-slate-800">
              Chọn đồ uống
            </h1>
            <span className="text-sm text-slate-400">{products.length} món</span>
          </div>

          {error && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {!loaded ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-slate-100"
                />
              ))}
            </div>
          ) : products.length === 0 && !error ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center text-sm text-slate-400">
              Chưa có sản phẩm. Vào <b>Sản phẩm</b> (admin) để thêm.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {products.map((p) => {
                const hasSizes = Array.isArray(p.sizes) && p.sizes.length > 0;
                const totalQty = hasSizes
                  ? p.sizes.reduce((s, sz) => s + qtyOf(p.id, sz.name), 0)
                  : qtyOf(p.id, null);
                return (
                  <div
                    key={p.id}
                    className={`group flex flex-col rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
                      totalQty ? "border-sky-400 ring-2 ring-sky-100" : "border-slate-200"
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-50 to-indigo-100 text-2xl">
                        {emojiFor(p)}
                      </div>
                      {totalQty > 0 && (
                        <span className="rounded-full bg-sky-600 px-2 py-0.5 text-xs font-bold text-white">
                          {totalQty}
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-bold leading-tight text-slate-800">
                      {p.name}
                    </div>
                    {p.category && (
                      <div className="text-xs text-slate-400">{p.category}</div>
                    )}

                    {hasSizes ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {p.sizes.map((sz: SizeOption) => {
                          const q = qtyOf(p.id, sz.name);
                          return (
                            <button
                              key={sz.name}
                              onClick={() => add(p.id, sz.name, q ? 1 : 1)}
                              className={`rounded-lg border px-2 py-1 text-xs font-medium transition ${
                                q
                                  ? "border-sky-500 bg-sky-50 text-sky-700"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-sky-300"
                              }`}
                            >
                              {sz.name} · {formatVND(sz.price)}
                              {q > 0 && <span className="ml-1 font-bold">×{q}</span>}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-auto flex items-center justify-between pt-3">
                        <span className="text-sm font-bold text-slate-900">
                          {formatVND(p.price)}
                        </span>
                        {qtyOf(p.id, null) === 0 ? (
                          <button
                            onClick={() => add(p.id, null, 1)}
                            className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-sky-700"
                          >
                            Thêm
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => add(p.id, null, -1)}
                              className="h-7 w-7 rounded-lg bg-slate-100 text-lg leading-none text-slate-600 hover:bg-slate-200"
                            >
                              −
                            </button>
                            <span className="w-5 text-center text-sm font-bold">
                              {qtyOf(p.id, null)}
                            </span>
                            <button
                              onClick={() => add(p.id, null, 1)}
                              className="h-7 w-7 rounded-lg bg-sky-600 text-lg leading-none text-white hover:bg-sky-700"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Giỏ hàng */}
        <aside>
          <div className="sticky top-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-3 text-white">
              <h2 className="font-bold">Giỏ hàng</h2>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
                {cartCount} món
              </span>
            </div>

            <div className="p-4">
              {cartCount === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  Chưa chọn món nào 🙃
                </p>
              ) : (
                <ul className="mb-3 space-y-2 text-sm">
                  {lines.map((l) => {
                    const p = products.find((x) => x.id === l.product_id);
                    if (!p) return null;
                    const unit = priceOf(p, l.size);
                    return (
                      <li
                        key={lineKey(l.product_id, l.size)}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-slate-700">
                            {p.name}
                          </div>
                          {l.size && (
                            <div className="text-xs text-slate-400">
                              Size: {l.size}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => add(l.product_id, l.size, -1)}
                            className="h-6 w-6 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200"
                          >
                            −
                          </button>
                          <span className="w-5 text-center font-bold">{l.qty}</span>
                          <button
                            onClick={() => add(l.product_id, l.size, 1)}
                            className="h-6 w-6 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200"
                          >
                            +
                          </button>
                        </div>
                        <span className="w-20 text-right font-medium text-slate-700">
                          {formatVND(unit * l.qty)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="mb-3 flex items-center justify-between border-t border-dashed pt-3 text-base font-extrabold text-slate-900">
                <span>Tổng</span>
                <span className="text-sky-700">{formatVND(total)}</span>
              </div>

              <input
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="Tên khách (không bắt buộc)"
                className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú"
                className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />

              <button
                onClick={checkout}
                disabled={saving || cartCount === 0}
                className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Đang lưu..." : "Chốt đơn"}
              </button>

              {ok && (
                <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                  {ok}
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>

      <OrdersPanel products={products} reloadToken={reloadToken} />
    </div>
  );
}

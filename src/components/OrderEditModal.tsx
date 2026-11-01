"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/db";
import { adminHeaders } from "@/lib/adminClient";
import { formatVND } from "@/lib/format";

type EditingOrder = {
  id: number;
  customer_name: string | null;
  note: string | null;
  items: { product_id: number; qty: number }[];
};

export default function OrderEditModal({
  order,
  products,
  onClose,
  onSaved,
}: {
  order: EditingOrder;
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [cart, setCart] = useState<Record<number, number>>({});
  const [customer, setCustomer] = useState(order.customer_name || "");
  const [note, setNote] = useState(order.note || "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init: Record<number, number> = {};
    order.items.forEach((it) => (init[it.product_id] = it.qty));
    setCart(init);
  }, [order]);

  const priceOf = (id: number) =>
    Number(products.find((p) => p.id === id)?.price || 0);

  const total = useMemo(
    () =>
      Object.entries(cart).reduce((s, [id, q]) => s + priceOf(Number(id)) * q, 0),
    [cart, products]
  );

  const add = (id: number, d: number) =>
    setCart((c) => {
      const q = (c[id] || 0) + d;
      const next = { ...c };
      if (q <= 0) delete next[id];
      else next[id] = q;
      return next;
    });

  async function save() {
    setSaving(true);
    setError(null);
    const items = Object.entries(cart).map(([product_id, qty]) => ({
      product_id: Number(product_id),
      qty,
    }));
    if (!items.length) {
      setError("Đơn phải có ít nhất 1 món.");
      setSaving(false);
      return;
    }
    const res = await fetch("/api/orders", {
      method: "PUT",
      headers: adminHeaders(),
      body: JSON.stringify({ id: order.id, customer_name: customer, note, items }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data?.error || "Không sửa được đơn");
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Sửa đơn #{order.id}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <input
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          placeholder="Tên khách"
          className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ghi chú"
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />

        <div className="space-y-2">
          {products.map((p) => {
            const q = cart[p.id] || 0;
            return (
              <div key={p.id} className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-700">{p.name}</div>
                  <div className="text-xs text-slate-400">{formatVND(p.price)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => add(p.id, -1)}
                    className="h-7 w-7 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">−</button>
                  <span className="w-5 text-center text-sm font-bold">{q}</span>
                  <button onClick={() => add(p.id, 1)}
                    className="h-7 w-7 rounded-lg bg-sky-600 text-white hover:bg-sky-700">+</button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-dashed pt-3">
          <span className="text-sm font-bold text-slate-800">Tổng: {formatVND(total)}</span>
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Hủy
          </button>
          <button onClick={save} disabled={saving}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </div>
    </div>
  );
}

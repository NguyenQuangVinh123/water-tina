"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product, SizeOption } from "@/lib/db";
import { adminHeaders } from "@/lib/adminClient";
import { formatVND } from "@/lib/format";

const lineKey = (id: number, size: string | null) => `${id}__${size ?? ""}`;
type CartLine = { product_id: number; size: string | null; qty: number };

type EditingOrder = {
  id: number;
  customer_name: string | null;
  note: string | null;
  items: { product_id: number; size: string | null; qty: number }[];
};

function priceOf(p: Product, size: string | null): number {
  if (size && Array.isArray(p.sizes)) {
    const s = p.sizes.find((x) => x.name.toLowerCase() === size.toLowerCase());
    if (s) return Number(s.price);
  }
  return Number(p.price);
}

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
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [customer, setCustomer] = useState(order.customer_name || "");
  const [note, setNote] = useState(order.note || "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init: Record<string, CartLine> = {};
    order.items.forEach((it) => {
      init[lineKey(it.product_id, it.size ?? null)] = {
        product_id: it.product_id,
        size: it.size ?? null,
        qty: it.qty,
      };
    });
    setCart(init);
  }, [order]);

  const add = (product_id: number, size: string | null, d: number) =>
    setCart((c) => {
      const key = lineKey(product_id, size);
      const qty = (c[key]?.qty || 0) + d;
      const next = { ...c };
      if (qty <= 0) delete next[key];
      else next[key] = { product_id, size, qty };
      return next;
    });

  const qtyOf = (id: number, size: string | null) =>
    cart[lineKey(id, size)]?.qty || 0;

  const total = useMemo(
    () =>
      Object.values(cart).reduce((s, l) => {
        const p = products.find((x) => x.id === l.product_id);
        return s + (p ? priceOf(p, l.size) * l.qty : 0);
      }, 0),
    [cart, products]
  );

  async function save() {
    setSaving(true);
    setError(null);
    const items = Object.values(cart).map((l) => ({
      product_id: l.product_id,
      qty: l.qty,
      size: l.size,
    }));
    if (!items.length) {
      setError("Đơn phải có ít nhất 1 món.");
      setSaving(false);
      return;
    }
    const res = await fetch("/api/orders", {
      method: "PUT",
      headers: adminHeaders(),
      body: JSON.stringify({
        id: order.id,
        customer_name: customer,
        note,
        items,
      }),
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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
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

        <div className="space-y-3">
          {products.map((p) => {
            const hasSizes = Array.isArray(p.sizes) && p.sizes.length > 0;
            return (
              <div key={p.id} className="rounded-xl border border-slate-100 p-2">
                <div className="px-1 text-sm font-semibold text-slate-700">
                  {p.name}
                </div>
                <div className="mt-1 space-y-1">
                  {(hasSizes
                    ? p.sizes.map((sz: SizeOption) => ({
                        size: sz.name as string | null,
                        label: `${sz.name} · ${formatVND(sz.price)}`,
                      }))
                    : [
                        {
                          size: null as string | null,
                          label: formatVND(p.price),
                        },
                      ]
                  ).map((row) => {
                    const q = qtyOf(p.id, row.size);
                    return (
                      <div
                        key={row.size ?? "__"}
                        className="flex items-center justify-between"
                      >
                        <span className="text-xs text-slate-500">{row.label}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => add(p.id, row.size, -1)}
                            disabled={!q}
                            className="h-6 w-6 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-30"
                          >
                            −
                          </button>
                          <span className="w-5 text-center text-sm font-bold">{q}</span>
                          <button
                            onClick={() => add(p.id, row.size, 1)}
                            className="h-6 w-6 rounded-md bg-sky-600 text-white hover:bg-sky-700"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-dashed pt-3">
          <span className="text-sm font-bold text-slate-800">
            Tổng: {formatVND(total)}
          </span>
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </div>
    </div>
  );
}

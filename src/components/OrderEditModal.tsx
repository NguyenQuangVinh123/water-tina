"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product, Topping, ToppingSnapshot } from "@/lib/db";
import { adminHeaders } from "@/lib/adminClient";
import { formatVND } from "@/lib/format";

const tkey = (ids: number[]) => [...ids].sort((a, b) => a - b).join(",");
const lineKey = (id: number, size: string | null, toppingIds: number[]) =>
  `${id}__${size ?? ""}__${tkey(toppingIds)}`;

type CartLine = {
  product_id: number;
  size: string | null;
  qty: number;
  topping_ids: number[];
};

type EditingOrder = {
  id: number;
  customer_name: string | null;
  note: string | null;
  items: {
    product_id: number;
    size: string | null;
    toppings?: ToppingSnapshot[];
    qty: number;
  }[];
};

function basePriceOf(p: Product, size: string | null): number {
  if (size && Array.isArray(p.sizes)) {
    const s = p.sizes.find((x) => x.name.toLowerCase() === size.toLowerCase());
    if (s) return Number(s.price);
  }
  return Number(p.price);
}

export default function OrderEditModal({
  order,
  products,
  toppings,
  onClose,
  onSaved,
}: {
  order: EditingOrder;
  products: Product[];
  toppings: Topping[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [customer, setCustomer] = useState(order.customer_name || "");
  const [note, setNote] = useState(order.note || "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toppingById = useMemo(() => {
    const m = new Map<number, Topping>();
    toppings.forEach((t) => m.set(t.id, t));
    return m;
  }, [toppings]);

  useEffect(() => {
    const init: Record<string, CartLine> = {};
    order.items.forEach((it) => {
      const ids = (it.toppings || []).map((t) => Number(t.id));
      init[lineKey(it.product_id, it.size ?? null, ids)] = {
        product_id: it.product_id,
        size: it.size ?? null,
        qty: it.qty,
        topping_ids: ids,
      };
    });
    setCart(init);
  }, [order]);

  // Escape để đóng + khóa scroll nền khi mở modal
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const addQty = (key: string, delta: number) =>
    setCart((c) => {
      const line = c[key];
      if (!line) return c;
      const qty = line.qty + delta;
      const next = { ...c };
      if (qty <= 0) delete next[key];
      else next[key] = { ...line, qty };
      return next;
    });

  const priceOf = (l: CartLine): number => {
    const p = products.find((x) => x.id === l.product_id);
    if (!p) return 0;
    const sum = l.topping_ids.reduce(
      (s, id) => s + Number(toppingById.get(id)?.price || 0),
      0
    );
    return basePriceOf(p, l.size) + sum;
  };

  const total = useMemo(
    () =>
      Object.values(cart).reduce((s, l) => s + priceOf(l) * l.qty, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cart, products, toppings]
  );

  async function save() {
    setSaving(true);
    setError(null);
    const items = Object.values(cart).map((l) => ({
      product_id: l.product_id,
      qty: l.qty,
      size: l.size,
      topping_ids: l.topping_ids,
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-base font-bold text-slate-800">Sửa đơn #{order.id}</h2>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">

        <input
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          placeholder="Tên khách"
          className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-base sm:text-sm"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ghi chú"
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-base sm:text-sm"
        />

        {Object.keys(cart).length === 0 ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Đơn đang trống. Hãy xóa đơn này hoặc thêm món ở trang bán.
          </p>
        ) : (
          <div className="space-y-2">
            {Object.entries(cart).map(([key, l]) => {
              const p = products.find((x) => x.id === l.product_id);
              if (!p) return null;
              const tNames = l.topping_ids
                .map((id) => toppingById.get(id)?.name)
                .filter(Boolean) as string[];
              return (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-xl border border-slate-100 p-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-700">
                      {p.name}
                    </div>
                    {l.size && (
                      <div className="text-xs text-slate-500">
                        Size: {l.size} · {formatVND(basePriceOf(p, l.size))}
                      </div>
                    )}
                    {tNames.length > 0 && (
                      <div className="text-xs text-amber-700">
                        🍮 {tNames.join(", ")}
                      </div>
                    )}
                    <div className="text-xs text-slate-400">
                      Đơn giá: {formatVND(priceOf(l))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => addQty(key, -1)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-xl leading-none text-slate-600 hover:bg-slate-200"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-bold">
                      {l.qty}
                    </span>
                    <button
                      onClick={() => addQty(key, 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600 text-xl leading-none text-white hover:bg-sky-700"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-dashed pt-3">
          <span className="text-sm font-bold text-slate-800">
            Tổng: {formatVND(total)}
          </span>
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-slate-100 p-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 sm:flex-none sm:px-5 sm:py-2"
          >
            Hủy
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50 sm:flex-none sm:px-5 sm:py-2"
          >
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </div>
    </div>
  );
}

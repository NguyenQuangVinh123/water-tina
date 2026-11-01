"use client";

import { useCallback, useEffect, useState } from "react";
import { formatVND, formatDate } from "@/lib/format";
import { getAdminKey, adminHeaders } from "@/lib/adminClient";
import type { Product } from "@/lib/db";
import OrderEditModal from "@/components/OrderEditModal";

type OrderItem = {
  product_id: number;
  name: string;
  qty: number;
  unit_price: number;
};
type Order = {
  id: number;
  customer_name: string | null;
  note: string | null;
  total: number;
  created_at: string;
  items: OrderItem[];
};

export default function OrdersPanel({
  products,
  reloadToken,
}: {
  products: Product[];
  reloadToken: number;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [admin, setAdmin] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => setAdmin(!!getAdminKey()), []);

  const load = useCallback(() => {
    fetch("/api/orders?limit=50")
      .then((r) => r.json())
      .then((d) => (Array.isArray(d) ? setOrders(d) : setError(d?.error)))
      .catch(() => setError("Không tải được đơn hàng"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  async function remove(id: number) {
    if (!confirm(`Xóa đơn #${id}?`)) return;
    setError(null);
    const res = await fetch(`/api/orders?id=${id}`, {
      method: "DELETE",
      headers: adminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) return setError(data?.error || "Không xóa được");
    load();
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-800">Đơn gần đây</h2>
        {orders.length > 0 && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
            {orders.length} đơn
          </span>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Đang tải...</p>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-8 text-center text-sm text-slate-400">
          Chưa có đơn hàng nào.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {orders.map((o) => (
            <div
              key={o.id}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-700">
                    #{o.id}
                  </span>
                  {o.customer_name ? (
                    <span className="text-sm font-medium text-slate-700">
                      {o.customer_name}
                    </span>
                  ) : (
                    <span className="text-sm text-slate-400">Khách lẻ</span>
                  )}
                </div>
                <span className="text-xs text-slate-400">{formatDate(o.created_at)}</span>
              </div>

              {o.note && (
                <p className="mt-1 text-xs italic text-slate-500">📝 {o.note}</p>
              )}

              <ul className="mt-2 flex-1 space-y-0.5 text-sm text-slate-600">
                {o.items.map((it, i) => (
                  <li key={i} className="flex justify-between">
                    <span>
                      {it.name} <span className="text-slate-400">× {it.qty}</span>
                    </span>
                    <span>{formatVND(Number(it.unit_price) * it.qty)}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
                <div className="flex gap-3">
                  {admin && (
                    <>
                      <button
                        onClick={() => setEditing(o)}
                        className="text-sm font-medium text-sky-600 hover:underline"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => remove(o.id)}
                        className="text-sm font-medium text-red-500 hover:underline"
                      >
                        Xóa
                      </button>
                    </>
                  )}
                </div>
                <span className="text-sm font-bold text-slate-900">
                  {formatVND(o.total)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <OrderEditModal
          order={editing}
          products={products}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </section>
  );
}

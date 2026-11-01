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

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [admin, setAdmin] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => setAdmin(!!getAdminKey()), []);

  const load = useCallback(() => {
    fetch("/api/orders?limit=50")
      .then((r) => r.json())
      .then((d) =>
        Array.isArray(d) ? setOrders(d) : setError(d?.error)
      )
      .catch(() => setError("Không tải được đơn hàng"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    // lấy danh sách sản phẩm cho form sửa (chỉ khi cần)
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setProducts(d))
      .catch(() => {});
  }, [load]);

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

  if (loading) return <p className="text-sm text-slate-400">Đang tải...</p>;
  if (error && orders.length === 0)
    return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold text-slate-800">Danh sách đơn hàng</h1>
      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {orders.length === 0 ? (
        <p className="text-sm text-slate-400">Chưa có đơn hàng nào.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800">#{o.id}</span>
                  {o.customer_name && (
                    <span className="ml-2 text-sm text-slate-600">{o.customer_name}</span>
                  )}
                </div>
                <span className="text-sm text-slate-400">{formatDate(o.created_at)}</span>
              </div>
              {o.note && <p className="mt-1 text-xs italic text-slate-500">{o.note}</p>}
              <ul className="mt-2 space-y-0.5 text-sm text-slate-700">
                {o.items.map((it, i) => (
                  <li key={i} className="flex justify-between">
                    <span>
                      {it.name} <span className="text-slate-400">× {it.qty}</span>
                    </span>
                    <span>{formatVND(Number(it.unit_price) * it.qty)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between border-t border-dashed pt-2">
                <div className="flex gap-3">
                  {admin && (
                    <>
                      <button
                        onClick={() => setEditing(o)}
                        className="text-sm text-sky-600 hover:underline"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => remove(o.id)}
                        className="text-sm text-red-500 hover:underline"
                      >
                        Xóa
                      </button>
                    </>
                  )}
                </div>
                <span className="text-sm font-bold text-sky-700">{formatVND(o.total)}</span>
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
    </div>
  );
}

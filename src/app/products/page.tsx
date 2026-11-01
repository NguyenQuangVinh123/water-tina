"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminGuard } from "@/lib/useAdminGuard";
import { adminHeaders } from "@/lib/adminClient";
import { formatVND } from "@/lib/format";
import type { Product } from "@/lib/db";

type Form = { id?: number; name: string; price: string; category: string; is_active: boolean };
const empty: Form = { name: "", price: "", category: "", is_active: true };

export default function ProductsPage() {
  const { ready } = useAdminGuard();
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<Form>(empty);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => (Array.isArray(d) ? setProducts(d) : setError(d?.error)))
      .catch(() => setError("Không tải được sản phẩm. Kiểm tra DATABASE_URL."));
  }, []);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const isEdit = !!form.id;
    const res = await fetch("/api/products", {
      method: isEdit ? "PUT" : "POST",
      headers: adminHeaders(),
      body: JSON.stringify({
        id: form.id,
        name: form.name,
        price: Number(form.price),
        category: form.category,
        is_active: form.is_active,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data?.error || "Lỗi lưu sản phẩm");
    setForm(empty);
    load();
  }

  async function remove(id: number) {
    if (!confirm("Xóa sản phẩm này?")) return;
    setError(null);
    const res = await fetch(`/api/products?id=${id}`, { method: "DELETE", headers: adminHeaders() });
    const data = await res.json();
    if (!res.ok) return setError(data?.error || "Không xóa được (có thể đã có trong đơn hàng)");
    load();
  }

  if (!ready) return <p className="text-sm text-slate-400">Đang kiểm tra quyền admin...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-slate-800">🧋 Quản lý sản phẩm</h1>

      {/* Form thêm / sửa */}
      <form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          {form.id ? `Sửa sản phẩm #${form.id}` : "Thêm sản phẩm mới"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <input
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Tên món" required
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
            placeholder="Giá bán" required
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Nhóm (Trà, Soda...)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-3 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox" checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Đang bán
          </label>
          <button
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            disabled={saving}
          >
            {saving ? "Đang lưu..." : form.id ? "Cập nhật" : "Thêm"}
          </button>
          {form.id && (
            <button type="button" onClick={() => setForm(empty)}
              className="text-sm text-slate-500 hover:underline">
              Hủy sửa
            </button>
          )}
        </div>
      </form>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Danh sách */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Tên</th>
              <th className="px-4 py-2 font-medium">Nhóm</th>
              <th className="px-4 py-2 text-right font-medium">Giá</th>
              <th className="px-4 py-2 text-center font-medium">Trạng thái</th>
              <th className="px-4 py-2 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-medium text-slate-800">{p.name}</td>
                <td className="px-4 py-2 text-slate-500">{p.category || "—"}</td>
                <td className="px-4 py-2 text-right text-slate-700">{formatVND(p.price)}</td>
                <td className="px-4 py-2 text-center">
                  <span className={p.is_active ? "text-emerald-600" : "text-slate-400"}>
                    {p.is_active ? "Đang bán" : "Tạm ngừng"}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => setForm({ id: p.id, name: p.name, price: String(p.price), category: p.category || "", is_active: p.is_active })}
                    className="mr-3 text-sky-600 hover:underline">Sửa</button>
                  <button onClick={() => remove(p.id)} className="text-red-500 hover:underline">Xóa</button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Chưa có sản phẩm.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

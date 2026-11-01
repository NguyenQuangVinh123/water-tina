"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminGuard } from "@/lib/useAdminGuard";
import { adminHeaders } from "@/lib/adminClient";
import { formatVND } from "@/lib/format";
import type { Product, SizeOption } from "@/lib/db";

type Form = {
  id?: number;
  name: string;
  price: string;
  category: string;
  is_active: boolean;
  hasSizes: boolean;
  sizes: SizeOption[];
};
const empty: Form = {
  name: "",
  price: "",
  category: "",
  is_active: true,
  hasSizes: false,
  sizes: [],
};

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
      .catch(() =>
        setError("Không tải được sản phẩm. Kiểm tra DATABASE_URL.")
      );
  }, []);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  // ---- size helpers ----
  const setSize = (i: number, patch: Partial<SizeOption>) =>
    setForm((f) => ({
      ...f,
      sizes: f.sizes.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    }));
  const addSize = () =>
    setForm((f) => ({ ...f, sizes: [...f.sizes, { name: "", price: 0 }] }));
  const delSize = (i: number) =>
    setForm((f) => ({ ...f, sizes: f.sizes.filter((_, idx) => idx !== i) }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanSizes = form.hasSizes
      ? form.sizes
          .map((s) => ({ name: s.name.trim(), price: Number(s.price) }))
          .filter((s) => s.name && Number.isFinite(s.price) && s.price >= 0)
      : [];
    if (form.hasSizes && cleanSizes.length === 0) {
      setError("Món có size cần ít nhất 1 size hợp lệ (tên + giá).");
      return;
    }
    if (!form.hasSizes && !(Number(form.price) >= 0 && form.price !== "")) {
      setError("Cần nhập giá bán (hoặc bật nhiều size).");
      return;
    }

    setSaving(true);
    const isEdit = !!form.id;
    const res = await fetch("/api/products", {
      method: isEdit ? "PUT" : "POST",
      headers: adminHeaders(),
      body: JSON.stringify({
        id: form.id,
        name: form.name,
        price: Number(form.price || 0),
        category: form.category,
        is_active: form.is_active,
        sizes: cleanSizes,
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
    const res = await fetch(`/api/products?id=${id}`, {
      method: "DELETE",
      headers: adminHeaders(),
    });
    const data = await res.json();
    if (!res.ok)
      return setError(
        data?.error || "Không xóa được (có thể đã có trong đơn hàng)"
      );
    load();
  }

  function startEdit(p: Product) {
    const sizes = Array.isArray(p.sizes) ? p.sizes : [];
    setForm({
      id: p.id,
      name: p.name,
      price: String(p.price),
      category: p.category || "",
      is_active: p.is_active,
      hasSizes: sizes.length > 0,
      sizes: sizes.length ? sizes.map((s) => ({ name: s.name, price: Number(s.price) })) : [],
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!ready)
    return <p className="text-sm text-slate-400">Đang kiểm tra quyền admin...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-slate-800">🧋 Quản lý sản phẩm</h1>

      {/* Form thêm / sửa */}
      <form
        onSubmit={save}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          {form.id ? `Sửa sản phẩm #${form.id}` : "Thêm sản phẩm mới"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Tên món"
            required
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
          />
          {!form.hasSizes && (
            <input
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="Giá bán"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          )}
          <input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Nhóm (Trà, Soda...)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        {/* Sizes */}
        <div className="mt-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={form.hasSizes}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  hasSizes: e.target.checked,
                  sizes: e.target.checked && f.sizes.length === 0
                    ? [{ name: "", price: 0 }]
                    : f.sizes,
                }))
              }
            />
            Món này có nhiều size (mỗi size một giá)
          </label>

          {form.hasSizes && (
            <div className="mt-2 space-y-2 rounded-xl bg-slate-50 p-3">
              {form.sizes.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={s.name}
                    onChange={(e) => setSize(i, { name: e.target.value })}
                    placeholder="Tên size (Nhỏ/Lớn...)"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    value={String(s.price)}
                    onChange={(e) => setSize(i, { price: Number(e.target.value) })}
                    placeholder="Giá"
                    className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => delSize(i)}
                    className="rounded-lg px-2 py-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addSize}
                className="text-sm font-medium text-sky-600 hover:underline"
              >
                + Thêm size
              </button>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={form.is_active}
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
            <button
              type="button"
              onClick={() => setForm(empty)}
              className="text-sm text-slate-500 hover:underline"
            >
              Hủy sửa
            </button>
          )}
        </div>
      </form>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

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
            {products.map((p) => {
              const sizes = Array.isArray(p.sizes) ? p.sizes : [];
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-2 text-slate-500">{p.category || "—"}</td>
                  <td className="px-4 py-2 text-right text-slate-700">
                    {sizes.length ? (
                      <div>
                        <div>
                          từ {formatVND(Math.min(...sizes.map((s) => Number(s.price))))}
                        </div>
                        <div className="text-xs text-slate-400">
                          {sizes.map((s) => `${s.name}`).join(" · ")}
                        </div>
                      </div>
                    ) : (
                      formatVND(p.price)
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={p.is_active ? "text-emerald-600" : "text-slate-400"}>
                      {p.is_active ? "Đang bán" : "Tạm ngừng"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => startEdit(p)}
                      className="mr-3 text-sky-600 hover:underline"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => remove(p.id)}
                      className="text-red-500 hover:underline"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Chưa có sản phẩm.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

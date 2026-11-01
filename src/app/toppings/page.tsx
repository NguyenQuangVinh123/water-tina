"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminGuard } from "@/lib/useAdminGuard";
import { adminHeaders } from "@/lib/adminClient";
import { formatVND } from "@/lib/format";
import type { Topping } from "@/lib/db";

type Form = {
  id?: number;
  name: string;
  price: string;
  is_active: boolean;
};
const empty: Form = { name: "", price: "", is_active: true };

export default function ToppingsPage() {
  const { ready } = useAdminGuard();
  const [items, setItems] = useState<Topping[]>([]);
  const [form, setForm] = useState<Form>(empty);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch("/api/toppings")
      .then((r) => r.json())
      .then((d) => (Array.isArray(d) ? setItems(d) : setError(d?.error)))
      .catch(() =>
        setError("Không tải được topping. Kiểm tra DATABASE_URL / migration.")
      );
  }, []);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = form.name.trim();
    const price = Number(form.price);
    if (!name) return setError("Thiếu tên topping.");
    if (!Number.isFinite(price) || price < 0)
      return setError("Giá không hợp lệ.");

    setSaving(true);
    const isEdit = !!form.id;
    const res = await fetch("/api/toppings", {
      method: isEdit ? "PUT" : "POST",
      headers: adminHeaders(),
      body: JSON.stringify({
        id: form.id,
        name,
        price,
        is_active: form.is_active,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data?.error || "Lỗi lưu topping");
    setForm(empty);
    load();
  }

  async function remove(id: number) {
    if (!confirm("Xóa topping này?")) return;
    setError(null);
    const res = await fetch(`/api/toppings?id=${id}`, {
      method: "DELETE",
      headers: adminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) return setError(data?.error || "Không xóa được");
    load();
  }

  if (!ready)
    return <p className="text-sm text-slate-400">Đang kiểm tra quyền admin...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-slate-800">🍮 Quản lý topping</h1>

      {/* Form thêm / sửa */}
      <form
        onSubmit={save}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          {form.id ? `Sửa topping #${form.id}` : "Thêm topping mới"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Tên topping (Trân châu đen, Thạch...)"
            required
            className="rounded-lg border border-slate-300 px-3 py-2 text-base sm:text-sm sm:col-span-2"
          />
          <input
            type="number"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            placeholder="Giá (+)"
            required
            className="rounded-lg border border-slate-300 px-3 py-2 text-base sm:text-sm"
          />
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
            className="min-h-[44px] rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
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
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Tên</th>
              <th className="px-4 py-2 text-right font-medium">Giá</th>
              <th className="px-4 py-2 text-center font-medium">Trạng thái</th>
              <th className="px-4 py-2 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-medium text-slate-800">{t.name}</td>
                <td className="px-4 py-2 text-right text-slate-700">
                  {formatVND(t.price)}
                </td>
                <td className="px-4 py-2 text-center">
                  <span className={t.is_active ? "text-emerald-600" : "text-slate-400"}>
                    {t.is_active ? "Đang bán" : "Tạm ngừng"}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() =>
                        setForm({
                          id: t.id,
                          name: t.name,
                          price: String(t.price),
                          is_active: t.is_active,
                        })
                      }
                      className="min-h-[40px] rounded-lg px-3 py-1.5 text-sm font-medium text-sky-600 hover:bg-sky-50"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => remove(t.id)}
                      className="min-h-[40px] rounded-lg px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50"
                    >
                      Xóa
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  Chưa có topping nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

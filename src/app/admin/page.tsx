"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setAdminKey } from "@/lib/adminClient";

export default function AdminLoginPage() {
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = await res.json();
      if (data.ok) {
        setAdminKey(key);
        router.push("/analytics");
      } else {
        setMsg("Key secret không đúng 😢");
      }
    } catch {
      setMsg("Lỗi kết nối. Thử lại nhé!");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-bold text-slate-800">🔒 Đăng nhập Admin</h1>
        <p className="mb-4 text-sm text-slate-500">
          Nhập key secret để mở trang phân tích & quản lý sản phẩm.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Key secret"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
          <button
            type="submit"
            disabled={loading || !key}
            className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {loading ? "Đang kiểm tra..." : "Đăng nhập"}
          </button>
        </form>
        {msg && <p className="mt-3 text-sm text-red-600">{msg}</p>}
      </div>
    </div>
  );
}

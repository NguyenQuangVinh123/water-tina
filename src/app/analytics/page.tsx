"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminGuard } from "@/lib/useAdminGuard";
import { adminHeaders } from "@/lib/adminClient";
import { formatVND, formatDate } from "@/lib/format";

type TopSeller = { id: number; name: string; qty_sold: number; revenue: number };
type Daily = { day: string; revenue: number };
type Expense = { id: number; amount: number; description: string | null; date: string };
type Stats = {
  revenue: number;
  orderCount: number;
  expenses: number;
  profit: number;
  topSellers: TopSeller[];
  daily: Daily[];
};

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function AnalyticsPage() {
  const { ready } = useAdminGuard();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [error, setError] = useState<string | null>(null);

  // form chi tiêu
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, e] = await Promise.all([
        fetch(`/api/analytics?from=${from}&to=${to}`).then((r) => r.json()),
        fetch("/api/expenses").then((r) => r.json()),
      ]);
      if (s.error) throw new Error(s.error);
      setStats(s);
      setExpenses(Array.isArray(e) ? e : []);
    } catch (err: any) {
      setError(err.message);
    }
  }, [from, to]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  // Đặt khoảng ngày mặc định (7 ngày gần nhất) sau khi mount,
  // tránh tính Date khi prerender trang client.
  useEffect(() => {
    const now = new Date();
    setTo(isoDay(now));
    setFrom(isoDay(new Date(now.getTime() - 6 * 864e5)));
  }, []);

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!amount) return;
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ amount: Number(amount), description: desc }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data?.error || "Lỗi");
    setAmount("");
    setDesc("");
    load();
  }

  async function delExpense(id: number) {
    await fetch(`/api/expenses?id=${id}`, { method: "DELETE", headers: adminHeaders() });
    load();
  }

  if (!ready) return <p className="text-sm text-slate-400">Đang kiểm tra quyền admin...</p>;

  const maxDaily = Math.max(1, ...(stats?.daily.map((d) => d.revenue) || [1]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-lg font-bold text-slate-800">📊 Phân tích doanh thu</h1>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1" />
          <span className="text-slate-400">→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1" />
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Thẻ tổng quan */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Doanh thu" value={stats ? formatVND(stats.revenue) : "—"} tone="sky" />
        <Card label="Số đơn" value={stats ? String(stats.orderCount) : "—"} tone="slate" />
        <Card label="Chi tiêu" value={stats ? formatVND(stats.expenses) : "—"} tone="amber" />
        <Card
          label="Lợi nhuận"
          value={stats ? formatVND(stats.profit) : "—"}
          tone={stats && stats.profit >= 0 ? "emerald" : "red"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top sellers */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-800">Loại nước bán chạy</h2>
          {!stats || stats.topSellers.length === 0 ? (
            <p className="text-sm text-slate-400">Chưa có dữ liệu bán.</p>
          ) : (
            <ul className="space-y-2">
              {stats.topSellers.map((t, i) => (
                <li key={t.id} className="flex items-center gap-3">
                  <span className="w-5 text-center text-sm font-bold text-slate-400">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-700">{t.name}</span>
                      <span className="text-slate-500">{t.qty_sold} ly</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-sky-500"
                        style={{ width: `${(t.qty_sold / stats.topSellers[0].qty_sold) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-20 text-right text-xs text-slate-500">{formatVND(t.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Doanh thu theo ngày */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-800">Doanh thu theo ngày</h2>
          {!stats || stats.daily.length === 0 ? (
            <p className="text-sm text-slate-400">Chưa có dữ liệu.</p>
          ) : (
            <div className="flex items-end gap-1">
              {stats.daily.map((d) => {
                const pct = Math.max(2, (d.revenue / maxDaily) * 100);
                return (
                  <div
                    key={d.day}
                    className="flex flex-1 flex-col items-center gap-1"
                    title={`${d.day}: ${formatVND(d.revenue)}`}
                  >
                    <div className="flex h-32 w-full items-end">
                      <div
                        className="w-full rounded-t bg-sky-500/80"
                        style={{
                          height: `${pct}%`,
                          opacity: d.revenue > 0 ? 1 : 0.25,
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {d.day.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Chi tiêu */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-800">Nhập chi tiêu</h2>
        <form onSubmit={addExpense} className="mb-4 flex flex-wrap gap-2">
          <input
            type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="Số tiền" className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={desc} onChange={(e) => setDesc(e.target.value)}
            placeholder="Nội dung (tiền điện, nguyên liệu...)"
            className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">
            + Thêm
          </button>
        </form>
        {expenses.length === 0 ? (
          <p className="text-sm text-slate-400">Chưa có khoản chi nào.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {expenses.map((x) => (
              <li key={x.id} className="flex items-center justify-between py-2">
                <span className="text-slate-700">{x.description || "Chi tiêu"}</span>
                <span className="flex items-center gap-3">
                  <span className="text-slate-400">{formatDate(x.date)}</span>
                  <span className="font-medium text-amber-700">{formatVND(x.amount)}</span>
                  <button onClick={() => delExpense(x.id)} className="text-slate-400 hover:text-red-500">✕</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const tones: Record<string, string> = {
  sky: "text-sky-700",
  slate: "text-slate-700",
  amber: "text-amber-700",
  emerald: "text-emerald-700",
  red: "text-red-700",
};

function Card({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-xl font-bold ${tones[tone] || tones.slate}`}>{value}</div>
    </div>
  );
}

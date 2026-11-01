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
  compare: {
    range: { from: string; to: string };
    revenue: number;
    orderCount: number;
    expenses: number;
    profit: number;
  } | null;
};

function isoDay(d: Date) {
  // Định dạng theo ngày LOCAL (tránh dùng UTC rơi trước 7h sáng VN -> nhầm sang hôm trước)
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** `n` ngày trước so với hiện tại, theo lịch local */
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDay(d);
}

/** % thay đổi so với kỳ trước; null khi kỳ trước = 0 (không có cơ sở so) */
function pct(cur: number, prev: number): number | null {
  if (!prev) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

/** Giá trị ngắn gọn cho nhãn cột: 542 -> "542", 15000 -> "15K", 1200000 -> "1,2TR" */
function shortVND(n: number): string {
  if (n <= 0) return "0";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m % 1 === 0 ? m : m.toFixed(1).replace(".", ",")}TR`;
  }
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(Math.round(n));
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
  const cmp = stats?.compare || null;

  // Nút chọn nhanh khoảng ngày (theo lịch local VN)
  const presets = [
    { label: "Hôm nay", run: () => { const t = isoDay(new Date()); setFrom(t); setTo(t); } },
    { label: "7 ngày", run: () => { setFrom(daysAgo(6)); setTo(isoDay(new Date())); } },
    {
      label: "Tháng này",
      run: () => {
        const n = new Date();
        setFrom(isoDay(new Date(n.getFullYear(), n.getMonth(), 1)));
        setTo(isoDay(n));
      },
    },
    { label: "Tất cả", run: () => { setFrom(""); setTo(""); } },
  ];
  const presetCls =
    "shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-sky-300 hover:text-sky-700";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-lg font-bold text-slate-800">📊 Phân tích doanh thu</h1>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Từ ngày"
            className="min-h-[40px] rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
          <span className="text-slate-400">→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Đến ngày"
            className="min-h-[40px] rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button key={p.label} onClick={p.run} className={presetCls}>
            {p.label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Thẻ tổng quan */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card
          label="Doanh thu"
          value={stats ? formatVND(stats.revenue) : "—"}
          tone="sky"
          delta={stats && cmp ? pct(stats.revenue, cmp.revenue) : null}
          higherIsGood
          prevLabel={cmp ? `Kỳ trước: ${formatVND(cmp.revenue)}` : undefined}
        />
        <Card
          label="Số đơn"
          value={stats ? String(stats.orderCount) : "—"}
          tone="slate"
          delta={stats && cmp ? pct(stats.orderCount, cmp.orderCount) : null}
          higherIsGood
          prevLabel={cmp ? `Kỳ trước: ${cmp.orderCount} đơn` : undefined}
        />
        <Card
          label="Chi tiêu"
          value={stats ? formatVND(stats.expenses) : "—"}
          tone="amber"
          delta={stats && cmp ? pct(stats.expenses, cmp.expenses) : null}
          higherIsGood={false}
          prevLabel={cmp ? `Kỳ trước: ${formatVND(cmp.expenses)}` : undefined}
        />
        <Card
          label="Lợi nhuận"
          value={stats ? formatVND(stats.profit) : "—"}
          tone={stats && stats.profit >= 0 ? "emerald" : "red"}
          delta={
            stats && cmp && (cmp.profit > 0 || stats.profit !== cmp.profit)
              ? pct(stats.profit, cmp.profit)
              : null
          }
          higherIsGood
          prevLabel={cmp ? `Kỳ trước: ${formatVND(cmp.profit)}` : undefined}
        />
      </div>
      {cmp && (
        <p className="-mt-3 text-xs text-slate-400">
          So với kỳ trước ({cmp.range.from} → {cmp.range.to})
        </p>
      )}

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
          <h2 className="mb-1 flex items-baseline justify-between font-semibold text-slate-800">
            <span>Doanh thu theo ngày</span>
            {stats && (
              <span className="text-sm font-bold text-sky-700">
                {formatVND(stats.revenue)} · {stats.orderCount} đơn
              </span>
            )}
          </h2>
          {!stats || stats.daily.length === 0 ? (
            <p className="text-sm text-slate-400">Chưa có dữ liệu.</p>
          ) : (
            <div className="flex items-end gap-1">
              {stats.daily.map((d) => {
                const pct = Math.max(2, (d.revenue / maxDaily) * 100);
                return (
                  <div
                    key={d.day}
                    className="flex flex-1 flex-col items-center justify-end gap-0.5"
                    title={`${d.day}: ${formatVND(d.revenue)}`}
                  >
                    <span
                      className={`text-[9px] font-semibold leading-none sm:text-[10px] ${
                        d.revenue > 0 ? "text-sky-700" : "text-slate-300"
                      }`}
                    >
                      {shortVND(d.revenue)}
                    </span>
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
            placeholder="Số tiền" inputMode="numeric"
            className="w-32 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-base sm:flex-none sm:w-40 sm:py-2 sm:text-sm"
          />
          <input
            value={desc} onChange={(e) => setDesc(e.target.value)}
            placeholder="Nội dung (tiền điện, nguyên liệu...)"
            className="min-w-0 flex-[2] rounded-lg border border-slate-300 px-3 py-2.5 text-base sm:flex-1 sm:py-2 sm:text-sm"
          />
          <button className="min-h-[44px] w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 sm:w-auto">
            + Thêm
          </button>
        </form>
        {expenses.length === 0 ? (
          <p className="text-sm text-slate-400">Chưa có khoản chi nào.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {expenses.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0 flex-1 truncate text-slate-700">{x.description || "Chi tiêu"}</span>
                <span className="flex shrink-0 items-center gap-2 sm:gap-3">
                  <span className="text-xs text-slate-400 sm:text-sm">{formatDate(x.date)}</span>
                  <span className="font-medium text-amber-700">{formatVND(x.amount)}</span>
                  <button onClick={() => delExpense(x.id)} aria-label="Xóa khoản chi"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500">✕</button>
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

function Card({
  label,
  value,
  tone,
  delta,
  higherIsGood = true,
  prevLabel,
}: {
  label: string;
  value: string;
  tone: string;
  delta?: number | null;
  higherIsGood?: boolean;
  prevLabel?: string;
}) {
  const up = (delta ?? 0) > 0;
  const good = up === higherIsGood;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-xl font-bold ${tones[tone] || tones.slate}`}>{value}</div>
      {delta != null && (
        <div
          className={`mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
            good ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
          }`}
          title={prevLabel}
        >
          {up ? "▲" : "▼"} {Math.abs(delta).toFixed(delta < -10 || delta > 10 ? 0 : 1)}%
        </div>
      )}
    </div>
  );
}

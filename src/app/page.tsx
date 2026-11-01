"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product, SizeOption, Topping } from "@/lib/db";
import { formatVND } from "@/lib/format";
import OrdersPanel from "@/components/OrdersPanel";
import ItemPickerModal, { type PickedLine } from "@/components/ItemPickerModal";

/** Chìa khóa dòng giỏ: món + size + tập topping (đã sort để nhất quán) */
const tkey = (ids: number[]) => [...ids].sort((a, b) => a - b).join(",");
const lineKey = (id: number, size: string | null, toppingIds: number[]) =>
  `${id}__${size ?? ""}__${tkey(toppingIds)}`;

type CartLine = {
  product_id: number;
  size: string | null;
  qty: number;
  topping_ids: number[];
};

/** Chọn emoji theo nhóm/tên món cho sinh động */
function emojiFor(p: Product): string {
  const t = `${p.category || ""} ${p.name}`.toLowerCase();
  if (t.includes("trà sữa")) return "🧋";
  if (t.includes("soda")) return "🥤";
  if (t.includes("sinh tố") || t.includes("smoothie")) return "🥤";
  if (t.includes("ép") || t.includes("nước ép")) return "🧃";
  if (t.includes("cà phê") || t.includes("coffee")) return "☕";
  if (t.includes("trà")) return "🍵";
  if (t.includes("dừa")) return "🥥";
  return "🍹";
}

function basePriceOf(p: Product, size: string | null): number {
  if (size && Array.isArray(p.sizes)) {
    const s = p.sizes.find((x) => x.name.toLowerCase() === size.toLowerCase());
    if (s) return Number(s.price);
  }
  return Number(p.price);
}

export default function SellPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [toppings, setToppings] = useState<Topping[]>([]);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [picker, setPicker] = useState<Product | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/products").then((r) => r.json()),
      fetch("/api/toppings").then((r) => r.json()),
    ])
      .then(([pData, tData]) => {
        if (Array.isArray(pData)) {
          setProducts(pData.filter((p: Product) => p.is_active));
        } else {
          setError(pData?.error || "Không tải được sản phẩm");
        }
        if (Array.isArray(tData)) {
          setToppings(tData.filter((t: Topping) => t.is_active));
        }
      })
      .catch(() =>
        setError("Không kết nối được database. Kiểm tra DATABASE_URL.")
      )
      .finally(() => setLoaded(true));
  }, []);

  // Khóa scroll nền khi mở bottom sheet giỏ hàng (mobile)
  useEffect(() => {
    if (!mobileCartOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const h = (e: KeyboardEvent) => e.key === "Escape" && setMobileCartOpen(false);
    window.addEventListener("keydown", h);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", h);
    };
  }, [mobileCartOpen]);

  // map nhanh tra topping theo id
  const toppingById = useMemo(() => {
    const m = new Map<number, Topping>();
    toppings.forEach((t) => m.set(t.id, t));
    return m;
  }, [toppings]);

  const priceOfLine = (l: CartLine): number => {
    const p = products.find((x) => x.id === l.product_id);
    if (!p) return 0;
    const base = basePriceOf(p, l.size);
    const sum = l.topping_ids.reduce(
      (s, id) => s + Number(toppingById.get(id)?.price || 0),
      0
    );
    return base + sum;
  };

  /** Cộng/trừ 1 đơn vị tại dòng (product + size + topping combo) */
  const add = (
    product_id: number,
    size: string | null,
    topping_ids: number[],
    d: number
  ) =>
    setCart((c) => {
      const key = lineKey(product_id, size, topping_ids);
      const qty = (c[key]?.qty || 0) + d;
      const next = { ...c };
      if (qty <= 0) delete next[key];
      else
        next[key] = {
          product_id,
          size,
          qty,
          topping_ids: [...topping_ids].sort((a, b) => a - b),
        };
      return next;
    });

  const onPick = (line: PickedLine) =>
    add(line.product_id, line.size, line.topping_ids, line.qty);

  const lines = Object.values(cart);
  const cartCount = lines.reduce((s, l) => s + l.qty, 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q
      ? products
      : products.filter((p) => {
          const hay = `${p.name} ${p.category || ""}`.toLowerCase();
          return hay.includes(q);
        });
    // Sắp xếp: món bán chạy (30 ngày) lên đầu, bằng nhau thì theo tên
    return [...list].sort(
      (a, b) =>
        (b.sold_count || 0) - (a.sold_count || 0) ||
        a.name.localeCompare(b.name, "vi")
    );
  }, [products, query]);

  const total = useMemo(
    () => lines.reduce((s, l) => s + priceOfLine(l) * l.qty, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, products, toppings]
  );

  const qtyOfQuick = (id: number, size: string | null) =>
    cart[lineKey(id, size, [])]?.qty || 0;

  async function checkout() {
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const items = lines.map((l) => ({
        product_id: l.product_id,
        qty: l.qty,
        size: l.size,
        topping_ids: l.topping_ids,
      }));
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note, items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Tạo đơn thất bại");
      setOk(`✔ Đã tạo đơn #${data.id} · ${formatVND(data.total)}`);
      setCart({});
      setNote("");
      setReloadToken((t) => t + 1);
      setMobileCartOpen(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8 pb-24 lg:pb-0">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Menu */}
        <section className="flex min-w-0 flex-col">
          <div className="mb-3">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-slate-800">
                Chọn đồ uống
              </h1>
              <span className="shrink-0 text-sm text-slate-400">
                {filtered.length} món
              </span>
            </div>
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                🔍
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm món..."
                className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-base outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 sm:py-1.5 sm:text-sm"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Xóa tìm kiếm"
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {error && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {!loaded ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-slate-100"
                />
              ))}
            </div>
          ) : products.length === 0 && !error ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center text-sm text-slate-400">
              Chưa có sản phẩm. Vào <b>Sản phẩm</b> (admin) để thêm.
            </div>
          ) : (
            <div className="lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto lg:pr-1">
              {filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center text-sm text-slate-400">
                  Không tìm thấy món nào khớp "{query}".
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {filtered.map((p) => {
                    const hasSizes =
                      Array.isArray(p.sizes) && p.sizes.length > 0;
                    // tổng qty của món (mọi size + combo, bao gồm cả quick-add không topping)
                    const totalQty = Object.values(cart).reduce(
                      (s, l) => (l.product_id === p.id ? s + l.qty : s),
                      0
                    );
                    return (
                      <div
                        key={p.id}
                        className={`group flex flex-col rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
                          totalQty
                            ? "border-sky-400 ring-2 ring-sky-100"
                            : "border-slate-200"
                        }`}
                      >
                        <div className="mb-2 flex items-start justify-between">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-50 to-indigo-100 text-2xl">
                            {emojiFor(p)}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {totalQty > 0 && (
                              <span className="rounded-full bg-sky-600 px-2 py-0.5 text-xs font-bold text-white">
                                {totalQty}
                              </span>
                            )}
                            {(p.sold_count || 0) > 0 && (
                              <span
                                className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
                                title={`Đã bán ${p.sold_count} ly trong 30 ngày`}
                              >
                                🔥 {p.sold_count}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-sm font-bold leading-tight text-slate-800">
                          {p.name}
                        </div>
                        {p.category && (
                          <div className="text-xs text-slate-400">
                            {p.category}
                          </div>
                        )}

                        {/* Cụm hành động: ghim đáy card, khoảng cách giữa các nút đều nhau */}
                        <div className="mt-auto space-y-2.5 pt-3">
                          {hasSizes ? (
                            <div className="space-y-1.5">
                              {p.sizes.map((sz: SizeOption) => {
                                const q = qtyOfQuick(p.id, sz.name);
                                return (
                                  <button
                                    key={sz.name}
                                    onClick={() => add(p.id, sz.name, [], 1)}
                                    className={`flex min-h-[40px] w-full items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition ${
                                      q
                                        ? "border-sky-500 bg-sky-50 text-sky-700"
                                        : "border-slate-200 bg-white text-slate-600 hover:border-sky-300"
                                    }`}
                                  >
                                    <span className="flex items-center gap-1.5">
                                      {sz.name}
                                      {q > 0 && (
                                        <span className="rounded-full bg-sky-600 px-1.5 text-[11px] font-bold leading-4 text-white">
                                          {q}
                                        </span>
                                      )}
                                    </span>
                                    <span className="font-bold">
                                      {formatVND(sz.price)}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-slate-900">
                                {formatVND(p.price)}
                              </span>
                              {qtyOfQuick(p.id, null) === 0 ? (
                                <button
                                  onClick={() => add(p.id, null, [], 1)}
                                  className="min-h-[40px] rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                                >
                                  Thêm
                                </button>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => add(p.id, null, [], -1)}
                                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-xl leading-none text-slate-600 hover:bg-slate-200"
                                  >
                                    −
                                  </button>
                                  <span className="w-6 text-center text-sm font-bold">
                                    {qtyOfQuick(p.id, null)}
                                  </span>
                                  <button
                                    onClick={() => add(p.id, null, [], 1)}
                                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600 text-xl leading-none text-white hover:bg-sky-700"
                                  >
                                    +
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {toppings.length > 0 && (
                            <button
                              onClick={() => setPicker(p)}
                              className="flex min-h-[40px] w-full items-center justify-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                            >
                              🍮 Thêm topping
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Giỏ hàng (desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-3 text-white">
              <h2 className="font-bold">Giỏ hàng</h2>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
                {cartCount} món
              </span>
            </div>

            <div className="p-4">
              {cartCount === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  Chưa chọn món nào 🙃
                </p>
              ) : (
                <ul className="mb-3 space-y-2 text-sm">
                  {lines.map((l) => {
                    const p = products.find((x) => x.id === l.product_id);
                    if (!p) return null;
                    const unit = priceOfLine(l);
                    const tNames = l.topping_ids
                      .map((id) => toppingById.get(id)?.name)
                      .filter(Boolean) as string[];
                    return (
                      <li
                        key={lineKey(l.product_id, l.size, l.topping_ids)}
                        className="flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-slate-700">
                            {p.name}
                          </div>
                          {l.size && (
                            <div className="text-xs text-slate-400">
                              Size: {l.size}
                            </div>
                          )}
                          {tNames.length > 0 && (
                            <div className="text-xs text-amber-700">
                              🍮 {tNames.join(", ")}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => add(l.product_id, l.size, l.topping_ids, -1)}
                            className="h-6 w-6 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200"
                          >
                            −
                          </button>
                          <span className="w-5 text-center font-bold">{l.qty}</span>
                          <button
                            onClick={() => add(l.product_id, l.size, l.topping_ids, 1)}
                            className="h-6 w-6 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200"
                          >
                            +
                          </button>
                        </div>
                        <span className="w-20 text-right font-medium text-slate-700">
                          {formatVND(unit * l.qty)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="mb-3 flex items-center justify-between border-t border-dashed pt-3 text-base font-extrabold text-slate-900">
                <span>Tổng</span>
                <span className="text-sky-700">{formatVND(total)}</span>
              </div>

              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú"
                className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 sm:text-sm"
              />

              <button
                onClick={checkout}
                disabled={saving || cartCount === 0}
                className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Đang lưu..." : "Chốt đơn"}
              </button>

              {ok && (
                <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                  {ok}
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>

      <OrdersPanel
        products={products}
        toppings={toppings}
        reloadToken={reloadToken}
      />

      {/* Nút giỏ hàng nổi (mobile) */}
      <button
        onClick={() => setMobileCartOpen(true)}
        className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-between rounded-2xl bg-sky-600 px-4 py-3 text-white shadow-xl transition active:scale-[.99] lg:hidden"
      >
        <span className="flex items-center gap-2 text-sm font-bold">
          <span className="text-lg">🛒</span>
          Giỏ hàng
          {cartCount > 0 && (
            <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-semibold">
              {cartCount} món
            </span>
          )}
        </span>
        <span className="text-base font-extrabold">{formatVND(total)}</span>
      </button>

      {/* Bottom sheet giỏ hàng (mobile) */}
      {mobileCartOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setMobileCartOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-3 text-white">
              <h2 className="font-bold">Giỏ hàng</h2>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
                  {cartCount} món
                </span>
                <button
                  onClick={() => setMobileCartOpen(false)}
                  aria-label="Đóng"
                  className="rounded-full p-1 text-white/90 hover:bg-white/20"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {cartCount === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  Chưa chọn món nào 🙃
                </p>
              ) : (
                <ul className="mb-3 space-y-2 text-sm">
                  {lines.map((l) => {
                    const p = products.find((x) => x.id === l.product_id);
                    if (!p) return null;
                    const unit = priceOfLine(l);
                    const tNames = l.topping_ids
                      .map((id) => toppingById.get(id)?.name)
                      .filter(Boolean) as string[];
                    return (
                      <li
                        key={lineKey(l.product_id, l.size, l.topping_ids)}
                        className="flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-slate-700">
                            {p.name}
                          </div>
                          {l.size && (
                            <div className="text-xs text-slate-400">
                              Size: {l.size}
                            </div>
                          )}
                          {tNames.length > 0 && (
                            <div className="text-xs text-amber-700">
                              🍮 {tNames.join(", ")}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              add(l.product_id, l.size, l.topping_ids, -1)
                            }
                            className="h-6 w-6 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200"
                          >
                            −
                          </button>
                          <span className="w-5 text-center font-bold">{l.qty}</span>
                          <button
                            onClick={() =>
                              add(l.product_id, l.size, l.topping_ids, 1)
                            }
                            className="h-6 w-6 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200"
                          >
                            +
                          </button>
                        </div>
                        <span className="w-20 text-right font-medium text-slate-700">
                          {formatVND(unit * l.qty)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="mb-3 flex items-center justify-between border-t border-dashed pt-3 text-base font-extrabold text-slate-900">
                <span>Tổng</span>
                <span className="text-sky-700">{formatVND(total)}</span>
              </div>

              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú"
                className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 sm:text-sm"
              />

              {ok && (
                <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                  {ok}
                </p>
              )}
            </div>

            <div className="border-t border-slate-100 p-4">
              <button
                onClick={checkout}
                disabled={saving || cartCount === 0}
                className="w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Đang lưu..." : `Chốt đơn · ${formatVND(total)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {picker && (
        <ItemPickerModal
          product={picker}
          toppings={toppings}
          onClose={() => setPicker(null)}
          onConfirm={onPick}
        />
      )}
    </div>
  );
}

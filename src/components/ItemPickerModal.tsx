"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product, SizeOption, Topping } from "@/lib/db";
import { formatVND } from "@/lib/format";

export type PickedLine = {
  product_id: number;
  size: string | null;
  qty: number;
  topping_ids: number[];
};

export default function ItemPickerModal({
  product,
  toppings,
  initial,
  onClose,
  onConfirm,
}: {
  product: Product;
  toppings: Topping[];
  initial?: Partial<PickedLine>;
  onClose: () => void;
  onConfirm: (line: PickedLine) => void;
}) {
  const hasSizes = Array.isArray(product.sizes) && product.sizes.length > 0;
  const [size, setSize] = useState<string | null>(initial?.size ?? null);
  const [selected, setSelected] = useState<Set<number>>(
    new Set(initial?.topping_ids ?? [])
  );
  const [qty, setQty] = useState<number>(initial?.qty ?? 1);
  const [error, setError] = useState<string | null>(null);

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

  const basePrice = useMemo(() => {
    if (hasSizes) {
      const s = (product.sizes as SizeOption[]).find((x) => x.name === size);
      return s ? Number(s.price) : 0;
    }
    return Number(product.price);
  }, [hasSizes, product, size]);

  const toppingSum = useMemo(
    () =>
      toppings
        .filter((t) => selected.has(t.id))
        .reduce((s, t) => s + Number(t.price), 0),
    [toppings, selected]
  );

  const unit = basePrice + toppingSum;
  const total = unit * qty;

  const toggleTopping = (id: number) =>
    setSelected((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const confirm = () => {
    if (hasSizes && !size) {
      setError("Chọn size trước đã.");
      return;
    }
    onConfirm({ product_id: product.id, size, qty, topping_ids: [...selected] });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (sticky) */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="text-base font-bold text-slate-800">
            {product.name}
            {product.category && (
              <span className="ml-2 text-xs font-normal text-slate-400">
                {product.category}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Body (scroll) */}
        <div className="flex-1 overflow-y-auto p-4">
          {hasSizes && (
            <div className="mb-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Size *
              </div>
              <div className="flex flex-wrap gap-2">
                {(product.sizes as SizeOption[]).map((s) => {
                  const on = size === s.name;
                  return (
                    <button
                      key={s.name}
                      onClick={() => {
                        setSize(s.name);
                        setError(null);
                      }}
                      className={`min-h-[44px] rounded-xl border px-4 py-2 text-sm font-medium transition ${
                        on
                          ? "border-sky-500 bg-sky-50 text-sky-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-sky-300"
                      }`}
                    >
                      {s.name} · {formatVND(s.price)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {toppings.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Topping (chọn nhiều được)
              </div>
              <div className="grid grid-cols-2 gap-2">
                {toppings.map((t) => {
                  const on = selected.has(t.id);
                  return (
                    <button
                      key={t.id}
                      title={t.name}
                      onClick={() => toggleTopping(t.id)}
                      className={`flex min-h-[48px] items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm font-medium transition ${
                        on
                          ? "border-amber-500 bg-amber-50 text-amber-800"
                          : "border-slate-200 bg-white text-slate-600 hover:border-amber-300"
                      }`}
                    >
                      <span className="line-clamp-2">{t.name}</span>
                      <span className="shrink-0 text-xs opacity-80">
                        +{formatVND(t.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mb-4 flex items-center justify-between rounded-xl bg-slate-50 p-2">
            <span className="text-sm font-semibold text-slate-600">
              Số lượng
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-xl font-bold text-slate-600 shadow-sm hover:bg-slate-100"
              >
                −
              </button>
              <span className="w-8 text-center text-base font-bold">{qty}</span>
              <button
                onClick={() => setQty((q) => q + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-600 text-xl font-bold text-white shadow-sm hover:bg-sky-700"
              >
                +
              </button>
            </div>
          </div>

          {error && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="rounded-xl border border-dashed border-slate-200 p-3 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Đơn giá</span>
              <span>{formatVND(unit)}</span>
            </div>
            {toppingSum > 0 && (
              <div className="flex justify-between text-[11px] text-amber-700">
                <span>Đã gồm topping</span>
                <span>+ {formatVND(toppingSum)}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between border-t border-slate-100 pt-1 text-base font-extrabold text-slate-800">
              <span>Tạm tính</span>
              <span className="text-sky-700">{formatVND(total)}</span>
            </div>
          </div>
        </div>

        {/* Footer (sticky) */}
        <div className="flex shrink-0 gap-2 border-t border-slate-100 p-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 sm:flex-none"
          >
            Hủy
          </button>
          <button
            onClick={confirm}
            disabled={hasSizes && !size}
            className="flex-1 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
          >
            Thêm vào giỏ
          </button>
        </div>
      </div>
    </div>
  );
}

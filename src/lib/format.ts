/** Định dạng số thành VNĐ */
export function formatVND(n: number | string): string {
  const v = Number(n) || 0;
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(v);
}

/** Định dạng ngày ISO -> dd/MM/yyyy HH:mm */
export function formatDate(s: string): string {
  const d = new Date(s);
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

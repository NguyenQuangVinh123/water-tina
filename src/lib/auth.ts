import { timingSafeEqual } from "node:crypto";

/** Key secret admin — cấu hình qua biến môi trường ADMIN_SECRET */
export const ADMIN_SECRET = () => process.env.ADMIN_SECRET || "";

function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/** Kiểm tra key secret có khớp ADMIN_SECRET không */
export function isValidAdminKey(key: string | null | undefined): boolean {
  return safeEqual(key || "", ADMIN_SECRET());
}

/**
 * Dùng trong API route để chặn thao tác cần admin.
 * Đọc key từ header `x-admin-key` (frontend gửi kèm khi đã đăng nhập admin).
 */
export function requireAdmin(request: Request): boolean {
  const key = request.headers.get("x-admin-key");
  return isValidAdminKey(key);
}

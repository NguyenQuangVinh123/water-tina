"use client";

const KEY = "watertina_admin_key";

/** Đọc key secret admin đã lưu trong localStorage */
export function getAdminKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

/** Lưu key khi đăng nhập admin thành công */
export function setAdminKey(key: string) {
  localStorage.setItem(KEY, key);
}

/** Xóa trạng thái admin (đăng xuất) */
export function clearAdminKey() {
  localStorage.removeItem(KEY);
}

/** Đã phải admin chưa? */
export function isAdmin(): boolean {
  return !!getAdminKey();
}

/** Header kèm key admin cho các request cần quyền */
export function adminHeaders(extra: Record<string, string> = {}): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(getAdminKey() ? { "x-admin-key": getAdminKey()! } : {}),
    ...extra,
  };
}

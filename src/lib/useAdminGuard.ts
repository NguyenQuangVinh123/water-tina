"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAdminKey } from "@/lib/adminClient";

/**
 * Chặn trang chỉ dành cho admin (phía client).
 * Trả về true khi đã xác nhận là admin, key hiện tại để gửi kèm API.
 * Nếu chưa có key -> tự chuyển về /admin.
 */
export function useAdminGuard(): { ready: boolean; key: string | null } {
  const router = useRouter();
  const [state, setState] = useState<{ ready: boolean; key: string | null }>({
    ready: false,
    key: null,
  });

  useEffect(() => {
    const key = getAdminKey();
    if (!key) {
      router.replace("/admin");
    } else {
      setState({ ready: true, key });
    }
  }, [router]);

  return state;
}

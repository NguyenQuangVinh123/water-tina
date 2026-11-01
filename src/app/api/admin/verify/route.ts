import { NextResponse } from "next/server";
import { isValidAdminKey } from "@/lib/auth";

/** POST /api/admin/verify  body: { key } -> { ok: boolean } */
export async function POST(request: Request) {
  const { key } = await request.json().catch(() => ({ key: null }));
  const ok = isValidAdminKey(key);
  return NextResponse.json(
    { ok },
    { status: ok ? 200 : 401 }
  );
}

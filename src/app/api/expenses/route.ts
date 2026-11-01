import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/** GET /api/expenses -> danh sách khoản chi */
export async function GET() {
  try {
    const sql = getSql();
    const rows = await sql.query(
      `SELECT id, amount, description, date, created_at
       FROM expenses ORDER BY date DESC, id DESC`
    );
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
/** POST /api/expenses -> thêm khoản chi (cần admin). body: { amount, description, date } */
export async function POST(request: Request) {
  if (!requireAdmin(request))
    return NextResponse.json({ error: "Không có quyền admin" }, { status: 403 });
  try {
    const { amount, description, date } = await request.json();
    if (amount == null)
      return NextResponse.json({ error: "Thiếu amount" }, { status: 400 });
    const sql = getSql();
    const [row] = await sql.query(
      `INSERT INTO expenses (amount, description, date)
       VALUES ($1, $2, COALESCE($3, CURRENT_DATE))
       RETURNING id, amount, description, date, created_at`,
      [Number(amount), description || null, date || null]
    );
    return NextResponse.json(row, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
/** DELETE /api/expenses?id=3 -> xóa khoản chi (cần admin) */
export async function DELETE(request: Request) {
  if (!requireAdmin(request))
    return NextResponse.json({ error: "Không có quyền admin" }, { status: 403 });
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
    const sql = getSql();
    await sql.query(`DELETE FROM expenses WHERE id = $1`, [Number(id)]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

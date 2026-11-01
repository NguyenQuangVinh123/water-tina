import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/** GET /api/toppings -> danh sách topping (mặc định trả cả loại đang ẩn để admin quản lý) */
export async function GET() {
  try {
    const sql = getSql();
    const rows = await sql.query(
      `SELECT id, name, price, is_active, created_at
       FROM toppings ORDER BY name`
    );
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** POST /api/toppings -> tạo topping (cần admin). body: { name, price, is_active? } */
export async function POST(request: Request) {
  if (!requireAdmin(request))
    return NextResponse.json(
      { error: "Không có quyền admin" },
      { status: 403 }
    );
  try {
    const { name, price, is_active } = await request.json();
    const n = (name ?? "").toString().trim();
    const p = Number(price);
    if (!n)
      return NextResponse.json({ error: "Thiếu name" }, { status: 400 });
    if (!Number.isFinite(p) || p < 0)
      return NextResponse.json(
        { error: "Giá không hợp lệ" },
        { status: 400 }
      );
    const sql = getSql();
    const [row] = await sql.query(
      `INSERT INTO toppings (name, price, is_active)
       VALUES ($1, $2, $3)
       RETURNING id, name, price, is_active, created_at`,
      [n, p, is_active ?? true]
    );
    return NextResponse.json(row, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** PUT /api/toppings -> sửa topping (cần admin). body: { id, name, price, is_active } */
export async function PUT(request: Request) {
  if (!requireAdmin(request))
    return NextResponse.json(
      { error: "Không có quyền admin" },
      { status: 403 }
    );
  try {
    const { id, name, price, is_active } = await request.json();
    const n = (name ?? "").toString().trim();
    const p = Number(price);
    if (!Number(id))
      return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
    if (!n)
      return NextResponse.json({ error: "Thiếu name" }, { status: 400 });
    if (!Number.isFinite(p) || p < 0)
      return NextResponse.json(
        { error: "Giá không hợp lệ" },
        { status: 400 }
      );
    const sql = getSql();
    const [row] = await sql.query(
      `UPDATE toppings
       SET name = $2, price = $3, is_active = $4
       WHERE id = $1
       RETURNING id, name, price, is_active, created_at`,
      [Number(id), n, p, is_active ?? true]
    );
    if (!row)
      return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    return NextResponse.json(row);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** DELETE /api/toppings?id=3 -> xóa topping (cần admin) */
export async function DELETE(request: Request) {
  if (!requireAdmin(request))
    return NextResponse.json(
      { error: "Không có quyền admin" },
      { status: 403 }
    );
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
    const sql = getSql();
    await sql.query(`DELETE FROM toppings WHERE id = $1`, [Number(id)]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

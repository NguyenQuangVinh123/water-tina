import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/** GET /api/products -> danh sách sản phẩm */
export async function GET() {
  try {
    const sql = getSql();
    const rows = await sql.query(
      `SELECT id, name, price, category, is_active, created_at
       FROM products ORDER BY name`
    );
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
/** POST /api/products -> tạo sản phẩm (cần admin) */
export async function POST(request: Request) {
  if (!requireAdmin(request))
    return NextResponse.json({ error: "Không có quyền admin" }, { status: 403 });
  try {
    const { name, price, category } = await request.json();
    if (!name || price == null)
      return NextResponse.json({ error: "Thiếu name/price" }, { status: 400 });
    const sql = getSql();
    const [row] = await sql.query(
      `INSERT INTO products (name, price, category)
       VALUES ($1, $2, $3)
       RETURNING id, name, price, category, is_active, created_at`,
      [name, Number(price), category || null]
    );
    return NextResponse.json(row, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
/** PUT /api/products -> sửa sản phẩm (cần admin) */
export async function PUT(request: Request) {
  if (!requireAdmin(request))
    return NextResponse.json({ error: "Không có quyền admin" }, { status: 403 });
  try {
    const { id, name, price, category, is_active } = await request.json();
    const sql = getSql();
    const [row] = await sql.query(
      `UPDATE products
       SET name = $2, price = $3, category = $4, is_active = $5
       WHERE id = $1
       RETURNING id, name, price, category, is_active, created_at`,
      [
        Number(id),
        name,
        Number(price),
        category ?? null,
        is_active ?? true,
      ]
    );
    return NextResponse.json(row);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
/** DELETE /api/products?id=5 -> xóa sản phẩm (cần admin) */
export async function DELETE(request: Request) {
  if (!requireAdmin(request))
    return NextResponse.json({ error: "Không có quyền admin" }, { status: 403 });
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
    const sql = getSql();
    await sql.query(`DELETE FROM products WHERE id = $1`, [Number(id)]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // sản phẩm đã có trong đơn hàng -> không xóa được (do khóa ngoại)
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

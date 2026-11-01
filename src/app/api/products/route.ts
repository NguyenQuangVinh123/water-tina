import { NextResponse } from "next/server";
import { getSql, type SizeOption } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/** Chuẩn hóa mảng size đầu vào; trả về sizes hợp lệ + giá cơ sở (thấp nhất) */
function normalizeSizes(input: any): { sizes: SizeOption[]; minPrice: number | null } {
  if (!Array.isArray(input)) return { sizes: [], minPrice: null };
  const seen = new Set<string>();
  const sizes: SizeOption[] = [];
  for (const s of input) {
    const name = (s?.name ?? "").toString().trim();
    const price = Number(s?.price);
    if (!name || !Number.isFinite(price) || price < 0) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    sizes.push({ name, price });
  }
  const minPrice = sizes.length ? Math.min(...sizes.map((s) => s.price)) : null;
  return { sizes, minPrice };
}

/** GET /api/products -> danh sách sản phẩm */
export async function GET() {
  try {
    const sql = getSql();
    const rows = await sql.query(
      `SELECT id, name, price, category, sizes, is_active, created_at
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
    return NextResponse.json(
      { error: "Không có quyền admin" },
      { status: 403 }
    );
  try {
    const { name, price, category, sizes } = await request.json();
    if (!name)
      return NextResponse.json({ error: "Thiếu name" }, { status: 400 });
    const { sizes: clean, minPrice } = normalizeSizes(sizes);
    const finalPrice = minPrice ?? Number(price ?? 0);
    if (!clean.length && !(Number.isFinite(finalPrice) && finalPrice >= 0))
      return NextResponse.json(
        { error: "Cần giá bán hoặc ít nhất 1 size" },
        { status: 400 }
      );
    const sql = getSql();
    const [row] = await sql.query(
      `INSERT INTO products (name, price, category, sizes)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id, name, price, category, sizes, is_active, created_at`,
      [name, finalPrice, category || null, JSON.stringify(clean)]
    );
    return NextResponse.json(row, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** PUT /api/products -> sửa sản phẩm (cần admin) */
export async function PUT(request: Request) {
  if (!requireAdmin(request))
    return NextResponse.json(
      { error: "Không có quyền admin" },
      { status: 403 }
    );
  try {
    const { id, name, price, category, is_active, sizes } = await request.json();
    const { sizes: clean, minPrice } = normalizeSizes(sizes);
    const finalPrice = minPrice ?? Number(price ?? 0);
    const sql = getSql();
    const [row] = await sql.query(
      `UPDATE products
       SET name = $2, price = $3, category = $4, is_active = $5, sizes = $6::jsonb
       WHERE id = $1
       RETURNING id, name, price, category, sizes, is_active, created_at`,
      [
        Number(id),
        name,
        finalPrice,
        category ?? null,
        is_active ?? true,
        JSON.stringify(clean),
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
    return NextResponse.json(
      { error: "Không có quyền admin" },
      { status: 403 }
    );
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

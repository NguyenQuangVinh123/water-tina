import { NextResponse } from "next/server";
import { getSql, type SizeOption } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

type CartItem = { product_id: number; qty: number; size?: string | null };
type Line = {
  product_id: number;
  size: string | null;
  qty: number;
  unit_price: number;
};

/**
 * Tính dòng đơn + tổng tiền phía server theo giá hiện hành.
 * Món có size: buộc chọn size hợp lệ, lấy giá của size đó.
 * Món không có size: dùng price của món.
 */
async function buildLines(
  sql: ReturnType<typeof getSql>,
  items: CartItem[]
): Promise<{ lines: Line[]; total: number; error?: string }> {
  const ids = items.map((i) => Number(i.product_id));
  const rows = await sql.query(
    `SELECT id, name, price, sizes FROM products WHERE id = ANY($1::int[])`,
    [ids]
  );
  const map = new Map<number, any>(rows.map((p: any) => [p.id, p]));

  const lines: Line[] = [];
  for (const it of items) {
    const p = map.get(Number(it.product_id));
    if (!p) return { lines: [], total: 0, error: "Sản phẩm không hợp lệ" };
    const qty = Math.max(1, Number(it.qty) || 1);
    const sizes: SizeOption[] = Array.isArray(p.sizes) ? p.sizes : [];

    if (sizes.length > 0) {
      const wanted = (it.size || "").toString().trim();
      const found = sizes.find(
        (s) => s.name.toLowerCase() === wanted.toLowerCase()
      );
      if (!found)
        return {
          lines: [],
          total: 0,
          error: `Món "${p.name}" cần chọn size (${sizes
            .map((s) => s.name)
            .join("/")})`,
        };
      lines.push({
        product_id: p.id,
        size: found.name,
        qty,
        unit_price: Number(found.price),
      });
    } else {
      lines.push({
        product_id: p.id,
        size: null,
        qty,
        unit_price: Number(p.price),
      });
    }
  }
  const total = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);
  return { lines, total };
}

/** GET /api/orders?limit=20 -> danh sách đơn gần đây (kèm chi tiết) */
export async function GET(request: Request) {
  try {
    const limit = Number(new URL(request.url).searchParams.get("limit") || 20);
    const sql = getSql();
    const orders = await sql.query(
      `SELECT id, customer_name, note, total, created_at
       FROM orders ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    const items = await sql.query(
      `SELECT oi.order_id, oi.product_id, oi.size, oi.qty, oi.unit_price, p.name
       FROM order_items oi JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ANY($1::int[])`,
      [orders.map((o: any) => o.id)]
    );
    const withItems = orders.map((o: any) => ({
      ...o,
      items: items.filter((it: any) => it.order_id === o.id),
    }));
    return NextResponse.json(withItems);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * POST /api/orders
 * body: { customer_name, note, items: [{ product_id, qty, size? }] }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const items: CartItem[] = body.items || [];
    if (!items.length)
      return NextResponse.json({ error: "Đơn hàng trống" }, { status: 400 });

    const sql = getSql();
    const { lines, total, error } = await buildLines(sql, items);
    if (error) return NextResponse.json({ error }, { status: 400 });
    if (!lines.length)
      return NextResponse.json(
        { error: "Sản phẩm không hợp lệ" },
        { status: 400 }
      );

    const productIds = lines.map((l) => l.product_id);
    const sizes = lines.map((l) => l.size);
    const qtys = lines.map((l) => l.qty);
    const unitPrices = lines.map((l) => l.unit_price);

    // Chèn đơn + chi tiết bằng 1 câu lệnh nguyên tử (data-modifying CTE)
    const [order] = await sql.query(
      `WITH o AS (
         INSERT INTO orders (customer_name, note, total)
         VALUES ($1, $2, $3)
         RETURNING id, customer_name, note, total, created_at
       ), i AS (
         INSERT INTO order_items (order_id, product_id, size, qty, unit_price)
         SELECT o.id, v.product_id, v.size, v.qty, v.unit_price
         FROM o, unnest($4::int[], $5::text[], $6::int[], $7::numeric[])
              AS v(product_id, size, qty, unit_price)
         RETURNING 1
       )
       SELECT * FROM o`,
      [
        body.customer_name || null,
        body.note || null,
        total,
        productIds,
        sizes,
        qtys,
        unitPrices,
      ]
    );

    return NextResponse.json(order, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * PUT /api/orders -> sửa đơn (cần admin)
 * body: { id, customer_name, note, items: [{ product_id, qty, size? }] }
 */
export async function PUT(request: Request) {
  if (!requireAdmin(request))
    return NextResponse.json(
      { error: "Không có quyền admin" },
      { status: 403 }
    );
  try {
    const body = await request.json();
    const orderId = Number(body.id);
    if (!orderId)
      return NextResponse.json({ error: "Thiếu id đơn hàng" }, { status: 400 });
    const items: CartItem[] = body.items || [];
    if (!items.length)
      return NextResponse.json({ error: "Đơn hàng trống" }, { status: 400 });

    const sql = getSql();

    const found = await sql.query(`SELECT 1 FROM orders WHERE id = $1`, [
      orderId,
    ]);
    if (!found.length)
      return NextResponse.json({ error: "Không tìm thấy đơn" }, { status: 404 });

    const { lines, total, error } = await buildLines(sql, items);
    if (error) return NextResponse.json({ error }, { status: 400 });
    if (!lines.length)
      return NextResponse.json(
        { error: "Sản phẩm không hợp lệ" },
        { status: 400 }
      );

    const productIds = lines.map((l) => l.product_id);
    const sizes = lines.map((l) => l.size);
    const qtys = lines.map((l) => l.qty);
    const unitPrices = lines.map((l) => l.unit_price);

    // 1 câu lệnh nguyên tử: cập nhật đơn + xóa chi tiết cũ + ghi chi tiết mới
    const [order] = await sql.query(
      `WITH upd AS (
         UPDATE orders SET customer_name = $2, note = $3, total = $4
         WHERE id = $1
         RETURNING id, customer_name, note, total, created_at
       ), del AS (
         DELETE FROM order_items WHERE order_id = $1 RETURNING 1
       ), ins AS (
         INSERT INTO order_items (order_id, product_id, size, qty, unit_price)
         SELECT $1, v.product_id, v.size, v.qty, v.unit_price
         FROM unnest($5::int[], $6::text[], $7::int[], $8::numeric[])
              AS v(product_id, size, qty, unit_price)
         RETURNING 1
       )
       SELECT * FROM upd`,
      [
        orderId,
        body.customer_name || null,
        body.note || null,
        total,
        productIds,
        sizes,
        qtys,
        unitPrices,
      ]
    );

    return NextResponse.json(order);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** DELETE /api/orders?id=5 -> xóa đơn (cần admin). order_items tự xóa theo CASCADE */
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
    await sql.query(`DELETE FROM orders WHERE id = $1`, [Number(id)]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

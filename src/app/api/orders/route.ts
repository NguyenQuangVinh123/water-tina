import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

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
      `SELECT oi.order_id, oi.product_id, oi.qty, oi.unit_price, p.name
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
 * body: { customer_name, note, items: [{ product_id, qty }] }
 * Tổng tiền được tính lại phía server theo giá hiện tại của sản phẩm.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const items: { product_id: number; qty: number }[] = body.items || [];
    if (!items.length)
      return NextResponse.json({ error: "Đơn hàng trống" }, { status: 400 });

    const sql = getSql();

    // Lấy giá thật của từng sản phẩm từ DB
    const ids = items.map((i) => Number(i.product_id));
    const rows = await sql.query(
      `SELECT id, name, price FROM products WHERE id = ANY($1::int[])`,
      [ids]
    );
    const priceMap = new Map(rows.map((p: any) => [p.id, p]));

    const lines = items
      .map((i) => {
        const p = priceMap.get(Number(i.product_id));
        if (!p) return null;
        const qty = Math.max(1, Number(i.qty) || 1);
        return { product_id: p.id, qty, unit_price: Number(p.price) };
      })
      .filter(Boolean) as {
      product_id: number;
      qty: number;
      unit_price: number;
    }[];

    if (!lines.length)
      return NextResponse.json(
        { error: "Sản phẩm không hợp lệ" },
        { status: 400 }
      );

    const total = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);

    // Chèn đơn + chi tiết bằng 1 câu lệnh nguyên tử (data-modifying CTE),
    // phù hợp với Neon HTTP driver (không giữ kết nối, 1 round-trip).
    const productIds = lines.map((l) => l.product_id);
    const qtys = lines.map((l) => l.qty);
    const unitPrices = lines.map((l) => l.unit_price);

    const [order] = await sql.query(
      `WITH o AS (
         INSERT INTO orders (customer_name, note, total)
         VALUES ($1, $2, $3)
         RETURNING id, customer_name, note, total, created_at
       ), i AS (
         INSERT INTO order_items (order_id, product_id, qty, unit_price)
         SELECT o.id, v.product_id, v.qty, v.unit_price
         FROM o, unnest($4::int[], $5::int[], $6::numeric[])
              AS v(product_id, qty, unit_price)
         RETURNING 1
       )
       SELECT * FROM o`,
      [
        body.customer_name || null,
        body.note || null,
        total,
        productIds,
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
 * body: { id, customer_name, note, items: [{ product_id, qty }] }
 * Tổng tiền tính lại phía server; chi tiết cũ bị xóa và ghi mới (nguyên tử).
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
    const items: { product_id: number; qty: number }[] = body.items || [];
    if (!items.length)
      return NextResponse.json({ error: "Đơn hàng trống" }, { status: 400 });

    const sql = getSql();

    // Đơn phải tồn tại
    const found = await sql.query(`SELECT 1 FROM orders WHERE id = $1`, [
      orderId,
    ]);
    if (!found.length)
      return NextResponse.json({ error: "Không tìm thấy đơn" }, { status: 404 });

    // Lấy giá thật từ DB
    const ids = items.map((i) => Number(i.product_id));
    const rows = await sql.query(
      `SELECT id, price FROM products WHERE id = ANY($1::int[])`,
      [ids]
    );
    const priceMap = new Map(rows.map((p: any) => [p.id, p]));

    const lines = items
      .map((i) => {
        const p = priceMap.get(Number(i.product_id));
        if (!p) return null;
        const qty = Math.max(1, Number(i.qty) || 1);
        return { product_id: p.id, qty, unit_price: Number(p.price) };
      })
      .filter(Boolean) as {
      product_id: number;
      qty: number;
      unit_price: number;
    }[];

    if (!lines.length)
      return NextResponse.json(
        { error: "Sản phẩm không hợp lệ" },
        { status: 400 }
      );

    const total = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);
    const productIds = lines.map((l) => l.product_id);
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
         INSERT INTO order_items (order_id, product_id, qty, unit_price)
         SELECT $1, v.product_id, v.qty, v.unit_price
         FROM unnest($5::int[], $6::int[], $7::numeric[])
              AS v(product_id, qty, unit_price)
         RETURNING 1
       )
       SELECT * FROM upd`,
      [
        orderId,
        body.customer_name || null,
        body.note || null,
        total,
        productIds,
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

import { NextResponse } from "next/server";
import { getSql, type SizeOption, type ToppingSnapshot } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

type CartItem = {
  product_id: number;
  qty: number;
  size?: string | null;
  topping_ids?: number[];
};
type Line = {
  product_id: number;
  size: string | null;
  qty: number;
  unit_price: number;
  toppings: ToppingSnapshot[];
};

/**
 * Tính dòng đơn + tổng tiền phía server theo giá hiện hành.
 * Món có size: buộc chọn size hợp lệ, lấy giá của size đó.
 * Món không có size: dùng price của món.
 * Topping (áp dụng cho mọi món): cộng giá từng topping, lưu snapshot.
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

  // Gom toàn bộ topping id cần tra để query 1 lần
  const toppingIdSet = new Set<number>();
  for (const it of items)
    (it.topping_ids || []).forEach((t) => toppingIdSet.add(Number(t)));
  let toppingMap = new Map<number, { id: number; name: string; price: number }>();
  if (toppingIdSet.size) {
    const tpRows = await sql.query(
      `SELECT id, name, price FROM toppings WHERE id = ANY($1::int[])`,
      [[...toppingIdSet]]
    );
    toppingMap = new Map(
      tpRows.map((t: any) => [
        t.id,
        { id: t.id, name: t.name, price: Number(t.price) },
      ])
    );
  }

  const lines: Line[] = [];
  for (const it of items) {
    const p = map.get(Number(it.product_id));
    if (!p) return { lines: [], total: 0, error: "Sản phẩm không hợp lệ" };
    const qty = Math.max(1, Number(it.qty) || 1);
    const sizes: SizeOption[] = Array.isArray(p.sizes) ? p.sizes : [];

    let basePrice: number;
    let sizeName: string | null = null;
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
      basePrice = Number(found.price);
      sizeName = found.name;
    } else {
      basePrice = Number(p.price);
    }

    // Topping
    const requestedToppingIds = Array.from(
      new Set((it.topping_ids || []).map((n) => Number(n)).filter((n) => n > 0))
    );
    const snapshot: ToppingSnapshot[] = [];
    for (const tid of requestedToppingIds) {
      const t = toppingMap.get(tid);
      if (!t)
        return {
          lines: [],
          total: 0,
          error: "Topping không hợp lệ",
        };
      snapshot.push(t);
    }
    const toppingSum = snapshot.reduce((s, t) => s + t.price, 0);

    lines.push({
      product_id: p.id,
      size: sizeName,
      qty,
      unit_price: basePrice + toppingSum,
      toppings: snapshot,
    });
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
      `SELECT oi.order_id, oi.product_id, oi.size, oi.toppings, oi.qty, oi.unit_price, p.name
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
 * body: { note?, customer_name?, items: [{ product_id, qty, size?, topping_ids? }] }
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
    // JSON string per row -> cast in SELECT
    const toppingsJson = lines.map((l) => JSON.stringify(l.toppings));

    const [order] = await sql.query(
      `WITH o AS (
         INSERT INTO orders (customer_name, note, total)
         VALUES ($1, $2, $3)
         RETURNING id, customer_name, note, total, created_at
       ), i AS (
         INSERT INTO order_items (order_id, product_id, size, qty, unit_price, toppings)
         SELECT o.id, v.product_id, v.size, v.qty, v.unit_price, v.toppings_json::jsonb
         FROM o, unnest($4::int[], $5::text[], $6::int[], $7::numeric[], $8::text[])
              AS v(product_id, size, qty, unit_price, toppings_json)
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
        toppingsJson,
      ]
    );

    return NextResponse.json(order, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * PUT /api/orders -> sửa đơn (cần admin)
 * body: { id, customer_name?, note?, items: [{ product_id, qty, size?, topping_ids? }] }
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
      return NextResponse.json(
        { error: "Không tìm thấy đơn" },
        { status: 404 }
      );

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
    const toppingsJson = lines.map((l) => JSON.stringify(l.toppings));

    const [order] = await sql.query(
      `WITH upd AS (
         UPDATE orders SET customer_name = $2, note = $3, total = $4
         WHERE id = $1
         RETURNING id, customer_name, note, total, created_at
       ), del AS (
         DELETE FROM order_items WHERE order_id = $1 RETURNING 1
       ), ins AS (
         INSERT INTO order_items (order_id, product_id, size, qty, unit_price, toppings)
         SELECT $1, v.product_id, v.size, v.qty, v.unit_price, v.toppings_json::jsonb
         FROM unnest($5::int[], $6::text[], $7::int[], $8::numeric[], $9::text[])
              AS v(product_id, size, qty, unit_price, toppings_json)
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
        toppingsJson,
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

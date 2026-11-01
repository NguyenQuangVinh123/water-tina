import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

/**
 * GET /api/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Trả về: tổng doanh thu, số đơn, tổng chi, lợi nhuận,
 * top sản phẩm bán chạy, và chuỗi doanh thu theo ngày.
 */
export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams;
    const from = sp.get("from");
    const to = sp.get("to");
    const sql = getSql();
    // Điều kiện lọc thời gian (optional)
    const orderFilter = buildFilter("o.created_at", from, to);
    const expFilter = buildFilter("e.date", from, to);
    const [revRow] = await sql.query(
      `SELECT COALESCE(SUM(total),0)::float AS revenue, COUNT(*)::int AS orders
       FROM orders o ${orderFilter.where}`,
      orderFilter.params
    );
    const [expRow] = await sql.query(
      `SELECT COALESCE(SUM(amount),0)::float AS expenses
       FROM expenses ${expFilter.where}`,
      expFilter.params
    );
    const topSellers = await sql.query(
      `SELECT p.id, p.name,
              SUM(oi.qty)::int AS qty_sold,
              SUM(oi.qty * oi.unit_price)::float AS revenue
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       JOIN orders o ON o.id = oi.order_id
       ${orderFilter.where}
       GROUP BY p.id, p.name
       ORDER BY qty_sold DESC
       LIMIT 10`,
      orderFilter.params
    );
    const daily = await sql.query(
      `SELECT date_trunc('day', o.created_at)::date::text AS day,
              SUM(o.total)::float AS revenue
       FROM orders o
       ${orderFilter.where}
       GROUP BY day
       ORDER BY day ASC`,
      orderFilter.params
    );
    const revenue = Number(revRow?.revenue || 0);
    const expenses = Number(expRow?.expenses || 0);
    return NextResponse.json({
      range: { from, to },
      revenue,
      orderCount: Number(revRow?.orders || 0),
      expenses,
      profit: revenue - expenses,
      topSellers,
      daily,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
/** Tạo mệnh đề WHERE + tham số an toàn (parameterized) cho khoảng ngày */
function buildFilter(col: string, from: string | null, to: string | null) {
  const where: string[] = [];
  const params: any[] = [];
  if (from) {
    params.push(from);
    where.push(`${col} >= $${params.length}::timestamptz`);
  }
  if (to) {
    params.push(to);
    // cộng 1 ngày để bao trọn ngày "to"
    where.push(`${col} < ($${params.length}::timestamptz + interval '1 day')`);
  }
  return {
    where: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
  };
}

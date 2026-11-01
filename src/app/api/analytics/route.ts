import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

const TZ = "Asia/Ho_Chi_Minh";

/**
 * GET /api/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Trả về: tổng doanh thu, số đơn, tổng chi, lợi nhuận,
 * top sản phẩm bán chạy, và chuỗi doanh thu theo ngày (lấp đầy mọi ngày, giờ VN).
 */
export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams;
    const from = sp.get("from") || null;
    const to = sp.get("to") || null;
    const sql = getSql();

    // Lọc theo ngày giờ VN: từ 00:00 VN của `from` đến 00:00 VN của `to + 1`
    const orderWhere: string[] = [];
    const orderParams: any[] = [];
    if (from) {
      orderParams.push(from);
      orderWhere.push(
        `o.created_at >= ($${orderParams.length}::timestamp AT TIME ZONE '${TZ}')`
      );
    }
    if (to) {
      orderParams.push(to);
      orderWhere.push(
        `o.created_at < (($${orderParams.length}::timestamp + interval '1 day') AT TIME ZONE '${TZ}')`
      );
    }
    const orderFilter = {
      where: orderWhere.length ? `WHERE ${orderWhere.join(" AND ")}` : "",
      params: orderParams,
    };

    // expenses.date là DATE (không tz) -> so trực tiếp
    const expWhere: string[] = [];
    const expParams: any[] = [];
    if (from) {
      expParams.push(from);
      expWhere.push(`e.date >= $${expParams.length}::date`);
    }
    if (to) {
      expParams.push(to);
      expWhere.push(`e.date <= $${expParams.length}::date`);
    }
    const expFilter = {
      where: expWhere.length ? `WHERE ${expWhere.join(" AND ")}` : "",
      params: expParams,
    };

    const [revRow] = await sql.query(
      `SELECT COALESCE(SUM(total),0)::float AS revenue, COUNT(*)::int AS orders
       FROM orders o ${orderFilter.where}`,
      orderFilter.params
    );
    const [expRow] = await sql.query(
      `SELECT COALESCE(SUM(amount),0)::float AS expenses
       FROM expenses e ${expFilter.where}`,
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

    // Doanh thu theo ngày (giờ VN)
    let daily: { day: string; revenue: number }[];
    if (from && to) {
      // Lấp đầy mọi ngày trong khoảng -> ngày không bán = 0
      const rows = await sql.query(
        `SELECT to_char(gs.day, 'YYYY-MM-DD') AS day,
                COALESCE(SUM(o.total),0)::float AS revenue
         FROM generate_series($1::date, $2::date, interval '1 day') AS gs(day)
         LEFT JOIN orders o
           ON ((o.created_at AT TIME ZONE '${TZ}')::date) = gs.day::date
         GROUP BY gs.day
         ORDER BY gs.day ASC`,
        [from, to]
      );
      daily = rows.map((r: any) => ({ day: r.day, revenue: Number(r.revenue) }));
    } else {
      const rows = await sql.query(
        `SELECT (((o.created_at) AT TIME ZONE '${TZ}')::date)::text AS day,
                SUM(o.total)::float AS revenue
         FROM orders o
         ${orderFilter.where}
         GROUP BY day
         ORDER BY day ASC`,
        orderFilter.params
      );
      daily = rows.map((r: any) => ({ day: r.day, revenue: Number(r.revenue) }));
    }

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

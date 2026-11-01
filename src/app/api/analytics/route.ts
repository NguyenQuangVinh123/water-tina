import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

const TZ = "Asia/Ho_Chi_Minh";

/**
 * GET /api/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Trả về: tổng doanh thu, số đơn, tổng chi, lợi nhuận,
 * top sản phẩm bán chạy, chuỗi doanh thu theo ngày (lấp đầy mọi ngày, giờ VN),
 * và `compare` — số liệu kỳ trước liền kề cùng độ dài để tính % tăng/giảm.
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

    // Kỳ trước liền kề, cùng độ dài (chỉ khi có from&to): [from - N, from - 1]
    let compare = null;
    if (from && to) {
      const f = new Date(`${from}T00:00:00`);
      const t = new Date(`${to}T00:00:00`);
      const dayMs = 864e5;
      const spanDays =
        Math.round((t.getTime() - f.getTime()) / dayMs) + 1 || 1;
      const shift = (d: Date, n: number) =>
        new Date(d.getTime() - n * dayMs).toISOString().slice(0, 10);
      const pFrom = shift(f, spanDays);
      const pTo = shift(f, 1);

      const [cRev] = await sql.query(
        `SELECT COALESCE(SUM(total),0)::float AS revenue, COUNT(*)::int AS orders
         FROM orders o
         WHERE o.created_at >= ($1::timestamp AT TIME ZONE '${TZ}')
           AND o.created_at < (($2::timestamp + interval '1 day') AT TIME ZONE '${TZ}')`,
        [pFrom, pTo]
      );
      const [cExp] = await sql.query(
        `SELECT COALESCE(SUM(amount),0)::float AS expenses
         FROM expenses e WHERE e.date >= $1::date AND e.date <= $2::date`,
        [pFrom, pTo]
      );
      const cRevenue = Number(cRev?.revenue || 0);
      const cExpenses = Number(cExp?.expenses || 0);
      compare = {
        range: { from: pFrom, to: pTo },
        revenue: cRevenue,
        orderCount: Number(cRev?.orders || 0),
        expenses: cExpenses,
        profit: cRevenue - cExpenses,
      };
    }

    return NextResponse.json({
      range: { from, to },
      revenue,
      orderCount: Number(revRow?.orders || 0),
      expenses,
      profit: revenue - expenses,
      topSellers,
      daily,
      compare,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

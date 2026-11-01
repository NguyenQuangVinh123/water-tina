import { neon } from "@neondatabase/serverless";

/**
 * Tạo một Neon SQL client dùng serverless driver (HTTP).
 * Đọc chuỗi kết nối từ biến môi trường DATABASE_URL.
 * Ví dụ: postgres://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
 */
export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Thiếu DATABASE_URL. Hãy thêm chuỗi kết nối Neon vào file .env.local"
    );
  }
  return neon(url);
}

/** kiểu bản ghi */
export type Product = {
  id: number;
  name: string;
  price: number;
  category: string | null;
  is_active: boolean;
  created_at: string;
};

export type Order = {
  id: number;
  customer_name: string | null;
  note: string | null;
  total: number;
  created_at: string;
};

export type OrderItem = {
  id: number;
  order_id: number;
  product_id: number;
  qty: number;
  unit_price: number;
};

export type Expense = {
  id: number;
  amount: number;
  description: string | null;
  date: string;
  created_at: string;
};

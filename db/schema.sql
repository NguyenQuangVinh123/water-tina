-- ============================================================
-- Schema cho website quản lý đơn hàng bán nước (Neon / Postgres)
-- Chạy file này trong Neon SQL Editor, hoặc: npm run db:init
-- ============================================================

CREATE TABLE IF NOT EXISTS products (
  id         SERIAL PRIMARY KEY,
  name       TEXT        NOT NULL,
  price      NUMERIC(12, 2) NOT NULL DEFAULT 0,   -- giá bán
  category   TEXT,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id            SERIAL PRIMARY KEY,
  customer_name TEXT,
  note          TEXT,
  total         NUMERIC(12, 2) NOT NULL DEFAULT 0, -- tổng tiền đơn
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id         SERIAL PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty        INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0      -- giá tại thời điểm bán
);

CREATE TABLE IF NOT EXISTS expenses (
  id          SERIAL PRIMARY KEY,
  amount      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  description TEXT,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_created      ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_expenses_date       ON expenses(date);

-- Một vài sản phẩm mẫu (bỏ qua nếu đã có)
INSERT INTO products (name, price, category)
SELECT * FROM (VALUES
  ('Trà đào cam sả',  25000, 'Trà'),
  ('Nước ép ổi',      20000, 'Nước ép'),
  ('Soda bạc xỉu',    30000, 'Soda'),
  ('Trà sữa ô long',  28000, 'Trà sữa')
) AS v(name, price, category)
WHERE NOT EXISTS (SELECT 1 FROM products);

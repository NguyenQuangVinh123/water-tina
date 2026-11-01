-- Migration: tạo bảng topping riêng
CREATE TABLE IF NOT EXISTS toppings (
  id         SERIAL PRIMARY KEY,
  name       TEXT        NOT NULL,
  price      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

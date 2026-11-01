-- Migration: thêm snapshot topping trên từng chi tiết đơn
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS toppings JSONB NOT NULL DEFAULT '[]'::jsonb;

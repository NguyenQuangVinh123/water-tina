-- Migration: thêm hỗ trợ size cho món uống
ALTER TABLE products    ADD COLUMN IF NOT EXISTS sizes JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS size  TEXT;

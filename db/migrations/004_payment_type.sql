-- Add payment_type column to orders table
-- 1 = Tiền mặt (Cash)
-- 2 = Chuyển khoản (Bank Transfer)

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_type INTEGER NOT NULL DEFAULT 1;

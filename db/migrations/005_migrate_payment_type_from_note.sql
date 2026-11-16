-- Migrate payment_type từ note field (staff ghi Ck/CK/chuyển khoản hoặc Tm/TM/tiền mặt)
-- Loại bỏ prefix sau khi migrate

UPDATE orders SET payment_type = 2
WHERE payment_type = 1 AND note IS NOT NULL AND (
  note ILIKE '%ck%' OR 
  note ILIKE '%chuyển khoản%' OR
  note ILIKE '%transfer%' OR
  note ILIKE '%bank%'
);

UPDATE orders SET payment_type = 1
WHERE payment_type = 1 AND note IS NOT NULL AND (
  note ILIKE '%tm%' OR 
  note ILIKE '%tiền mặt%' OR
  note ILIKE '%cash%'
);

-- Xóa prefix thanh toán khỏi note (nếu ghi ở đầu)
UPDATE orders SET note = TRIM(REGEXP_REPLACE(note, '^(ck|CK|Ck|tm|TM|Tm|Chuyển khoản|chuyển khoản|Tiền mặt|tiền mặt|Transfer|Bank|Cash|cash)\s*[:\-–]?\s*', '', 'i'))
WHERE note IS NOT NULL AND note ~ '^(ck|CK|Ck|tm|TM|Tm|Chuyển khoản|chuyển khoản|Tiền mặt|tiền mặt|Transfer|Bank|Cash|cash)\s*[:\-–]?';

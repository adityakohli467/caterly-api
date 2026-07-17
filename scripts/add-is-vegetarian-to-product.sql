-- Add is_vegetarian flag to product table for AI chatbot dietary filtering
-- Safe to run multiple times.

ALTER TABLE product
  ADD COLUMN IF NOT EXISTS is_vegetarian boolean NOT NULL DEFAULT false;

-- Optional index to speed up veg/non-veg filtering
CREATE INDEX IF NOT EXISTS idx_product_is_vegetarian ON product (is_vegetarian);

-- Example: mark existing items that look vegetarian (adjust to your data!)
-- UPDATE product SET is_vegetarian = true
-- WHERE product_name ILIKE '%veg%' AND product_name NOT ILIKE '%non%veg%';

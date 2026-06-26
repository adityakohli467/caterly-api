-- Backfill date_added for existing orders that were created without it
-- (older admin "Place Order" records had a NULL date_added, which showed as "N/A"
--  in the Reports page Order Date column).
--
-- Strategy: use the best available existing timestamp as a sensible creation date:
--   1) keep existing date_added if present
--   2) else use date_modified
--   3) else use delivery_date_time
-- Only touches rows where date_added is currently NULL.

UPDATE orders
SET date_added = COALESCE(date_added, date_modified, delivery_date_time)
WHERE date_added IS NULL
  AND COALESCE(date_modified, delivery_date_time) IS NOT NULL;

-- Report how many rows still have no date at all (no timestamps to derive from).
-- These are extremely rare and can be reviewed manually if any are returned.
SELECT order_id, order_status, payment_status
FROM orders
WHERE date_added IS NULL
  AND (is_deleted = 0 OR is_deleted IS NULL)
ORDER BY order_id DESC;

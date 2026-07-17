-- Renumber selected order_id values (and all referencing tables) safely.
-- Run with psql (NOT the Railway web query box, which only runs single statements):
--   $env:DBURL = "postgresql://postgres:YOUR_REAL_PASSWORD@kodama.proxy.rlwy.net:51004/railway"
--   psql $env:DBURL -v ON_ERROR_STOP=1 -f scripts/renumber-order-ids.sql
--
-- The whole thing runs in one transaction and only commits if every safety check passes.

BEGIN;

-- 1) Old order_id  ->  New order_id  (from your list)
CREATE TEMP TABLE _order_id_remap (old_id bigint PRIMARY KEY, new_id bigint NOT NULL UNIQUE) ON COMMIT DROP;
INSERT INTO _order_id_remap (old_id, new_id) VALUES
  (1352, 138),
  (1353, 141),
  (1354, 172),
  (1355, 174),
  (1356, 224),
  (1357, 226);

-- 2) Safety: every source order must exist
DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(old_id::text, ', ') INTO missing
  FROM _order_id_remap m
  WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.order_id = m.old_id);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: source order_id(s) do not exist: %', missing;
  END IF;
END $$;

-- 3) Safety: no target id is already used by another order
DO $$
DECLARE taken text;
BEGIN
  SELECT string_agg(m.new_id::text, ', ') INTO taken
  FROM _order_id_remap m
  WHERE EXISTS (SELECT 1 FROM orders o WHERE o.order_id = m.new_id);
  IF taken IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: target order_id(s) already in use: %', taken;
  END IF;
END $$;

-- 4) Turn off FK enforcement for THIS session so parent + children can be
--    renumbered together. (On Railway the "postgres" user is superuser, so this works.)
SET session_replication_role = replica;

-- 5) Update EVERY table that references an order id (discovered automatically).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.table_schema, c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.column_name IN ('order_id', 'orderid', 'subscription_order_id')
      AND NOT (c.table_name = 'orders' AND c.column_name = 'order_id') -- parent updated last
  LOOP
    EXECUTE format(
      'UPDATE %I.%I AS tgt SET %I = m.new_id FROM _order_id_remap m WHERE tgt.%I = m.old_id',
      r.table_schema, r.table_name, r.column_name, r.column_name
    );
  END LOOP;
END $$;

-- 6) Finally renumber the parent orders table itself.
UPDATE orders o SET order_id = m.new_id
FROM _order_id_remap m
WHERE o.order_id = m.old_id;

-- 7) Re-enable FK enforcement.
SET session_replication_role = DEFAULT;

-- 8) Commit. (If any safety check raised an exception above, the whole
--    transaction is rolled back automatically and nothing changes.)
COMMIT;

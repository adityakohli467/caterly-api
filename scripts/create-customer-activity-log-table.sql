-- Customer activity log
-- Records customer-level activities. Currently used to track company
-- reassignments (activity_type = 'company_reassignment').
-- The API also self-heals this table at runtime (synchronize is disabled),
-- but this script can be used to create it manually.

CREATE TABLE IF NOT EXISTS customer_activity_log (
  log_id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  activity_type VARCHAR(100) NOT NULL,
  old_company_id INTEGER,
  new_company_id INTEGER,
  old_company_name VARCHAR(255),
  new_company_name VARCHAR(255),
  performed_by_user_id INTEGER,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_activity_log_customer_id
  ON customer_activity_log(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_activity_log_created_at
  ON customer_activity_log(created_at);

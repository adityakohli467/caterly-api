#!/bin/bash

# Dump quote and orders tables with correct structure from local DB

set -e

LOCAL_DB="stdurex_db"
LOCAL_USER="postgres"
LOCAL_HOST="localhost"
LOCAL_PORT="5432"

OUTPUT_DIR="./sql-dumps"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
QUOTE_FILE="${OUTPUT_DIR}/quote_table_fixed_${TIMESTAMP}.sql"
ORDERS_FILE="${OUTPUT_DIR}/orders_table_fixed_${TIMESTAMP}.sql"

mkdir -p "$OUTPUT_DIR"

echo "📦 Dumping quote and orders tables with correct structure..."
echo ""

# Dump quote table
echo "Dumping quote table..."
pg_dump \
  --host="$LOCAL_HOST" \
  --port="$LOCAL_PORT" \
  --username="$LOCAL_USER" \
  --dbname="$LOCAL_DB" \
  --format=plain \
  --inserts \
  --no-owner \
  --no-acl \
  --table="quote" \
  --verbose \
  --file="$QUOTE_FILE"

# Dump orders table
echo "Dumping orders table..."
pg_dump \
  --host="$LOCAL_HOST" \
  --port="$LOCAL_PORT" \
  --username="$LOCAL_USER" \
  --dbname="$LOCAL_DB" \
  --format=plain \
  --inserts \
  --no-owner \
  --no-acl \
  --table="orders" \
  --verbose \
  --file="$ORDERS_FILE"

# Fix CREATE FUNCTION to CREATE OR REPLACE FUNCTION
sed -i '' 's/^CREATE FUNCTION/CREATE OR REPLACE FUNCTION/g' "$QUOTE_FILE" 2>/dev/null || sed -i 's/^CREATE FUNCTION/CREATE OR REPLACE FUNCTION/g' "$QUOTE_FILE"
sed -i '' 's/^CREATE FUNCTION/CREATE OR REPLACE FUNCTION/g' "$ORDERS_FILE" 2>/dev/null || sed -i 's/^CREATE FUNCTION/CREATE OR REPLACE FUNCTION/g' "$ORDERS_FILE"

# Add extensions to both files
for FILE in "$QUOTE_FILE" "$ORDERS_FILE"; do
  TEMP_FILE="${FILE}.tmp"
  cat > "$TEMP_FILE" << 'EXT'
--
-- Enable required extensions
--
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

EXT
  cat "$FILE" >> "$TEMP_FILE"
  mv "$TEMP_FILE" "$FILE"
done

echo ""
echo "✅ Dumps completed!"
echo "📁 Quote: $QUOTE_FILE"
echo "📁 Orders: $ORDERS_FILE"

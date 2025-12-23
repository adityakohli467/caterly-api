#!/bin/bash

# Dump orders table with ALL data

set -e

LOCAL_DB="stdurex_db"
LOCAL_USER="postgres"
LOCAL_HOST="localhost"
LOCAL_PORT="5432"

OUTPUT_DIR="./sql-dumps"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ORDERS_FILE="${OUTPUT_DIR}/orders_table_with_data_${TIMESTAMP}.sql"

mkdir -p "$OUTPUT_DIR"

echo "📦 Dumping orders table with ALL data..."
echo "📁 Output: $ORDERS_FILE"
echo ""

# Dump orders table schema and data
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

# Fix CREATE FUNCTION to CREATE OR REPLACE FUNCTION if any
sed -i '' 's/^CREATE FUNCTION/CREATE OR REPLACE FUNCTION/g' "$ORDERS_FILE" 2>/dev/null || sed -i 's/^CREATE FUNCTION/CREATE OR REPLACE FUNCTION/g' "$ORDERS_FILE"

echo ""
echo "✅ Orders table dump completed!"
echo "📊 File size: $(du -h "$ORDERS_FILE" | cut -f1)"
echo "📄 Rows: $(grep -c "INSERT INTO" "$ORDERS_FILE")"
echo "📁 Location: $ORDERS_FILE"

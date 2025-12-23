#!/bin/bash

# Dump quote table with ALL data

set -e

LOCAL_DB="stdurex_db"
LOCAL_USER="postgres"
LOCAL_HOST="localhost"
LOCAL_PORT="5432"

OUTPUT_DIR="./sql-dumps"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
QUOTE_FILE="${OUTPUT_DIR}/quote_table_with_data_${TIMESTAMP}.sql"

mkdir -p "$OUTPUT_DIR"

echo "📦 Dumping quote table with ALL data..."
echo "📁 Output: $QUOTE_FILE"
echo ""

# Dump quote table schema and data
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

# Fix CREATE FUNCTION to CREATE OR REPLACE FUNCTION if any
sed -i '' 's/^CREATE FUNCTION/CREATE OR REPLACE FUNCTION/g' "$QUOTE_FILE" 2>/dev/null || sed -i 's/^CREATE FUNCTION/CREATE OR REPLACE FUNCTION/g' "$QUOTE_FILE"

echo ""
echo "✅ Quote table dump completed!"
echo "📊 File size: $(du -h "$QUOTE_FILE" | cut -f1)"
echo "📄 Rows: $(grep -c "INSERT INTO" "$QUOTE_FILE")"
echo "📁 Location: $QUOTE_FILE"

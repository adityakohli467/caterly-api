#!/bin/bash

# Create final complete SQL file with ALL 41 tables

set -e

OUTPUT_DIR="./sql-dumps"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FINAL_FILE="${OUTPUT_DIR}/stdurex_db_final_complete_${TIMESTAMP}.sql"

LOCAL_DB="stdurex_db"
LOCAL_USER="postgres"
LOCAL_HOST="localhost"
LOCAL_PORT="5432"

mkdir -p "$OUTPUT_DIR"

echo "📦 Creating FINAL complete SQL dump with ALL tables..."
echo "📁 Output: $FINAL_FILE"
echo ""

# Dump everything with INSERT statements
pg_dump \
  --host="$LOCAL_HOST" \
  --port="$LOCAL_PORT" \
  --username="$LOCAL_USER" \
  --dbname="$LOCAL_DB" \
  --format=plain \
  --inserts \
  --no-owner \
  --no-acl \
  --verbose \
  --file="$FINAL_FILE"

# Fix CREATE FUNCTION to CREATE OR REPLACE FUNCTION
sed -i '' 's/^CREATE FUNCTION/CREATE OR REPLACE FUNCTION/g' "$FINAL_FILE"

echo ""
echo "✅ Final complete SQL dump created!"
echo "📊 File size: $(du -h "$FINAL_FILE" | cut -f1)"
echo "📄 Tables: $(grep -c 'CREATE TABLE' "$FINAL_FILE")"
echo "📄 Functions: $(grep -c 'CREATE OR REPLACE FUNCTION' "$FINAL_FILE")"
echo "📁 Location: $FINAL_FILE"
echo ""
echo "✅ Verifying all tables:"
echo "   - user table: $(grep -c 'CREATE TABLE.*\"user\"' "$FINAL_FILE" || echo 0)"
echo "   - payment_history_summary: $(grep -c 'CREATE TABLE.*payment_history_summary' "$FINAL_FILE" || echo 0)"
echo ""
echo "🚀 Ready to restore:"
echo "   ./restore-sql-to-dev.sh $FINAL_FILE"

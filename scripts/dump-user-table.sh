#!/bin/bash

# Dump user table with ALL data

set -e

LOCAL_DB="stdurex_db"
LOCAL_USER="postgres"
LOCAL_HOST="localhost"
LOCAL_PORT="5432"

OUTPUT_DIR="./sql-dumps"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
USER_FILE="${OUTPUT_DIR}/user_table_with_data_${TIMESTAMP}.sql"

mkdir -p "$OUTPUT_DIR"

echo "📦 Dumping user table with ALL data..."
echo "📁 Output: $USER_FILE"
echo ""

# Dump user table schema and data
pg_dump \
  --host="$LOCAL_HOST" \
  --port="$LOCAL_PORT" \
  --username="$LOCAL_USER" \
  --dbname="$LOCAL_DB" \
  --format=plain \
  --inserts \
  --no-owner \
  --no-acl \
  --table="user" \
  --verbose \
  --file="$USER_FILE"

# Fix CREATE FUNCTION to CREATE OR REPLACE FUNCTION if any
sed -i '' 's/^CREATE FUNCTION/CREATE OR REPLACE FUNCTION/g' "$USER_FILE" 2>/dev/null || sed -i 's/^CREATE FUNCTION/CREATE OR REPLACE FUNCTION/g' "$USER_FILE"

echo ""
echo "✅ User table dump completed!"
echo "📊 File size: $(du -h "$USER_FILE" | cut -f1)"
echo "📄 Rows: $(grep -c "INSERT INTO" "$USER_FILE")"
echo "📁 Location: $USER_FILE"
echo ""
echo "📋 Content includes:"
echo "   - CREATE TABLE user"
echo "   - All indexes and constraints"
echo "   - All INSERT statements with data"
echo ""
echo "🚀 To add to dev database:"
echo "   psql \"postgresql://postgres:z6r-miWc%2671d2R2Gwiyv@dev-new-global-caterly.cbaiaa2m4c7z.ap-southeast-2.rds.amazonaws.com:5432/stn-db\" -f $USER_FILE"

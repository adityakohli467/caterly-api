#!/bin/bash

# Create a complete SQL file with ALL tables including missing ones

set -e

OUTPUT_DIR="./sql-dumps"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
COMPLETE_FILE="${OUTPUT_DIR}/stdurex_db_complete_${TIMESTAMP}.sql"

LOCAL_DB="stdurex_db"
LOCAL_USER="postgres"
LOCAL_HOST="localhost"
LOCAL_PORT="5432"

mkdir -p "$OUTPUT_DIR"

echo "📦 Creating complete SQL dump with ALL tables..."
echo "📁 Output: $COMPLETE_FILE"
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
  --file="$COMPLETE_FILE"

# Fix CREATE FUNCTION to CREATE OR REPLACE FUNCTION
sed -i '' 's/^CREATE FUNCTION/CREATE OR REPLACE FUNCTION/g' "$COMPLETE_FILE"

echo ""
echo "✅ Complete SQL dump created!"
echo "📊 File size: $(du -h "$COMPLETE_FILE" | cut -f1)"
echo "📄 Tables: $(grep -c 'CREATE TABLE' "$COMPLETE_FILE")"
echo "📁 Location: $COMPLETE_FILE"
echo ""
echo "✅ Functions fixed: CREATE OR REPLACE FUNCTION"
echo ""
echo "🚀 Ready to restore:"
echo "   ./restore-sql-to-dev.sh $COMPLETE_FILE"

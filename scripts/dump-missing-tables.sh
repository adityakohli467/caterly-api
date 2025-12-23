#!/bin/bash

# Dump specific missing tables to SQL
# Usage: ./dump-missing-tables.sh table1 table2 table3

set -e

LOCAL_DB="stdurex_db"
LOCAL_USER="postgres"
LOCAL_HOST="localhost"
LOCAL_PORT="5432"

OUTPUT_DIR="./sql-dumps"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SQL_FILE="${OUTPUT_DIR}/missing_tables_${TIMESTAMP}.sql"

mkdir -p "$OUTPUT_DIR"

TABLES="$@"

if [ -z "$TABLES" ]; then
    echo "Usage: $0 table1 table2 table3 ..."
    echo "Example: $0 user orders customer"
    exit 1
fi

echo "📦 Dumping missing tables..."
echo "📋 Tables: $TABLES"
echo "📁 Output: $SQL_FILE"
echo ""

# Dump schema and data for specific tables
pg_dump \
  --host="$LOCAL_HOST" \
  --port="$LOCAL_PORT" \
  --username="$LOCAL_USER" \
  --dbname="$LOCAL_DB" \
  --format=plain \
  --inserts \
  --no-owner \
  --no-acl \
  --table="$TABLES" \
  --verbose \
  --file="$SQL_FILE"

echo ""
echo "✅ Dump completed!"
echo "📊 File size: $(du -h "$SQL_FILE" | cut -f1)"
echo "📁 Location: $SQL_FILE"

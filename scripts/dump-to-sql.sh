#!/bin/bash

# Dump Local Database to Plain SQL File
# Source: Local stdurex_db
# Output: Plain SQL file with schema and data

set -e

# Local database connection
LOCAL_DB="stdurex_db"
LOCAL_USER="postgres"
LOCAL_HOST="localhost"
LOCAL_PORT="5432"

# Output file
OUTPUT_DIR="./sql-dumps"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SQL_FILE="${OUTPUT_DIR}/stdurex_db_${TIMESTAMP}.sql"

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "📦 Dumping local database to SQL file: ${LOCAL_DB}"
echo "📁 Output file: ${SQL_FILE}"
echo ""

# Create plain SQL dump with:
# - Schema (tables, indexes, constraints, etc.)
# - Data (INSERT statements)
# - Extensions
# - Sequences
pg_dump \
  --host="$LOCAL_HOST" \
  --port="$LOCAL_PORT" \
  --username="$LOCAL_USER" \
  --dbname="$LOCAL_DB" \
  --format=plain \
  --verbose \
  --no-owner \
  --no-acl \
  --file="$SQL_FILE"

echo ""
echo "✅ SQL dump completed successfully!"
echo "📊 File size: $(du -h "$SQL_FILE" | cut -f1)"
echo "📁 Location: $SQL_FILE"
echo ""
echo "🚀 To restore to dev database:"
echo "   psql \"postgresql://postgres:z6r-miWc%2671d2R2Gwiyv@dev-new-global-caterly.cbaiaa2m4c7z.ap-southeast-2.rds.amazonaws.com:5432/stn-db\" -f $SQL_FILE"

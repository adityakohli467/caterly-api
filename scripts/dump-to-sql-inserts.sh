#!/bin/bash

# Dump Local Database to SQL File with INSERT Statements
# Source: Local stdurex_db
# Output: Plain SQL file with INSERT statements (not COPY)

set -e

# Local database connection
LOCAL_DB="stdurex_db"
LOCAL_USER="postgres"
LOCAL_HOST="localhost"
LOCAL_PORT="5432"

# Output file
OUTPUT_DIR="./sql-dumps"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SQL_FILE="${OUTPUT_DIR}/stdurex_db_inserts_${TIMESTAMP}.sql"

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "📦 Dumping local database to SQL file with INSERT statements: ${LOCAL_DB}"
echo "📁 Output file: ${SQL_FILE}"
echo ""

# Create plain SQL dump with INSERT statements instead of COPY
# --inserts: Use INSERT statements instead of COPY
# --no-owner: Don't output commands to set ownership
# --no-acl: Don't output access privileges
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
  --file="$SQL_FILE"

echo ""
echo "✅ SQL dump completed successfully!"
echo "📊 File size: $(du -h "$SQL_FILE" | cut -f1)"
echo "📁 Location: $SQL_FILE"
echo ""
echo "🚀 To restore to dev database:"
echo "   cd scripts"
echo "   ./restore-sql-to-dev.sh $SQL_FILE"

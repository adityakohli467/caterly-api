#!/bin/bash

# Fix SQL file to use CREATE OR REPLACE FUNCTION instead of CREATE FUNCTION
# This prevents errors when functions already exist

set -e

SQL_FILE="${1:-$(ls -t sql-dumps/*inserts*.sql 2>/dev/null | head -1)}"

if [ ! -f "$SQL_FILE" ]; then
    echo "❌ Error: SQL file not found: $SQL_FILE"
    echo "Usage: $0 [path-to-sql-file]"
    exit 1
fi

FIXED_FILE="${SQL_FILE%.sql}_fixed_$(date +%Y%m%d_%H%M%S).sql"

echo "🔧 Fixing SQL file..."
echo "📁 Source: $SQL_FILE"
echo "📁 Output: $FIXED_FILE"
echo ""

# Replace CREATE FUNCTION with CREATE OR REPLACE FUNCTION
sed 's/^CREATE FUNCTION/CREATE OR REPLACE FUNCTION/g' "$SQL_FILE" > "$FIXED_FILE"

echo "✅ Fixed SQL file created!"
echo "📊 Size: $(du -h "$FIXED_FILE" | cut -f1)"
echo ""
echo "Changes:"
echo "  - CREATE FUNCTION → CREATE OR REPLACE FUNCTION"
echo ""
echo "Functions updated: $(grep -c 'CREATE OR REPLACE FUNCTION' "$FIXED_FILE")"
echo ""
echo "🚀 Ready to restore:"
echo "   ./restore-sql-to-dev.sh $FIXED_FILE"

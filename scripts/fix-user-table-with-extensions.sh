#!/bin/bash

# Fix user table SQL file to include required extensions

set -e

USER_FILE="${1:-$(ls -t sql-dumps/user_table_with_data_*.sql 2>/dev/null | head -1)}"

if [ ! -f "$USER_FILE" ]; then
    echo "❌ Error: User table SQL file not found: $USER_FILE"
    exit 1
fi

FIXED_FILE="${USER_FILE%.sql}_with_extensions.sql"

echo "🔧 Fixing user table SQL file..."
echo "📁 Source: $USER_FILE"
echo "📁 Output: $FIXED_FILE"
echo ""

# Create new file with extensions at the top
cat > "$FIXED_FILE" << 'EXTENSIONS'
--
-- Enable required extensions for user table
-- These must be created BEFORE the table creation
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

EXTENSIONS

# Append the original SQL file
cat "$USER_FILE" >> "$FIXED_FILE"

echo "✅ Fixed SQL file created!"
echo "📊 Size: $(du -h "$FIXED_FILE" | cut -f1)"
echo "📁 Location: $FIXED_FILE"
echo ""
echo "✅ Added at the beginning:"
echo "   - CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
echo "   - CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";"
echo ""
echo "🚀 Ready to restore:"
echo "   ./restore-sql-to-dev.sh $FIXED_FILE"

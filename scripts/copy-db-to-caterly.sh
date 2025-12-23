#!/bin/bash

# Script to copy stdurex_db to caterly_db
# This creates a complete copy of the database with all data, tables, and structure
# Usage: ./copy-db-to-caterly.sh [--force] to automatically drop existing target database

set -e

FORCE_DROP=false
if [[ "$1" == "--force" ]]; then
    FORCE_DROP=true
fi

SOURCE_DB="stdurex_db"
TARGET_DB="caterly_db"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"

echo "=========================================="
echo "Copying database: $SOURCE_DB -> $TARGET_DB"
echo "=========================================="

# Check if source database exists
echo "Checking if source database exists..."
if ! psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $SOURCE_DB; then
    echo "ERROR: Source database '$SOURCE_DB' does not exist!"
    exit 1
fi

# Check if target database already exists
if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $TARGET_DB; then
    echo "WARNING: Target database '$TARGET_DB' already exists!"
    if [ "$FORCE_DROP" = true ]; then
        echo "Dropping existing database '$TARGET_DB' (--force flag set)..."
        psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "DROP DATABASE IF EXISTS $TARGET_DB;"
    else
        read -p "Do you want to drop and recreate it? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "Dropping existing database '$TARGET_DB'..."
            psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "DROP DATABASE IF EXISTS $TARGET_DB;"
        else
            echo "Aborted. Exiting."
            exit 1
        fi
    fi
fi

# Create the target database
echo "Creating target database '$TARGET_DB'..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "CREATE DATABASE $TARGET_DB;"

# Copy the database structure and data using TEMPLATE (fastest method)
echo "Copying database structure and data using TEMPLATE..."
echo "This may take a few minutes depending on database size..."

# First, disconnect all connections to source database
echo "Disconnecting active connections to source database..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$SOURCE_DB' AND pid <> pg_backend_pid();" || true

# Drop and recreate target database using TEMPLATE
echo "Dropping target database if exists..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS $TARGET_DB;"

# Create target database as a copy of source using TEMPLATE
echo "Creating target database as copy of source..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $TARGET_DB WITH TEMPLATE $SOURCE_DB;"

echo ""
echo "=========================================="
echo "Database copy completed successfully!"
echo "Source: $SOURCE_DB"
echo "Target: $TARGET_DB"
echo "=========================================="

# Verify the copy
echo ""
echo "Verifying database copy..."
TABLE_COUNT_SOURCE=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $SOURCE_DB -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
TABLE_COUNT_TARGET=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $TARGET_DB -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)

echo "Source database tables: $TABLE_COUNT_SOURCE"
echo "Target database tables: $TABLE_COUNT_TARGET"

if [ "$TABLE_COUNT_SOURCE" -eq "$TABLE_COUNT_TARGET" ]; then
    echo "✓ Table count matches!"
else
    echo "⚠ Warning: Table count mismatch!"
fi

echo ""
echo "Next steps:"
echo "1. Update DATABASE_URL environment variable or database.config.ts"
echo "2. Restart your application"
echo "3. Test the connection to caterly_db"


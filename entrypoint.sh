#!/bin/sh

echo "=== Entrypoint starting ==="

# Fix volume ownership (volume mounts as root)
chown -R nestjs:nodejs /app/uploads 2>/dev/null || true

# Seed volume with files from Docker image
if [ -d "/app/uploads-seed/caterly_assets" ]; then
  SEED_COUNT=$(ls /app/uploads-seed/caterly_assets 2>/dev/null | wc -l)
  VOL_COUNT=$(ls /app/uploads/caterly_assets 2>/dev/null | wc -l)
  echo "Seed has $SEED_COUNT files, volume has $VOL_COUNT files"

  if [ "$SEED_COUNT" -gt "$VOL_COUNT" ]; then
    echo "Volume is missing files. Copying all from seed..."
    cp -r /app/uploads-seed/* /app/uploads/
    chown -R nestjs:nodejs /app/uploads
    echo "Done. Volume now has $(ls /app/uploads/caterly_assets | wc -l) files"
  else
    echo "Volume is up to date. Skipping seed."
  fi
else
  echo "WARNING: /app/uploads-seed/caterly_assets not found!"
fi

# Drop to nestjs user and start the application
exec su-exec nestjs node dist/main.js

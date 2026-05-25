#!/bin/sh

echo "=== Entrypoint starting ==="
echo "Checking /app/uploads-seed: $(ls /app/uploads-seed 2>/dev/null | head -5)"
echo "Checking /app/uploads: $(ls /app/uploads 2>/dev/null | head -5)"

# Seed volume with files if it's empty (first deploy)
if [ -d "/app/uploads-seed" ] && [ "$(ls -A /app/uploads-seed 2>/dev/null)" ]; then
  # Check if volume is empty (no caterly_assets folder or it's empty)
  if [ ! -d "/app/uploads/caterly_assets" ] || [ -z "$(ls -A /app/uploads/caterly_assets 2>/dev/null)" ]; then
    echo "Volume is empty. Seeding with initial assets..."
    cp -r /app/uploads-seed/* /app/uploads/
    echo "Seed complete. Files in uploads/caterly_assets: $(ls /app/uploads/caterly_assets | wc -l)"
  else
    echo "Volume already has data: $(ls /app/uploads/caterly_assets | wc -l) files. Skipping seed."
  fi
else
  echo "WARNING: /app/uploads-seed is empty or missing!"
fi

# Start the application
exec node dist/main.js

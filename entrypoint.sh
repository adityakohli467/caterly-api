#!/bin/sh

# Seed volume with files if it's empty (first deploy)
if [ -d "/app/uploads-seed" ] && [ "$(ls -A /app/uploads-seed 2>/dev/null)" ]; then
  # Check if volume is empty (no caterly_assets folder or it's empty)
  if [ ! -d "/app/uploads/caterly_assets" ] || [ -z "$(ls -A /app/uploads/caterly_assets 2>/dev/null)" ]; then
    echo "ðŸ“‚ Volume is empty. Seeding with initial assets..."
    cp -rn /app/uploads-seed/* /app/uploads/ 2>/dev/null || true
    echo "âœ… Volume seeded successfully."
  else
    echo "ðŸ“‚ Volume already has data. Skipping seed."
  fi
fi

# Start the application
exec node dist/main.js

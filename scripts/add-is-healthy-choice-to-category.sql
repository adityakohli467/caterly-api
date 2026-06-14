-- Add is_healthy_choice column to category table
ALTER TABLE category ADD COLUMN IF NOT EXISTS is_healthy_choice BOOLEAN DEFAULT false;

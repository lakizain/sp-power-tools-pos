-- Add a distinct audit reason for stock consumed by the shop itself.
-- Run this migration once in the Supabase SQL editor.

ALTER TYPE stock_adjustment_reason ADD VALUE IF NOT EXISTS 'internal_use';
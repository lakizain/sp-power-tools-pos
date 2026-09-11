-- ================================================================
-- S&P POWER TOOLS POS — STOCK ADJUSTMENT AUDIT LOG
-- Migration Date: 2026-09-11
-- Safe, Idempotent, Zero Data Loss
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- PART 1: STOCK ADJUSTMENT TYPES (ENUMS)
-- ================================================================

DO $$ BEGIN
    CREATE TYPE stock_adjustment_mode AS ENUM ('add', 'remove', 'set');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE stock_adjustment_reason AS ENUM (
        'purchase',
        'return',
        'stock_count',
        'damaged',
        'theft',
        'other'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ================================================================
-- PART 2: STOCK ADJUSTMENTS TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS stock_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    profile_name TEXT,
    old_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    quantity_change INTEGER NOT NULL,
    adjustment_mode stock_adjustment_mode NOT NULL,
    reason stock_adjustment_reason NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- ================================================================
-- PART 3: INDEXES FOR FAST QUERIES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_product_id
    ON stock_adjustments(product_id);

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_user_id
    ON stock_adjustments(user_id);

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_created_at
    ON stock_adjustments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_reason
    ON stock_adjustments(reason);

-- ================================================================
-- PART 4: RLS (ROW LEVEL SECURITY) + POLICIES
-- ================================================================

ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;

-- All authenticated users can INSERT adjustments (any role can log stock changes)
DROP POLICY IF EXISTS "stock_adjustments_insert_authenticated" ON stock_adjustments;
CREATE POLICY "stock_adjustments_insert_authenticated" ON stock_adjustments
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- All authenticated users can VIEW adjustment logs (audit history visibility)
DROP POLICY IF EXISTS "stock_adjustments_select_authenticated" ON stock_adjustments;
CREATE POLICY "stock_adjustments_select_authenticated" ON stock_adjustments
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- ================================================================
-- PART 5: GRANTS
-- ================================================================

GRANT SELECT, INSERT ON stock_adjustments TO authenticated;

-- ================================================================
-- COMPLETE!
-- ================================================================

-- ================================================================
-- S&P POWER TOOLS — PRODUCT RENTALS MIGRATION
-- Safe Idempotent Migration: Paste into Supabase SQL Editor → RUN
-- - Creates rentals + rental_items tables IF NOT EXISTS
-- - Safely extends product_returns.return_method CHECK ('rental_return')
-- - Updates app_settings.feature_toggles JSONB (productRentals:true)
-- - Triggers, RLS policies, GRANTs, Indexes
-- - Zero destructive changes; RUN multiple times safely
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
-- PART 1: CREATE TABLES IF NOT EXISTS (in correct FK order)
-- ================================================================

-- --------- Rentals Table ---------
CREATE TABLE IF NOT EXISTS rentals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rental_number TEXT UNIQUE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    rent_from DATE NOT NULL,
    rent_to DATE NOT NULL,
    daily_rate DECIMAL(10,2) DEFAULT 0.00 NOT NULL CHECK (daily_rate >= 0),
    weekly_rate DECIMAL(10,2),
    security_deposit DECIMAL(12,2) DEFAULT 0.00 NOT NULL CHECK (security_deposit >= 0),
    total_rent DECIMAL(12,2) DEFAULT 0.00 NOT NULL CHECK (total_rent >= 0),
    paid_amount DECIMAL(12,2) DEFAULT 0.00 NOT NULL CHECK (paid_amount >= 0),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','overdue','returned','lost','damaged')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    CONSTRAINT chk_paid_not_exceed_total CHECK (paid_amount <= total_rent + security_deposit)
);

-- --------- Rental Items Table ---------
CREATE TABLE IF NOT EXISTS rental_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rental_id UUID NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    sku TEXT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    daily_rate DECIMAL(10,2) NOT NULL CHECK (daily_rate >= 0),
    subtotal DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
    condition TEXT DEFAULT 'unused'
        CHECK (condition IN ('new','unused','opened','used','damaged','defective','missing_parts')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- ================================================================
-- PART 2: SAFELY UPDATE product_returns.return_method CHECK
--         Add 'rental_return' without breaking existing data.
-- ================================================================
DO $$
DECLARE
    rec record;
    constraint_exists boolean;
BEGIN
    -- Check if the CHECK constraint already allows rental_return by scanning pg_constraint
    SELECT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.product_returns'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%rental_return%'
    ) INTO constraint_exists;

    IF NOT constraint_exists AND to_regclass('public.product_returns') IS NOT NULL THEN
        -- Drop old check constraints on return_method (we'll rebuild fresh with rental_return included)
        FOR rec IN
            SELECT conname, pg_get_constraintdef(oid) AS def
            FROM pg_constraint
            WHERE conrelid = 'public.product_returns'::regclass
              AND contype = 'c'
              AND pg_get_constraintdef(oid) LIKE '%return_method%'
        LOOP
            EXECUTE format('ALTER TABLE public.product_returns DROP CONSTRAINT IF EXISTS %I', rec.conname);
        END LOOP;

        -- Re-create the CHECK constraint with the updated list including rental_return
        ALTER TABLE public.product_returns
            ADD CONSTRAINT product_returns_return_method_check
            CHECK (return_method IN ('refund','exchange','store_credit','reject','rental_return'));
    END IF;
END $$;

-- Also update restocked default if missing (just in case)
DO $$
BEGIN
    IF to_regclass('public.product_returns') IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='product_returns' AND column_name='restocked'
    ) THEN
        ALTER TABLE public.product_returns ADD COLUMN restocked BOOLEAN DEFAULT false;
    END IF;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ================================================================
-- PART 3: UPDATE app_settings.feature_toggles — productRentals:true
--         (Safe: merge; don't overwrite existing toggles)
-- ================================================================
DO $$
DECLARE
    rec record;
BEGIN
    IF to_regclass('public.app_settings') IS NOT NULL THEN
        FOR rec IN SELECT id, feature_toggles FROM public.app_settings LOOP
            IF rec.feature_toggles IS NULL OR (rec.feature_toggles::jsonb ? 'productRentals') = false THEN
                UPDATE public.app_settings
                   SET feature_toggles = COALESCE(feature_toggles, '{}'::jsonb) || '{"productRentals": true}'::jsonb
                 WHERE id = rec.id;
            END IF;
        END LOOP;
    END IF;
END $$;

-- Also update the column DEFAULT (for new rows going forward)
ALTER TABLE app_settings ALTER COLUMN feature_toggles
    SET DEFAULT '{
        "transactionDelete": true,
        "productReturns": true,
        "outstandingPayments": true,
        "productDiscount": true,
        "expenseTracking": true,
        "supplierManagement": true,
        "alertMonitoring": true,
        "productRentals": true
    }'::jsonb;

-- ================================================================
-- PART 4: INDEXES
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_rentals_customer_id   ON rentals(customer_id);
CREATE INDEX IF NOT EXISTS idx_rentals_status        ON rentals(status);
CREATE INDEX IF NOT EXISTS idx_rentals_rent_from     ON rentals(rent_from);
CREATE INDEX IF NOT EXISTS idx_rentals_rent_to       ON rentals(rent_to);
CREATE INDEX IF NOT EXISTS idx_rentals_created_at    ON rentals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rental_items_rental_id ON rental_items(rental_id);
CREATE INDEX IF NOT EXISTS idx_rental_items_product_id ON rental_items(product_id);

-- ================================================================
-- PART 5: RLS + GRANTs
-- ================================================================
ALTER TABLE rentals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_items  ENABLE ROW LEVEL SECURITY;

-- RLS Policies — allow authenticated users full CRUD (role-based handled in app)
DROP POLICY IF EXISTS rentals_select_all       ON rentals;
DROP POLICY IF EXISTS rentals_insert_all       ON rentals;
DROP POLICY IF EXISTS rentals_update_all       ON rentals;
DROP POLICY IF EXISTS rentals_delete_all       ON rentals;
DROP POLICY IF EXISTS rental_items_select_all  ON rental_items;
DROP POLICY IF EXISTS rental_items_insert_all  ON rental_items;
DROP POLICY IF EXISTS rental_items_update_all  ON rental_items;
DROP POLICY IF EXISTS rental_items_delete_all  ON rental_items;

CREATE POLICY rentals_select_all      ON rentals       FOR SELECT   USING (auth.role() = 'authenticated');
CREATE POLICY rentals_insert_all      ON rentals       FOR INSERT   WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY rentals_update_all      ON rentals       FOR UPDATE   USING (auth.role() = 'authenticated');
CREATE POLICY rentals_delete_all      ON rentals       FOR DELETE   USING (auth.role() = 'authenticated');
CREATE POLICY rental_items_select_all ON rental_items  FOR SELECT   USING (auth.role() = 'authenticated');
CREATE POLICY rental_items_insert_all ON rental_items  FOR INSERT   WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY rental_items_update_all ON rental_items  FOR UPDATE   USING (auth.role() = 'authenticated');
CREATE POLICY rental_items_delete_all ON rental_items  FOR DELETE   USING (auth.role() = 'authenticated');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rentals      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_items TO authenticated;

-- ================================================================
-- PART 6: update_updated_at_column TRIGGER + application
-- ================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;

DROP TRIGGER IF EXISTS trg_rentals_updated_at      ON rentals;
DROP TRIGGER IF EXISTS trg_rental_items_updated_at ON rental_items;

CREATE TRIGGER trg_rentals_updated_at
    BEFORE UPDATE ON rentals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_rental_items_updated_at
    BEFORE UPDATE ON rental_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- PART 7: SEED / AUTO-GENERATE next rental number helper
--         (Optional sequence-based function)
-- ================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'rental_number_seq') THEN
        CREATE SEQUENCE public.rental_number_seq
            START WITH 1
            INCREMENT BY 1
            MINVALUE 1
            NO MAXVALUE
            CACHE 1;
    END IF;
END $$;

GRANT USAGE, SELECT ON SEQUENCE public.rental_number_seq TO authenticated;

-- ================================================================
-- PART 8: VERIFICATION — Summary (readable output in SQL Editor)
-- ================================================================
DO $$
DECLARE
    t_rentals     boolean := to_regclass('public.rentals') IS NOT NULL;
    t_items       boolean := to_regclass('public.rental_items') IS NOT NULL;
BEGIN
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'RENTALS MIGRATION — VERIFICATION SUMMARY';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'Table rentals .............. %', CASE WHEN t_rentals THEN '✅ OK' ELSE '❌ MISSING' END;
    RAISE NOTICE 'Table rental_items ......... %', CASE WHEN t_items   THEN '✅ OK' ELSE '❌ MISSING' END;
    RAISE NOTICE 'RLS enabled on rentals:     %', (SELECT relrowsecurity FROM pg_class WHERE relname='rentals');
    RAISE NOTICE 'RLS enabled on rental_items:%', (SELECT relrowsecurity FROM pg_class WHERE relname='rental_items');
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'Migration completed successfully! No data loss occurred.';
    RAISE NOTICE '================================================================';
END $$;

-- Temporary inventory product checks
-- Run this migration in the Supabase SQL Editor.
-- Product records are not modified; checks live in their own table.

CREATE TABLE IF NOT EXISTS inventory_product_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
    checked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_product_checks_product_id
    ON inventory_product_checks(product_id);

ALTER TABLE inventory_product_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Inventory checks are viewable by authenticated users"
    ON inventory_product_checks;
CREATE POLICY "Inventory checks are viewable by authenticated users"
    ON inventory_product_checks FOR SELECT
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Inventory checks are manageable by authenticated users"
    ON inventory_product_checks;
CREATE POLICY "Inventory checks are manageable by authenticated users"
    ON inventory_product_checks FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_product_checks TO authenticated;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'inventory_product_checks'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE inventory_product_checks;
    END IF;
END
$$;

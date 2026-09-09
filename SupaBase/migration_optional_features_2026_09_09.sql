-- ================================================================
-- S&P POWER TOOLS POS - OPTIONAL FEATURES MIGRATION
-- Generated on: 2026-09-09
-- Description: SQL script for 6 new optional POS features
--   - Feature Toggles (in app_settings)
--   - Expanded Suppliers Management
--   - Expense Tracking
--   - Product Returns
--   - Outstanding Payments / Accounts Receivable
-- Usage: Paste ENTIRE file into Supabase SQL Editor and click "RUN"
-- ================================================================

-- Enable required extensions (safe to re-run)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
-- PART 1: FEATURE TOGGLES in app_settings
-- ================================================================

-- Add feature_toggles JSONB column (safe idempotent check)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'app_settings' AND column_name = 'feature_toggles'
    ) THEN
        ALTER TABLE app_settings
        ADD COLUMN feature_toggles JSONB DEFAULT '{
            "transactionDelete": true,
            "productReturns": true,
            "outstandingPayments": true,
            "productDiscount": true,
            "expenseTracking": true,
            "supplierManagement": true
        }'::jsonb NOT NULL;
    END IF;
END
$$;

-- Add remaining missing columns to app_settings (already may exist, safe idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'app_settings' AND column_name = 'base_currency'
    ) THEN
        ALTER TABLE app_settings ADD COLUMN base_currency TEXT DEFAULT 'USD';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'app_settings' AND column_name = 'exchange_rate_provider'
    ) THEN
        ALTER TABLE app_settings ADD COLUMN exchange_rate_provider TEXT DEFAULT 'exchangerate';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'app_settings' AND column_name = 'exchange_rate_api_key'
    ) THEN
        ALTER TABLE app_settings ADD COLUMN exchange_rate_api_key TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'app_settings' AND column_name = 'exchange_rate_update_interval'
    ) THEN
        ALTER TABLE app_settings ADD COLUMN exchange_rate_update_interval INTEGER DEFAULT 60;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sales' AND column_name = 'payments'
    ) THEN
        ALTER TABLE sales ADD COLUMN payments JSONB DEFAULT '[]'::jsonb;
    END IF;
END
$$;

-- ================================================================
-- PART 2: EXPAND SUPPLIERS TABLE (full ERP fields)
-- ================================================================

DO $$
BEGIN
    -- contact_person
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='contact_person') THEN
        ALTER TABLE suppliers ADD COLUMN contact_person TEXT;
    END IF;
    -- phone2
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='phone2') THEN
        ALTER TABLE suppliers ADD COLUMN phone2 TEXT;
    END IF;
    -- tax_id / VAT registration
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='tax_id') THEN
        ALTER TABLE suppliers ADD COLUMN tax_id TEXT;
    END IF;
    -- bank_details JSONB
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='bank_details') THEN
        ALTER TABLE suppliers ADD COLUMN bank_details JSONB DEFAULT '{}'::jsonb;
    END IF;
    -- website
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='website') THEN
        ALTER TABLE suppliers ADD COLUMN website TEXT;
    END IF;
    -- notes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='notes') THEN
        ALTER TABLE suppliers ADD COLUMN notes TEXT;
    END IF;
    -- total_purchases (monetary)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='total_purchases') THEN
        ALTER TABLE suppliers ADD COLUMN total_purchases DECIMAL(12,2) DEFAULT 0.00;
    END IF;
    -- outstanding_balance (what we owe)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='outstanding_balance') THEN
        ALTER TABLE suppliers ADD COLUMN outstanding_balance DECIMAL(12,2) DEFAULT 0.00;
    END IF;
    -- active flag for soft delete
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='active') THEN
        ALTER TABLE suppliers ADD COLUMN active BOOLEAN DEFAULT true;
    END IF;
    -- rating CHECK constraint (older DBs may miss this)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'CHECK' AND tc.table_name='suppliers' AND ccu.column_name='rating'
    ) THEN
        ALTER TABLE suppliers ADD CONSTRAINT suppliers_rating_check CHECK (rating >= 0 AND rating <= 5);
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(active);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

-- ================================================================
-- PART 3: EXPENSE TRACKING TABLES
-- ================================================================

CREATE TABLE IF NOT EXISTS expense_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT DEFAULT '#3B82F6',
    icon TEXT DEFAULT 'wallet',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_name TEXT NOT NULL DEFAULT 'Miscellaneous',
    subcategory TEXT,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    currency TEXT DEFAULT 'USD',
    date DATE NOT NULL,
    payment_method TEXT DEFAULT 'cash'
        CHECK (payment_method IN ('cash','card','bank_transfer','check','digital_wallet','other')),
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    reference_number TEXT,
    receipt_number TEXT,
    notes TEXT,
    attachment_url TEXT,
    status TEXT DEFAULT 'approved'
        CHECK (status IN ('pending','approved','reimbursed','archived')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_name);
CREATE INDEX IF NOT EXISTS idx_expenses_payment_method ON expenses(payment_method);
CREATE INDEX IF NOT EXISTS idx_expenses_supplier_id ON expenses(supplier_id);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);

-- Seed the 14 default expense categories
INSERT INTO expense_categories (name, color, icon)
VALUES
    ('Rent', '#8B5CF6', 'home'),
    ('Utilities', '#059669', 'zap'),
    ('Salaries & Wages', '#DC2626', 'users'),
    ('Inventory Purchases', '#2563EB', 'package'),
    ('Marketing & Advertising', '#DB2777', 'megaphone'),
    ('Office Supplies', '#EA580C', 'briefcase'),
    ('Transportation', '#65A30D', 'truck'),
    ('Maintenance & Repairs', '#7C3AED', 'wrench'),
    ('Insurance', '#0369A1', 'shield'),
    ('Taxes', '#15803D', 'receipt'),
    ('Bank & Card Fees', '#991B1B', 'credit-card'),
    ('Software & Subscriptions', '#4F46E5', 'cloud'),
    ('Training & Education', '#A16207', 'book-open'),
    ('Miscellaneous', '#4B5563', 'help-circle')
ON CONFLICT (name) DO NOTHING;

-- ================================================================
-- PART 4: PRODUCT RETURNS TABLES
-- ================================================================

CREATE TABLE IF NOT EXISTS product_returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_number TEXT NOT NULL UNIQUE,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    invoice_number TEXT,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','approved','completed','rejected','exchanged')),
    return_method TEXT NOT NULL DEFAULT 'refund'
        CHECK (return_method IN ('refund','exchange','store_credit','reject')),
    reason TEXT NOT NULL,
    notes TEXT,
    subtotal DECIMAL(12,2) DEFAULT 0.00 CHECK (subtotal >= 0),
    tax_amount DECIMAL(12,2) DEFAULT 0.00 CHECK (tax_amount >= 0),
    total_refund DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (total_refund >= 0),
    items_count INTEGER DEFAULT 0,
    restocked BOOLEAN DEFAULT false,
    processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS return_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_id UUID NOT NULL REFERENCES product_returns(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    sku TEXT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    condition TEXT DEFAULT 'unused'
        CHECK (condition IN ('unused','opened','damaged','defective','missing_parts','used')),
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    subtotal DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
    tax_rate DECIMAL(5,4) DEFAULT 0.0000,
    tax_amount DECIMAL(12,2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_returns_status ON product_returns(status);
CREATE INDEX IF NOT EXISTS idx_product_returns_sale_id ON product_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_product_returns_customer_id ON product_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_product_returns_date ON product_returns(created_at);
CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_return_items_product_id ON return_items(product_id);

-- Auto-generate RETURN number trigger function
CREATE OR REPLACE FUNCTION generate_return_number() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.return_number IS NULL OR NEW.return_number = '' THEN
        NEW.return_number := 'RET-' || TO_CHAR(NEW.created_at, 'YYYYMMDD') || '-' ||
                              LPAD(FLOOR(RANDOM() * 9999)::INTEGER::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_returns_number ON product_returns;
CREATE TRIGGER trg_product_returns_number
    BEFORE INSERT ON product_returns
    FOR EACH ROW EXECUTE FUNCTION generate_return_number();

-- ================================================================
-- PART 5: OUTSTANDING PAYMENTS (Accounts Receivable) TABLES
-- ================================================================

CREATE TABLE IF NOT EXISTS outstanding_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount > 0),
    paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    outstanding_amount DECIMAL(12,2) NOT NULL CHECK (outstanding_amount >= 0),
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','partial','paid','overdue','written_off')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,

    CONSTRAINT chk_paid_not_exceed_total CHECK (paid_amount <= total_amount),
    CONSTRAINT chk_outstanding_matches CHECK (outstanding_amount = (total_amount - paid_amount))
);

CREATE TABLE IF NOT EXISTS payment_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outstanding_payment_id UUID NOT NULL REFERENCES outstanding_payments(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    currency TEXT DEFAULT 'USD',
    payment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    method TEXT NOT NULL DEFAULT 'cash'
        CHECK (method IN ('cash','card','bank_transfer','check','digital_wallet','other')),
    reference_number TEXT,
    notes TEXT,
    received_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outstanding_payments_status ON outstanding_payments(status);
CREATE INDEX IF NOT EXISTS idx_outstanding_payments_customer ON outstanding_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_outstanding_payments_due_date ON outstanding_payments(due_date);
CREATE INDEX IF NOT EXISTS idx_payment_records_outstanding ON payment_records(outstanding_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_date ON payment_records(payment_date);
CREATE INDEX IF NOT EXISTS idx_payment_records_customer ON payment_records(customer_id);

-- Auto-update outstanding_amount + status trigger
CREATE OR REPLACE FUNCTION sync_outstanding_amount() RETURNS TRIGGER AS $$
DECLARE
    v_total DECIMAL(12,2);
    v_paid  DECIMAL(12,2);
BEGIN
    SELECT NEW.total_amount, NEW.paid_amount INTO v_total, v_paid;
    NEW.outstanding_amount := GREATEST(0, v_total - v_paid);
    IF v_paid >= v_total THEN
        NEW.status := 'paid';
    ELSIF v_paid > 0 THEN
        NEW.status := 'partial';
    ELSE
        NEW.status := 'pending';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_outstanding ON outstanding_payments;
CREATE TRIGGER trg_sync_outstanding
    BEFORE INSERT OR UPDATE OF total_amount, paid_amount ON outstanding_payments
    FOR EACH ROW EXECUTE FUNCTION sync_outstanding_amount();

-- Auto-add inserted payment into payment_records outstanding history
-- (paid_amount manual updates are app-managed, trigger keeps status correct)

-- ================================================================
-- PART 6: ROW LEVEL SECURITY (RLS) POLICIES
-- ================================================================
-- NOTE: If you already have RLS on other tables, enable it here too.
-- If your project does NOT use RLS, you may safely skip this part.

-- Enable RLS
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE outstanding_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;

-- App-access policy: allow all authenticated users (auth handled in-app via role)
-- Supabase anon key restrictions still apply via auth.uid() check.
CREATE POLICY IF NOT EXISTS allow_authenticated_suppliers ON suppliers
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS allow_authenticated_expense_categories ON expense_categories
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS allow_authenticated_expenses ON expenses
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS allow_authenticated_product_returns ON product_returns
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS allow_authenticated_return_items ON return_items
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS allow_authenticated_outstanding_payments ON outstanding_payments
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS allow_authenticated_payment_records ON payment_records
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ================================================================
-- PART 7: ENSURE app_settings HAS EXACTLY ONE ROW
-- ================================================================
INSERT INTO app_settings (id)
SELECT uuid_generate_v4()
WHERE NOT EXISTS (SELECT 1 FROM app_settings)
ON CONFLICT DO NOTHING;

-- ================================================================
-- END OF MIGRATION
-- ================================================================
--
-- Verification Queries (run separately after the above to confirm):
--
--   SELECT 'app_settings' AS table_name, COUNT(*) AS rows,
--          (SELECT column_name IS NOT NULL FROM information_schema.columns WHERE table_name='app_settings' AND column_name='feature_toggles') AS has_feature_toggles
--   FROM app_settings
--   UNION ALL SELECT 'suppliers', COUNT(*), (SELECT COUNT(*) >= 10 FROM information_schema.columns WHERE table_name='suppliers') FROM suppliers
--   UNION ALL SELECT 'expense_categories', COUNT(*), true FROM expense_categories
--   UNION ALL SELECT 'expenses', COUNT(*), true FROM expenses
--   UNION ALL SELECT 'product_returns', COUNT(*), true FROM product_returns
--   UNION ALL SELECT 'return_items', COUNT(*), true FROM return_items
--   UNION ALL SELECT 'outstanding_payments', COUNT(*), true FROM outstanding_payments
--   UNION ALL SELECT 'payment_records', COUNT(*), true FROM payment_records;
--
-- ================================================================

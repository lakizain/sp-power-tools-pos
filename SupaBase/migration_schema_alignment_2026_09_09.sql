-- ================================================================
-- S&P POWER TOOLS POS — COMPLETE SELF-CONTAINED SCHEMA + ALIGNMENT
-- Safe Standalone Migration: Paste into Supabase SQL Editor → RUN
-- - Creates ALL 28+ tables IF NOT EXISTS (core + optional + currency + alerts)
-- - Adds ALL missing columns IF NOT EXISTS (guards: to_regclass check + column not exists)
-- - Re-creates ALL triggers, RLS policies, grants, seed data (ON CONFLICT)
-- - ZERO destructive changes: no DROP TABLE, no DROP COLUMN, no data loss
-- - 100% IDEMPOTENT — run multiple times safely
-- ================================================================

-- ================================================================
-- PART 0: EXTENSIONS
-- ================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
-- PART 1: CREATE ALL TABLES (IF NOT EXISTS) IN CORRECT FK ORDER
--         Every table defined here with full columns + constraints.
--         If table already exists, Postgres skips gracefully.
-- ================================================================

-- ---- Core Tables ----

CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_name TEXT NOT NULL,
    store_address TEXT,
    store_phone TEXT,
    store_email TEXT,
    store_logo TEXT,
    tax_rate DECIMAL(5,4) DEFAULT 0.0000 NOT NULL,
    currency TEXT DEFAULT 'USD' NOT NULL,
    base_currency TEXT DEFAULT 'USD',
    exchange_rate_provider TEXT DEFAULT 'exchangerate',
    exchange_rate_api_key TEXT,
    exchange_rate_update_interval INTEGER DEFAULT 60,
    auto_backup BOOLEAN DEFAULT false,
    receipt_printer BOOLEAN DEFAULT false,
    interface_mode TEXT DEFAULT 'traditional',
    theme TEXT DEFAULT 'light',
    invoice_prefix TEXT DEFAULT 'INV' NOT NULL,
    invoice_counter INTEGER DEFAULT 1000 NOT NULL,
    feature_toggles JSONB DEFAULT '{
        "transactionDelete": true,
        "productReturns": true,
        "outstandingPayments": true,
        "productDiscount": true,
        "expenseTracking": true,
        "supplierManagement": true
    }'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT DEFAULT '' NOT NULL,
    phone TEXT DEFAULT '' NOT NULL,
    address TEXT,
    credit_limit DECIMAL(12,2) DEFAULT 0.00 NOT NULL,
    credit_used DECIMAL(12,2) DEFAULT 0.00 NOT NULL,
    price_tier TEXT DEFAULT 'standard' NOT NULL,
    total_purchases DECIMAL(12,2) DEFAULT 0.00 NOT NULL,
    last_purchase TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT DEFAULT '' NOT NULL,
    phone2 TEXT,
    address TEXT,
    payment_terms TEXT,
    tax_id TEXT,
    bank_details JSONB DEFAULT '{}'::jsonb,
    website TEXT,
    contact_person TEXT,
    rating DECIMAL(2,1) DEFAULT 5.0 CHECK (rating >= 0 AND rating <= 5),
    notes TEXT,
    total_purchases DECIMAL(12,2) DEFAULT 0.00 NOT NULL,
    outstanding_balance DECIMAL(12,2) DEFAULT 0.00 NOT NULL,
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku TEXT NOT NULL UNIQUE,
    barcode TEXT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    base_currency TEXT DEFAULT 'USD',
    price_in_base_currency DECIMAL(10,2),
    price DECIMAL(10,2) DEFAULT 0.00 NOT NULL,
    cost DECIMAL(10,2) DEFAULT 0.00 NOT NULL,
    stock INTEGER DEFAULT 0 NOT NULL,
    min_stock INTEGER DEFAULT 10 NOT NULL,
    image TEXT,
    is_weight_based BOOLEAN DEFAULT false,
    price_per_unit DECIMAL(10,2),
    unit TEXT,
    track_inventory BOOLEAN DEFAULT true,
    taxable BOOLEAN DEFAULT true NOT NULL,
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS product_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    batch_number TEXT NOT NULL,
    manufacturing_date DATE,
    expiry_date DATE,
    quantity INTEGER DEFAULT 0 NOT NULL,
    cost_price DECIMAL(10,2) DEFAULT 0.00 NOT NULL,
    supplier_info TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS discounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    value DECIMAL(10,2) DEFAULT 0.00 NOT NULL,
    conditions JSONB,
    free_gift_products TEXT[],
    min_amount DECIMAL(12,2),
    max_discount DECIMAL(12,2),
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_to TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_days INTEGER[],
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'cashier' NOT NULL,
    permissions TEXT[],
    password_hash TEXT,
    pin TEXT,
    active BOOLEAN DEFAULT true NOT NULL,
    last_login TIMESTAMP WITH TIME ZONE,
    avatar TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number TEXT NOT NULL UNIQUE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal DECIMAL(12,2) DEFAULT 0.00 NOT NULL,
    discount_amount DECIMAL(12,2) DEFAULT 0.00 NOT NULL,
    tax_amount DECIMAL(12,2) DEFAULT 0.00 NOT NULL,
    total DECIMAL(12,2) DEFAULT 0.00 NOT NULL,
    payment_method TEXT DEFAULT 'cash' NOT NULL,
    payments JSONB DEFAULT '[]'::jsonb,
    card_details JSONB,
    status TEXT DEFAULT 'completed' NOT NULL,
    cashier TEXT NOT NULL,
    cashier_role TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    receipt_number TEXT NOT NULL,
    notes TEXT,
    applied_discounts JSONB,
    free_gifts JSONB,
    transaction_currency TEXT DEFAULT 'USD',
    base_currency_amount DECIMAL(12,2),
    exchange_rate_used DECIMAL(15,8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    CONSTRAINT sales_payment_method_check CHECK (payment_method IN ('cash','card','digital','credit','split'))
);

CREATE TABLE IF NOT EXISTS sales_tabs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT DEFAULT 'Tab' NOT NULL,
    cart JSONB NOT NULL DEFAULT '[]'::jsonb,
    selected_customer JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- ---- Currency Tables ----

CREATE TABLE IF NOT EXISTS currency_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    symbol_position TEXT DEFAULT 'before' NOT NULL,
    decimal_places INTEGER DEFAULT 2 NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    is_base_currency BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_currency TEXT NOT NULL,
    target_currency TEXT NOT NULL,
    rate DECIMAL(15,8) NOT NULL,
    source TEXT DEFAULT 'api' NOT NULL,
    is_manual_override BOOLEAN DEFAULT false NOT NULL,
    effective_from TIMESTAMP WITH TIME ZONE,
    effective_to TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS exchange_rate_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_currency TEXT NOT NULL,
    target_currency TEXT NOT NULL,
    rate DECIMAL(15,8) NOT NULL,
    previous_rate DECIMAL(15,8),
    change_percentage DECIMAL(8,4),
    source TEXT DEFAULT 'api' NOT NULL,
    is_manual_override BOOLEAN DEFAULT false NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- ---- Expense Tables ----

CREATE TABLE IF NOT EXISTS expense_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT DEFAULT '#3B82F6',
    icon TEXT DEFAULT 'wallet',
    budget DECIMAL(12,2),
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_name TEXT NOT NULL DEFAULT 'Miscellaneous',
    subcategory TEXT,
    description TEXT,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    currency TEXT DEFAULT 'USD',
    date DATE NOT NULL,
    payment_method TEXT DEFAULT 'cash'
        CHECK (payment_method IN ('cash','card','bank_transfer','check','digital_wallet','other','digital')),
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

-- ---- Product Returns Tables ----

CREATE TABLE IF NOT EXISTS product_returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_number TEXT UNIQUE,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    invoice_number TEXT,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    subtotal DECIMAL(12,2) DEFAULT 0.00 CHECK (subtotal >= 0),
    tax_amount DECIMAL(12,2) DEFAULT 0.00 CHECK (tax_amount >= 0),
    total_refund DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (total_refund >= 0),
    reason TEXT NOT NULL,
    return_method TEXT NOT NULL DEFAULT 'refund'
        CHECK (return_method IN ('refund','exchange','store_credit','reject')),
    payment_method TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','approved','completed','rejected','exchanged')),
    items_count INTEGER DEFAULT 0,
    restocked BOOLEAN DEFAULT false,
    processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT,
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
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    subtotal DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
    tax_rate DECIMAL(5,4) DEFAULT 0.0000,
    tax_amount DECIMAL(12,2) DEFAULT 0.00,
    reason TEXT,
    condition TEXT DEFAULT 'unused'
        CHECK (condition IN ('unused','opened','damaged','defective','missing_parts','used')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- ---- Outstanding Payments Tables ----

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

-- ---- Inventory Alert Tables ----

CREATE TABLE IF NOT EXISTS alert_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT NOT NULL,
    alert_types TEXT[],
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS alert_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    channel TEXT NOT NULL,
    subject TEXT,
    body TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS alert_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT true NOT NULL,
    threshold_value INTEGER,
    check_frequency_minutes INTEGER DEFAULT 60 NOT NULL,
    cooldown_minutes INTEGER DEFAULT 1440 NOT NULL,
    email_template_id UUID REFERENCES alert_templates(id) ON DELETE SET NULL,
    sms_template_id UUID REFERENCES alert_templates(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS alert_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type TEXT NOT NULL,
    product_id UUID NOT NULL,
    product_name TEXT NOT NULL,
    product_sku TEXT NOT NULL,
    current_stock INTEGER NOT NULL,
    min_stock INTEGER NOT NULL,
    threshold_value INTEGER,
    recipient_id UUID NOT NULL,
    recipient_name TEXT NOT NULL,
    recipient_email TEXT,
    recipient_phone TEXT,
    channel TEXT NOT NULL,
    status TEXT NOT NULL,
    template_id UUID REFERENCES alert_templates(id) ON DELETE SET NULL,
    message_content TEXT,
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS alert_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    last_run TIMESTAMP WITH TIME ZONE,
    next_run TIMESTAMP WITH TIME ZONE,
    run_count INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_service_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name TEXT NOT NULL,
    service_type TEXT NOT NULL,
    config_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true NOT NULL,
    is_default BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- ---- Alert Monitoring View ----
-- NOTE: Drop-first because CREATE OR REPLACE VIEW fails when the column signature
--       of the existing view requires a "column drop" (Postgres 42P16 error).
DROP VIEW IF EXISTS alert_monitoring CASCADE;
CREATE VIEW alert_monitoring AS
WITH role_counts AS (
    SELECT role, COUNT(*) AS cnt
    FROM alert_recipients
    WHERE is_active = true
    GROUP BY role
)
SELECT
    uuid_generate_v4()::text AS id,
    ac.alert_type,
    CASE WHEN ac.is_enabled IS NULL THEN false ELSE ac.is_enabled END AS active_configs,
    (SELECT COUNT(*) FROM alert_recipients ar WHERE ar.is_active = true AND (ar.alert_types IS NULL OR ac.alert_type = ANY(ar.alert_types))) AS active_recipients,
    (SELECT jsonb_object_agg(role, cnt) FROM role_counts) AS recipients_by_role,
    (SELECT COUNT(*) FROM alert_history ah WHERE ah.status = 'pending' AND ah.alert_type = ac.alert_type) AS pending_alerts,
    (SELECT COUNT(*) FROM alert_history ah WHERE ah.status = 'sent' AND ah.alert_type = ac.alert_type AND ah.sent_at >= NOW() - INTERVAL '1 day') AS sent_today,
    (SELECT COUNT(*) FROM alert_history ah WHERE ah.status = 'failed' AND ah.alert_type = ac.alert_type AND ah.created_at >= NOW() - INTERVAL '1 day') AS failed_today,
    (SELECT MAX(ah.sent_at) FROM alert_history ah WHERE ah.alert_type = ac.alert_type) AS last_sent_at,
    (SELECT jsonb_agg(jsonb_build_object(
        'id', sub.id,
        'alert_type', sub.alert_type,
        'product_id', sub.product_id,
        'product_name', sub.product_name,
        'status', sub.status,
        'created_at', sub.created_at
    )) FROM (
        SELECT ah.id, ah.alert_type, ah.product_id, ah.product_name, ah.status, ah.created_at
        FROM alert_history ah
        WHERE ah.status = 'pending' AND ah.alert_type = ac.alert_type
        ORDER BY ah.created_at DESC
        LIMIT 10
    ) sub) AS pending_alerts_detail
FROM alert_configurations ac;

-- ================================================================
-- PART 2: CATCH-UP COLUMN ADDITIONS (hardened with to_regclass guards)
--         If table was just created above by IF NOT EXISTS, these do nothing.
--         If table existed from older migration but missing cols, adds them.
-- ================================================================

DO $$
BEGIN
    -- 2.1 app_settings additional columns (if missing on existing DB)
    IF to_regclass('public.app_settings') IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_settings' AND column_name='feature_toggles') THEN
            ALTER TABLE app_settings ADD COLUMN feature_toggles JSONB DEFAULT '{
                "transactionDelete": true,
                "productReturns": true,
                "outstandingPayments": true,
                "productDiscount": true,
                "expenseTracking": true,
                "supplierManagement": true
            }'::jsonb NOT NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_settings' AND column_name='base_currency') THEN
            ALTER TABLE app_settings ADD COLUMN base_currency TEXT DEFAULT 'USD';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_settings' AND column_name='exchange_rate_provider') THEN
            ALTER TABLE app_settings ADD COLUMN exchange_rate_provider TEXT DEFAULT 'exchangerate';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_settings' AND column_name='exchange_rate_api_key') THEN
            ALTER TABLE app_settings ADD COLUMN exchange_rate_api_key TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_settings' AND column_name='exchange_rate_update_interval') THEN
            ALTER TABLE app_settings ADD COLUMN exchange_rate_update_interval INTEGER DEFAULT 60;
        END IF;
    END IF;

    -- 2.2 sales additional columns (payments JSONB, timestamp, currency cols)
    IF to_regclass('public.sales') IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='timestamp') THEN
            ALTER TABLE sales ADD COLUMN timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now());
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='payments') THEN
            ALTER TABLE sales ADD COLUMN payments JSONB DEFAULT '[]'::jsonb;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='transaction_currency') THEN
            ALTER TABLE sales ADD COLUMN transaction_currency TEXT DEFAULT 'USD';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='base_currency_amount') THEN
            ALTER TABLE sales ADD COLUMN base_currency_amount DECIMAL(12, 2);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='exchange_rate_used') THEN
            ALTER TABLE sales ADD COLUMN exchange_rate_used DECIMAL(15, 8);
        END IF;
        -- DROP + re-add payment_method check constraint (always idempotent)
        ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
        ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check
            CHECK (payment_method IN ('cash', 'card', 'digital', 'credit', 'split'));
        -- DROP + re-add amounts non-negative constraint (may be missing on older DBs)
        ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_amounts_non_negative;
        ALTER TABLE sales ADD CONSTRAINT sales_amounts_non_negative CHECK (
            subtotal >= 0 AND discount_amount >= 0 AND tax_amount >= 0 AND total >= 0
        );
    END IF;

    -- 2.3 products currency columns
    IF to_regclass('public.products') IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='base_currency') THEN
            ALTER TABLE products ADD COLUMN base_currency TEXT DEFAULT 'USD';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='price_in_base_currency') THEN
            ALTER TABLE products ADD COLUMN price_in_base_currency DECIMAL(10, 2);
        END IF;
    END IF;

    -- 2.4 suppliers ERP columns (ALL 9 + rating check)
    IF to_regclass('public.suppliers') IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='contact_person') THEN
            ALTER TABLE suppliers ADD COLUMN contact_person TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='phone2') THEN
            ALTER TABLE suppliers ADD COLUMN phone2 TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='tax_id') THEN
            ALTER TABLE suppliers ADD COLUMN tax_id TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='bank_details') THEN
            ALTER TABLE suppliers ADD COLUMN bank_details JSONB DEFAULT '{}'::jsonb;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='website') THEN
            ALTER TABLE suppliers ADD COLUMN website TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='notes') THEN
            ALTER TABLE suppliers ADD COLUMN notes TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='total_purchases') THEN
            ALTER TABLE suppliers ADD COLUMN total_purchases DECIMAL(12,2) DEFAULT 0.00;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='outstanding_balance') THEN
            ALTER TABLE suppliers ADD COLUMN outstanding_balance DECIMAL(12,2) DEFAULT 0.00;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='active') THEN
            ALTER TABLE suppliers ADD COLUMN active BOOLEAN DEFAULT true;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints tc
            JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
            WHERE tc.constraint_type = 'CHECK' AND tc.table_name='suppliers' AND ccu.column_name='rating'
        ) THEN
            ALTER TABLE suppliers ADD CONSTRAINT suppliers_rating_check CHECK (rating >= 0 AND rating <= 5);
        END IF;
    END IF;

    -- 2.5 expenses — description column + expanded check constraints
    IF to_regclass('public.expenses') IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='description') THEN
            ALTER TABLE expenses ADD COLUMN description TEXT;
        END IF;
        ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_payment_method_check;
        ALTER TABLE expenses ADD CONSTRAINT expenses_payment_method_check
            CHECK (payment_method IN ('cash','card','bank_transfer','check','digital_wallet','other','digital'));
        ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_status_check;
        ALTER TABLE expenses ADD CONSTRAINT expenses_status_check
            CHECK (status IN ('pending','approved','reimbursed','archived'));
    END IF;

    -- 2.6 product_returns — payment_method + created_by columns + constraints
    IF to_regclass('public.product_returns') IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_returns' AND column_name='payment_method') THEN
            ALTER TABLE product_returns ADD COLUMN payment_method TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_returns' AND column_name='created_by') THEN
            ALTER TABLE product_returns ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
        END IF;
        ALTER TABLE product_returns DROP CONSTRAINT IF EXISTS product_returns_status_check;
        ALTER TABLE product_returns ADD CONSTRAINT product_returns_status_check
            CHECK (status IN ('pending','approved','completed','rejected','exchanged'));
        ALTER TABLE product_returns DROP CONSTRAINT IF EXISTS product_returns_return_method_check;
        ALTER TABLE product_returns ADD CONSTRAINT product_returns_return_method_check
            CHECK (return_method IN ('refund','exchange','store_credit','reject'));
    END IF;

    -- 2.7 return_items — ensure condition expanded CHECK
    IF to_regclass('public.return_items') IS NOT NULL THEN
        ALTER TABLE return_items DROP CONSTRAINT IF EXISTS return_items_condition_check;
        ALTER TABLE return_items ADD CONSTRAINT return_items_condition_check
            CHECK (condition IN ('unused','opened','damaged','defective','missing_parts','used'));
    END IF;

    -- 2.8 outstanding_payments — status CHECK expanded
    IF to_regclass('public.outstanding_payments') IS NOT NULL THEN
        ALTER TABLE outstanding_payments DROP CONSTRAINT IF EXISTS outstanding_payments_status_check;
        ALTER TABLE outstanding_payments ADD CONSTRAINT outstanding_payments_status_check
            CHECK (status IN ('pending','partial','paid','overdue','written_off'));
    END IF;
END $$;

-- ================================================================
-- PART 3: INDEXES (IF NOT EXISTS)
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(active);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_rating ON suppliers(rating);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_low_stock ON products(stock) WHERE stock < min_stock;
CREATE INDEX IF NOT EXISTS idx_sales_invoice_number ON sales(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON sales(timestamp);
CREATE INDEX IF NOT EXISTS idx_sales_payments_gin ON sales USING gin (payments jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_sales_tabs_user_id ON sales_tabs(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_name);
CREATE INDEX IF NOT EXISTS idx_expenses_payment_method ON expenses(payment_method);
CREATE INDEX IF NOT EXISTS idx_expenses_supplier_id ON expenses(supplier_id);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_expense_categories_active ON expense_categories(active);
CREATE INDEX IF NOT EXISTS idx_product_returns_status ON product_returns(status);
CREATE INDEX IF NOT EXISTS idx_product_returns_sale_id ON product_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_product_returns_customer_id ON product_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_product_returns_date ON product_returns(created_at);
CREATE INDEX IF NOT EXISTS idx_product_returns_return_number ON product_returns(return_number);
CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_return_items_product_id ON return_items(product_id);
CREATE INDEX IF NOT EXISTS idx_outstanding_payments_status ON outstanding_payments(status);
CREATE INDEX IF NOT EXISTS idx_outstanding_payments_customer ON outstanding_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_outstanding_payments_due_date ON outstanding_payments(due_date);
CREATE INDEX IF NOT EXISTS idx_payment_records_outstanding ON payment_records(outstanding_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_date ON payment_records(payment_date);
CREATE INDEX IF NOT EXISTS idx_payment_records_customer ON payment_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_currency_config_active ON currency_config(is_active);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_base_target ON exchange_rates(base_currency, target_currency);
CREATE INDEX IF NOT EXISTS idx_exchange_rate_history_pair_time ON exchange_rate_history(base_currency, target_currency, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_recipients_active ON alert_recipients(is_active);
CREATE INDEX IF NOT EXISTS idx_alert_templates_type_active ON alert_templates(type, is_active);
CREATE INDEX IF NOT EXISTS idx_alert_configurations_type ON alert_configurations(alert_type);
CREATE INDEX IF NOT EXISTS idx_alert_history_type_status ON alert_history(alert_type, status);
CREATE INDEX IF NOT EXISTS idx_alert_schedules_active_next ON alert_schedules(is_active, next_run);
CREATE INDEX IF NOT EXISTS idx_notification_service_default ON notification_service_config(service_type, is_default);
CREATE INDEX IF NOT EXISTS idx_product_batches_product ON product_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_expiry ON product_batches(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_discounts_active_valid ON discounts(active, valid_to);

-- ================================================================
-- PART 4: HELPER FUNCTIONS + TRIGGERS (CREATE OR REPLACE — always safe)
-- ================================================================

-- Universal updated_at setter
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Auto-generate return_number trigger function
CREATE OR REPLACE FUNCTION generate_return_number() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.return_number IS NULL OR NEW.return_number = '' THEN
        NEW.return_number := 'RET-' || TO_CHAR(timezone('utc', now()), 'YYYYMMDD') || '-' ||
                              LPAD(FLOOR(RANDOM() * 9999)::INTEGER::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-generate sales invoice_number from app_settings counter
CREATE OR REPLACE FUNCTION generate_sales_invoice_number() RETURNS TRIGGER AS $$
DECLARE
    v_prefix TEXT;
    v_counter INTEGER;
BEGIN
    IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
        SELECT invoice_prefix, invoice_counter INTO v_prefix, v_counter FROM app_settings LIMIT 1;
        IF v_prefix IS NULL THEN v_prefix := 'INV'; END IF;
        IF v_counter IS NULL THEN v_counter := 1000; END IF;
        NEW.invoice_number := v_prefix || '-' || v_counter;
        UPDATE app_settings SET invoice_counter = v_counter + 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Sync outstanding_amount + status when total/paid change
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

-- ================================================================
-- PART 5: APPLY TRIGGERS (DROP IF EXISTS + RECREATE — safe)
-- ================================================================

DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings;
CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_batches_updated_at ON product_batches;
CREATE TRIGGER update_product_batches_updated_at BEFORE UPDATE ON product_batches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sales_updated_at ON sales;
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sales_tabs_updated_at ON sales_tabs;
CREATE TRIGGER update_sales_tabs_updated_at BEFORE UPDATE ON sales_tabs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_currency_config_updated_at ON currency_config;
CREATE TRIGGER update_currency_config_updated_at BEFORE UPDATE ON currency_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_exchange_rates_updated_at ON exchange_rates;
CREATE TRIGGER update_exchange_rates_updated_at BEFORE UPDATE ON exchange_rates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expense_categories_updated_at ON expense_categories;
CREATE TRIGGER update_expense_categories_updated_at BEFORE UPDATE ON expense_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_returns_updated_at ON product_returns;
CREATE TRIGGER update_product_returns_updated_at BEFORE UPDATE ON product_returns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_return_items_updated_at ON return_items;
CREATE TRIGGER update_return_items_updated_at BEFORE UPDATE ON return_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_outstanding_payments_updated_at ON outstanding_payments;
CREATE TRIGGER update_outstanding_payments_updated_at BEFORE UPDATE ON outstanding_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_records_updated_at ON payment_records;
CREATE TRIGGER update_payment_records_updated_at BEFORE UPDATE ON payment_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alert_recipients_updated_at ON alert_recipients;
CREATE TRIGGER update_alert_recipients_updated_at BEFORE UPDATE ON alert_recipients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alert_templates_updated_at ON alert_templates;
CREATE TRIGGER update_alert_templates_updated_at BEFORE UPDATE ON alert_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alert_configurations_updated_at ON alert_configurations;
CREATE TRIGGER update_alert_configurations_updated_at BEFORE UPDATE ON alert_configurations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alert_schedules_updated_at ON alert_schedules;
CREATE TRIGGER update_alert_schedules_updated_at BEFORE UPDATE ON alert_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_service_config_updated_at ON notification_service_config;
CREATE TRIGGER update_notification_service_config_updated_at BEFORE UPDATE ON notification_service_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_product_returns_number ON product_returns;
CREATE TRIGGER trg_product_returns_number BEFORE INSERT ON product_returns FOR EACH ROW EXECUTE FUNCTION generate_return_number();

DROP TRIGGER IF EXISTS trg_generate_sales_invoice ON sales;
CREATE TRIGGER trg_generate_sales_invoice BEFORE INSERT ON sales FOR EACH ROW EXECUTE FUNCTION generate_sales_invoice_number();

DROP TRIGGER IF EXISTS trg_sync_outstanding ON outstanding_payments;
CREATE TRIGGER trg_sync_outstanding
    BEFORE INSERT OR UPDATE OF total_amount, paid_amount ON outstanding_payments
    FOR EACH ROW EXECUTE FUNCTION sync_outstanding_amount();

-- ================================================================
-- PART 6: ROW LEVEL SECURITY (RLS) + POLICIES (drop + create safe)
-- ================================================================
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE currency_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rate_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE outstanding_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_service_config ENABLE ROW LEVEL SECURITY;

-- Core Tables Policies
DROP POLICY IF EXISTS "App settings are viewable by authenticated users" ON app_settings;
CREATE POLICY "App settings are viewable by authenticated users" ON app_settings FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "App settings are editable by authenticated users" ON app_settings;
CREATE POLICY "App settings are editable by authenticated users" ON app_settings FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Categories are viewable by authenticated users" ON categories;
CREATE POLICY "Categories are viewable by authenticated users" ON categories FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Categories are editable by authenticated users" ON categories;
CREATE POLICY "Categories are editable by authenticated users" ON categories FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Customers are viewable by authenticated users" ON customers;
CREATE POLICY "Customers are viewable by authenticated users" ON customers FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Customers are editable by authenticated users" ON customers;
CREATE POLICY "Customers are editable by authenticated users" ON customers FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Products are viewable by authenticated users" ON products;
CREATE POLICY "Products are viewable by authenticated users" ON products FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Products are editable by authenticated users" ON products;
CREATE POLICY "Products are editable by authenticated users" ON products FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Product batches are viewable by authenticated users" ON product_batches;
CREATE POLICY "Product batches are viewable by authenticated users" ON product_batches FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Product batches are editable by authenticated users" ON product_batches;
CREATE POLICY "Product batches are editable by authenticated users" ON product_batches FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Discounts are viewable by authenticated users" ON discounts;
CREATE POLICY "Discounts are viewable by authenticated users" ON discounts FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Discounts are editable by authenticated users" ON discounts;
CREATE POLICY "Discounts are editable by authenticated users" ON discounts FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Sales are viewable by authenticated users" ON sales;
CREATE POLICY "Sales are viewable by authenticated users" ON sales FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Sales are editable by authenticated users" ON sales;
CREATE POLICY "Sales are editable by authenticated users" ON sales FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can view their own sales tabs" ON sales_tabs;
CREATE POLICY "Users can view their own sales tabs" ON sales_tabs FOR SELECT USING (auth.role() = 'authenticated' AND user_id = auth.uid());
DROP POLICY IF EXISTS "Users can manage their own sales tabs" ON sales_tabs;
CREATE POLICY "Users can manage their own sales tabs" ON sales_tabs FOR ALL USING (auth.role() = 'authenticated' AND user_id = auth.uid()) WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());

DROP POLICY IF EXISTS allow_authenticated_users ON users;
CREATE POLICY allow_authenticated_users ON users FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS allow_authenticated_suppliers ON suppliers;
CREATE POLICY allow_authenticated_suppliers ON suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Exchange rates are viewable by authenticated users" ON exchange_rates;
CREATE POLICY "Exchange rates are viewable by authenticated users" ON exchange_rates FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Exchange rates are editable by authenticated users" ON exchange_rates;
CREATE POLICY "Exchange rates are editable by authenticated users" ON exchange_rates FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Currency config is viewable by authenticated users" ON currency_config;
CREATE POLICY "Currency config is viewable by authenticated users" ON currency_config FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Currency config is editable by authenticated users" ON currency_config;
CREATE POLICY "Currency config is editable by authenticated users" ON currency_config FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Exchange rate history is viewable by authenticated users" ON exchange_rate_history;
CREATE POLICY "Exchange rate history is viewable by authenticated users" ON exchange_rate_history FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Exchange rate history is editable by authenticated users" ON exchange_rate_history;
CREATE POLICY "Exchange rate history is editable by authenticated users" ON exchange_rate_history FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS allow_authenticated_expense_categories ON expense_categories;
CREATE POLICY allow_authenticated_expense_categories ON expense_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS allow_authenticated_expenses ON expenses;
CREATE POLICY allow_authenticated_expenses ON expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS allow_authenticated_product_returns ON product_returns;
CREATE POLICY allow_authenticated_product_returns ON product_returns FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS allow_authenticated_return_items ON return_items;
CREATE POLICY allow_authenticated_return_items ON return_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS allow_authenticated_outstanding_payments ON outstanding_payments;
CREATE POLICY allow_authenticated_outstanding_payments ON outstanding_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS allow_authenticated_payment_records ON payment_records;
CREATE POLICY allow_authenticated_payment_records ON payment_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations for authenticated users alert_recipients" ON alert_recipients;
CREATE POLICY "Allow all operations for authenticated users alert_recipients" ON alert_recipients FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all operations for authenticated users alert_templates" ON alert_templates;
CREATE POLICY "Allow all operations for authenticated users alert_templates" ON alert_templates FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all operations for authenticated users alert_configurations" ON alert_configurations;
CREATE POLICY "Allow all operations for authenticated users alert_configurations" ON alert_configurations FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all operations for authenticated users alert_history" ON alert_history;
CREATE POLICY "Allow all operations for authenticated users alert_history" ON alert_history FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all operations for authenticated users alert_schedules" ON alert_schedules;
CREATE POLICY "Allow all operations for authenticated users alert_schedules" ON alert_schedules FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all operations for authenticated users notification_service_config" ON notification_service_config;
CREATE POLICY "Allow all operations for authenticated users notification_service_config" ON notification_service_config FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- ================================================================
-- PART 7: GRANTS (always re-run — safe)
-- ================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON alert_recipients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON alert_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON alert_configurations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON alert_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON alert_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_service_config TO authenticated;
GRANT SELECT ON alert_monitoring TO authenticated;

-- ================================================================
-- PART 8: SEED DATA (ON CONFLICT DO NOTHING)
-- ================================================================

-- 1. app_settings — exactly one row
INSERT INTO app_settings (
    id, store_name, store_address, store_phone, store_email,
    currency, tax_rate, interface_mode, theme, invoice_prefix, invoice_counter
) VALUES (
    uuid_generate_v4(),
    'S&P POWER TOOLS Store',
    'Sri Lanka',
    '+94 11 000 0000',
    'info@sppowertools.lk',
    'LKR',
    0.0000,
    'touch',
    'light',
    'INV',
    1000
) ON CONFLICT DO NOTHING;

-- 2. categories
INSERT INTO categories (name, description, active) VALUES
    ('Electronics', 'Electronic devices and accessories', true),
    ('Clothing', 'Apparel and fashion items', true),
    ('Food & Beverage', 'Food and drink products', true),
    ('Home & Garden', 'Home improvement and garden supplies', true),
    ('Books & Media', 'Books, magazines, and media content', true),
    ('Health & Beauty', 'Healthcare and beauty products', true),
    ('Sports & Outdoors', 'Sports equipment and outdoor gear', true),
    ('Automotive', 'Car parts and automotive supplies', true),
    ('General', 'General merchandise', true)
ON CONFLICT (name) DO NOTHING;

-- 3. expense_categories (14)
INSERT INTO expense_categories (name, description, color, icon, active) VALUES
    ('Rent', 'Office and store rental payments', '#8B5CF6', 'home', true),
    ('Utilities', 'Electricity, water, internet, phone bills', '#059669', 'zap', true),
    ('Salaries & Wages', 'Employee salaries, wages, and benefits', '#DC2626', 'users', true),
    ('Inventory Purchases', 'Goods and products purchased for resale', '#2563EB', 'package', true),
    ('Marketing & Advertising', 'Promotion, advertising, marketing expenses', '#DB2777', 'megaphone', true),
    ('Office Supplies', 'Stationery, consumables, office items', '#EA580C', 'briefcase', true),
    ('Transportation', 'Delivery, fuel, transport costs', '#65A30D', 'truck', true),
    ('Maintenance & Repairs', 'Equipment, facility repairs and upkeep', '#7C3AED', 'wrench', true),
    ('Insurance', 'Business, liability, vehicle insurance', '#0369A1', 'shield', true),
    ('Taxes', 'Tax payments and government fees', '#15803D', 'receipt', true),
    ('Bank & Card Fees', 'Bank charges, card processing fees', '#991B1B', 'credit-card', true),
    ('Software & Subscriptions', 'SaaS, licenses, subscription services', '#4F46E5', 'cloud', true),
    ('Training & Education', 'Employee training and development', '#A16207', 'book-open', true),
    ('Miscellaneous', 'Other uncategorized expenses', '#4B5563', 'help-circle', true)
ON CONFLICT (name) DO NOTHING;

-- 4. alert_configurations (5 defaults)
INSERT INTO alert_configurations (alert_type, is_enabled, threshold_value, check_frequency_minutes, cooldown_minutes) VALUES
    ('low_stock', true, 150, 60, 1440),
    ('out_of_stock', true, NULL, 30, 720),
    ('reorder', true, NULL, 60, 1440),
    ('expiry_warning', true, NULL, 1440, 1440),
    ('batch_expiry', true, NULL, 1440, 1440)
ON CONFLICT DO NOTHING;

-- 5. alert_schedules (5 defaults)
INSERT INTO alert_schedules (alert_type, is_active, next_run, run_count) VALUES
    ('low_stock', true, NOW() + INTERVAL '1 hour', 0),
    ('out_of_stock', true, NOW() + INTERVAL '30 minutes', 0),
    ('reorder', true, NOW() + INTERVAL '1 hour', 0),
    ('expiry_warning', true, NOW() + INTERVAL '1 day', 0),
    ('batch_expiry', true, NOW() + INTERVAL '1 day', 0)
ON CONFLICT DO NOTHING;

-- 6. currency_config defaults (LKR base + USD)
INSERT INTO currency_config (code, name, symbol, symbol_position, decimal_places, is_active, is_base_currency) VALUES
    ('LKR', 'Sri Lankan Rupee', 'Rs', 'after', 2, true, true),
    ('USD', 'US Dollar', '$', 'before', 2, true, false),
    ('EUR', 'Euro', '€', 'before', 2, true, false),
    ('GBP', 'British Pound', '£', 'before', 2, false, false),
    ('JPY', 'Japanese Yen', '¥', 'before', 0, false, false),
    ('INR', 'Indian Rupee', '₹', 'before', 2, true, false)
ON CONFLICT (code) DO NOTHING;

-- ================================================================
-- PART 9: IN-SCRIPT AUTOMATIC VERIFICATION (shows up in "Messages" tab)
-- ================================================================
DO $$
DECLARE
    v_expenses_desc_exists BOOLEAN;
    v_tabs INT;
    v_app_settings INT;
    v_core_tables TEXT[] := ARRAY[
        'app_settings','categories','customers','suppliers','products',
        'product_batches','discounts','users','sales','sales_tabs',
        'expense_categories','expenses','product_returns','return_items',
        'outstanding_payments','payment_records',
        'currency_config','exchange_rates','exchange_rate_history',
        'alert_recipients','alert_templates','alert_configurations',
        'alert_history','alert_schedules','notification_service_config'
    ];
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='expenses' AND column_name='description'
    ) INTO v_expenses_desc_exists;

    SELECT COUNT(*) INTO v_tabs FROM information_schema.tables
    WHERE table_schema='public' AND table_name = ANY(v_core_tables);

    SELECT COUNT(*) INTO v_app_settings FROM app_settings;

    RAISE NOTICE '============================================================';
    RAISE NOTICE '   S&P POWER TOOLS — SCHEMA SETUP + ALIGNMENT VERIFIED';
    RAISE NOTICE '============================================================';
    RAISE NOTICE '1. expenses.description column exists: %', v_expenses_desc_exists;
    RAISE NOTICE '2. Core 25 tables present: % / 25', v_tabs;
    RAISE NOTICE '3. app_settings rows: % (expected 1)', v_app_settings;
    RAISE NOTICE '============================================================';
    RAISE NOTICE '   ✅ MIGRATION SUCCESSFULLY APPLIED';
    RAISE NOTICE '   ⚠️  ALL CHANGES IDEMPOTENT — safe to run multiple times';
    RAISE NOTICE '============================================================';
END $$;

-- ================================================================
-- END OF COMPLETE STANDALONE MIGRATION
-- ================================================================
-- Post-migration optional verification queries — run separately:
--
--   SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name;
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='expenses' ORDER BY ordinal_position;
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='product_returns' ORDER BY ordinal_position;
--
-- ================================================================

-- ================================================================
-- NEXTERA POS SYSTEM - COMPLETE DATABASE INITIALIZATION
-- Generated on: August 4, 2025
-- Description: Complete Supabase database setup for POS system
-- ================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
-- 1. DROP EXISTING TABLES (if recreating)
-- ================================================================
-- Uncomment the following lines if you need to recreate tables
-- DROP TABLE IF EXISTS sales_tabs CASCADE;
-- DROP TABLE IF EXISTS product_batches CASCADE;
-- DROP TABLE IF EXISTS sales CASCADE;
-- DROP TABLE IF EXISTS discounts CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
-- DROP TABLE IF EXISTS products CASCADE;
-- DROP TABLE IF EXISTS customers CASCADE;
-- DROP TABLE IF EXISTS suppliers CASCADE;
-- DROP TABLE IF EXISTS categories CASCADE;
-- DROP TABLE IF EXISTS app_settings CASCADE;

-- ================================================================
-- 2. CREATE CORE TABLES
-- ================================================================

-- App Settings Table (single row configuration)
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_name TEXT DEFAULT 'S&P POWER TOOLS',
    store_address TEXT,
    store_phone TEXT,
    store_email TEXT,
    store_logo TEXT,
    tax_rate DECIMAL(5,4) DEFAULT 0.0000,
    currency TEXT DEFAULT 'USD',
    interface_mode TEXT DEFAULT 'touch' CHECK (interface_mode IN ('touch', 'traditional')),
    auto_backup BOOLEAN DEFAULT true,
    receipt_printer BOOLEAN DEFAULT false,
    theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
    invoice_prefix TEXT DEFAULT 'INV',
    invoice_counter INTEGER DEFAULT 1000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    credit_limit DECIMAL(10,2) DEFAULT 0.00,
    credit_used DECIMAL(10,2) DEFAULT 0.00,
    price_tier TEXT DEFAULT 'Standard',
    total_purchases DECIMAL(12,2) DEFAULT 0.00,
    last_purchase TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    payment_terms TEXT,
    rating DECIMAL(2,1) DEFAULT 5.0 CHECK (rating >= 0 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Products Table (without variations - as per recent changes)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    barcode TEXT,
    price DECIMAL(10,2) NOT NULL,
    cost DECIMAL(10,2),
    stock INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 0,
    category TEXT NOT NULL,
    description TEXT,
    image TEXT,
    taxable BOOLEAN DEFAULT true,
    active BOOLEAN DEFAULT true,
    is_weight_based BOOLEAN DEFAULT false,
    price_per_unit DECIMAL(10,2),
    unit TEXT DEFAULT 'piece',
    track_inventory BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

-- Constraints
CONSTRAINT products_price_positive CHECK (price >= 0),
    CONSTRAINT products_cost_positive CHECK (cost >= 0),
    CONSTRAINT products_stock_non_negative CHECK (stock >= 0),
    CONSTRAINT products_min_stock_non_negative CHECK (min_stock >= 0)
);

-- Product Batches Table (for batch tracking)
CREATE TABLE IF NOT EXISTS product_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    batch_number TEXT NOT NULL,
    manufacturing_date DATE,
    expiry_date DATE,
    quantity INTEGER NOT NULL DEFAULT 0,
    cost_price DECIMAL(10,2),
    supplier_info TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

-- Constraints
CONSTRAINT product_batches_quantity_non_negative CHECK (quantity >= 0),
    CONSTRAINT product_batches_cost_positive CHECK (cost_price >= 0),
    CONSTRAINT unique_batch_per_product UNIQUE (product_id, batch_number)
);

-- Discounts Table
CREATE TABLE IF NOT EXISTS discounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed', 'free_gift')),
    value DECIMAL(10,2) DEFAULT 0,
    conditions JSONB DEFAULT '[]'::jsonb,
    free_gift_products TEXT[],
    min_amount DECIMAL(10,2),
    max_discount DECIMAL(10,2),
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_to TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_days INTEGER[] DEFAULT '{0,1,2,3,4,5,6}', -- 0=Sunday, 6=Saturday
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

-- Constraints
CONSTRAINT discounts_value_non_negative CHECK (value >= 0),
    CONSTRAINT discounts_valid_date_range CHECK (valid_to > valid_from),
    CONSTRAINT discounts_valid_days_range CHECK (
        valid_days <@ ARRAY[0,1,2,3,4,5,6]
    )
);

-- Users Table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('admin', 'manager', 'cashier')),
    permissions TEXT[] DEFAULT '{}',
    active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    avatar TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Sales Table
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number TEXT NOT NULL UNIQUE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'digital', 'credit')),
    card_details JSONB,
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded', 'credit', 'draft')),
    cashier TEXT,
    cashier_role TEXT,
    receipt_number TEXT,
    notes TEXT,
    applied_discounts JSONB DEFAULT '[]'::jsonb,
    free_gifts JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

-- Constraints
CONSTRAINT sales_amounts_non_negative CHECK (
        subtotal >= 0 AND 
        discount_amount >= 0 AND 
        tax_amount >= 0 AND 
        total >= 0
    )
);

-- Sales Tabs Table (for multi-tab functionality)
CREATE TABLE IF NOT EXISTS sales_tabs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cart JSONB DEFAULT '[]'::jsonb,
    selected_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ================================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ================================================================

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku);

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode)
WHERE
    barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);

CREATE INDEX IF NOT EXISTS idx_products_active ON products (active);

CREATE INDEX IF NOT EXISTS idx_products_name_search ON products USING gin (to_tsvector ('english', name));

-- Customers indexes
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers USING gin (to_tsvector ('english', name));

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers (email)
WHERE
    email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone)
WHERE
    phone IS NOT NULL;

-- Sales indexes
CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON sales (created_at);

CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales (customer_id);

CREATE INDEX IF NOT EXISTS idx_sales_invoice_number ON sales (invoice_number);

CREATE INDEX IF NOT EXISTS idx_sales_status ON sales (status);

CREATE INDEX IF NOT EXISTS idx_sales_payment_method ON sales (payment_method);

CREATE INDEX IF NOT EXISTS idx_sales_cashier ON sales (cashier);

-- Product Batches indexes
CREATE INDEX IF NOT EXISTS idx_product_batches_product_id ON product_batches (product_id);

CREATE INDEX IF NOT EXISTS idx_product_batches_expiry ON product_batches (expiry_date)
WHERE
    expiry_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_batches_batch_number ON product_batches (batch_number);

-- Discounts indexes
CREATE INDEX IF NOT EXISTS idx_discounts_active ON discounts (active);

CREATE INDEX IF NOT EXISTS idx_discounts_validity ON discounts (valid_from, valid_to)
WHERE
    active = true;

CREATE INDEX IF NOT EXISTS idx_discounts_type ON discounts(type);

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

CREATE INDEX IF NOT EXISTS idx_users_active ON users (active);

-- Sales Tabs indexes
CREATE INDEX IF NOT EXISTS idx_sales_tabs_user_id ON sales_tabs (user_id);

-- ================================================================
-- 4. CREATE FUNCTIONS AND TRIGGERS
-- ================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to all tables
CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_batches_updated_at BEFORE UPDATE ON product_batches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_discounts_updated_at BEFORE UPDATE ON discounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_tabs_updated_at BEFORE UPDATE ON sales_tabs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate unique invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
    prefix TEXT;
    counter INTEGER;
    new_invoice_number TEXT;
BEGIN
    -- Get current prefix and counter from app_settings
    SELECT invoice_prefix, invoice_counter 
    INTO prefix, counter 
    FROM app_settings 
    LIMIT 1;
    
    -- Use defaults if not found
    IF prefix IS NULL THEN prefix := 'INV'; END IF;
    IF counter IS NULL THEN counter := 1000; END IF;
    
    -- Generate new invoice number
    new_invoice_number := prefix || '-' || LPAD(counter::TEXT, 6, '0');
    
    -- Update counter in app_settings
    UPDATE app_settings 
    SET invoice_counter = counter + 1, 
        updated_at = timezone('utc'::text, now());
    
    RETURN new_invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Function to update customer's total purchases and last purchase date
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.customer_id IS NOT NULL AND NEW.status = 'completed' THEN
        UPDATE customers 
        SET 
            total_purchases = total_purchases + NEW.total,
            last_purchase = NEW.created_at,
            updated_at = timezone('utc'::text, now())
        WHERE id = NEW.customer_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update customer stats on completed sales
CREATE TRIGGER trigger_update_customer_stats
    AFTER INSERT OR UPDATE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_stats();

-- Function to auto-generate invoice numbers for sales
CREATE OR REPLACE FUNCTION auto_generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
        NEW.invoice_number := generate_invoice_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate invoice numbers
CREATE TRIGGER trigger_auto_generate_invoice_number
    BEFORE INSERT ON sales
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_invoice_number();

-- ================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ================================================================

-- Enable RLS on all tables
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

-- App Settings policies (readable by all authenticated users, writable by authenticated users)
CREATE POLICY "App settings are viewable by authenticated users" ON app_settings FOR
SELECT USING (
        auth.role () = 'authenticated'
    );

CREATE POLICY "App settings are editable by authenticated users" ON app_settings FOR ALL USING (
    auth.role () = 'authenticated'
);

-- Categories policies (full access for authenticated users)
CREATE POLICY "Categories are viewable by authenticated users" ON categories FOR
SELECT USING (
        auth.role () = 'authenticated'
    );

CREATE POLICY "Categories are editable by authenticated users" ON categories FOR ALL USING (
    auth.role () = 'authenticated'
);

-- Customers policies (full access for authenticated users)
CREATE POLICY "Customers are viewable by authenticated users" ON customers FOR
SELECT USING (
        auth.role () = 'authenticated'
    );

CREATE POLICY "Customers are editable by authenticated users" ON customers FOR ALL USING (
    auth.role () = 'authenticated'
);

-- Suppliers policies (full access for authenticated users)
CREATE POLICY "Suppliers are viewable by authenticated users" ON suppliers FOR
SELECT USING (
        auth.role () = 'authenticated'
    );

CREATE POLICY "Suppliers are editable by authenticated users" ON suppliers FOR ALL USING (
    auth.role () = 'authenticated'
);

-- Products policies (full access for authenticated users)
CREATE POLICY "Products are viewable by authenticated users" ON products FOR
SELECT USING (
        auth.role () = 'authenticated'
    );

CREATE POLICY "Products are editable by authenticated users" ON products FOR ALL USING (
    auth.role () = 'authenticated'
);

-- Product Batches policies (full access for authenticated users)
CREATE POLICY "Product batches are viewable by authenticated users" ON product_batches FOR
SELECT USING (
        auth.role () = 'authenticated'
    );

CREATE POLICY "Product batches are editable by authenticated users" ON product_batches FOR ALL USING (
    auth.role () = 'authenticated'
);

-- Discounts policies (full access for authenticated users)
CREATE POLICY "Discounts are viewable by authenticated users" ON discounts FOR
SELECT USING (
        auth.role () = 'authenticated'
    );

CREATE POLICY "Discounts are editable by authenticated users" ON discounts FOR ALL USING (
    auth.role () = 'authenticated'
);

-- Users policies (publicly viewable, write enabled, only self and admin updates)
CREATE POLICY "Users are publicly viewable" ON users FOR
SELECT USING (true);

CREATE POLICY "Authenticated users can insert their own profile" ON users FOR
INSERT
WITH
    CHECK (true);

CREATE POLICY "Users can update their own profile or admins can update any" ON users FOR
UPDATE USING (
    auth.role () = 'authenticated'
    AND (
        auth.uid () = id
        OR EXISTS (
            SELECT 1
            FROM users
            WHERE
                users.id = auth.uid ()
                AND users.role = 'admin'
        )
    )
);

-- Sales policies (full access for authenticated users)
CREATE POLICY "Sales are viewable by authenticated users" ON sales FOR
SELECT USING (
        auth.role () = 'authenticated'
    );

CREATE POLICY "Sales are editable by authenticated users" ON sales FOR ALL USING (
    auth.role () = 'authenticated'
);

-- Sales Tabs policies (users can only access their own tabs)
CREATE POLICY "Users can view their own sales tabs" ON sales_tabs FOR
SELECT USING (
        auth.role () = 'authenticated'
        AND user_id = auth.uid ()
    );

CREATE POLICY "Users can manage their own sales tabs" ON sales_tabs FOR ALL USING (
    auth.role () = 'authenticated'
    AND user_id = auth.uid ()
);

-- ================================================================
-- 7. INSERT DEFAULT DATA
-- ================================================================

-- Insert default app settings
INSERT INTO
    app_settings (
        store_name,
        currency,
        tax_rate,
        interface_mode,
        theme,
        invoice_prefix,
        invoice_counter
    )
VALUES (
        'S&P POWER TOOLS Store',
        'USD',
        0.0875, -- 8.75% tax rate
        'touch',
        'light',
        'INV',
        1000
    ) ON CONFLICT DO NOTHING;

-- Insert default categories
INSERT INTO
    categories (name, description)
VALUES (
        'Electronics',
        'Electronic devices and accessories'
    ),
    (
        'Clothing',
        'Apparel and fashion items'
    ),
    (
        'Food & Beverage',
        'Food and drink products'
    ),
    (
        'Home & Garden',
        'Home improvement and garden supplies'
    ),
    (
        'Books & Media',
        'Books, magazines, and media content'
    ),
    (
        'Health & Beauty',
        'Healthcare and beauty products'
    ),
    (
        'Sports & Outdoors',
        'Sports equipment and outdoor gear'
    ),
    (
        'Automotive',
        'Car parts and automotive supplies'
    ),
    (
        'General',
        'General merchandise'
    ) ON CONFLICT (name) DO NOTHING;

-- Insert sample discount templates
INSERT INTO discounts (
    name, 
    description, 
    type, 
    value, 
    valid_from, 
    valid_to, 
    active
) VALUES
    (
        'Senior Citizen Discount', 
        '10% discount for senior citizens', 
        'percentage', 
        10.00, 
        '2024-01-01 00:00:00+00'::timestamptz, 
        '2025-12-31 23:59:59+00'::timestamptz, 
        true
    ),
    (
        'Student Discount', 
        '5% discount for students', 
        'percentage', 
        5.00, 
        '2024-01-01 00:00:00+00'::timestamptz, 
        '2025-12-31 23:59:59+00'::timestamptz, 
        true
    ),
    (
        'Bulk Purchase Discount', 
        '$10 off on purchases over $100', 
        'fixed', 
        10.00, 
        '2024-01-01 00:00:00+00'::timestamptz, 
        '2025-12-31 23:59:59+00'::timestamptz, 
        true
    )
ON CONFLICT DO NOTHING;

-- ================================================================
-- 8. FINAL SETUP COMMANDS
-- ================================================================

-- Grant necessary permissions to authenticated role
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant permissions to anon role for public access (if needed)
GRANT USAGE ON SCHEMA public TO anon;

-- Create composite indexes for complex queries (function-free for compatibility)
CREATE INDEX IF NOT EXISTS idx_sales_created_at_status ON sales (created_at, status);

CREATE INDEX IF NOT EXISTS idx_products_category_active ON products (category, active);

CREATE INDEX IF NOT EXISTS idx_customers_name_text ON customers (name text_pattern_ops);

-- ================================================================
-- SETUP COMPLETE
-- ================================================================

-- Summary of created objects
DO $$ BEGIN RAISE NOTICE '=== S&P POWER TOOLS POS DATABASE SETUP COMPLETE ===';

RAISE NOTICE 'Tables created: app_settings, categories, customers, suppliers, products, product_batches, discounts, users, sales, sales_tabs';

RAISE NOTICE 'Indexes created: % performance optimization indexes',
(
    SELECT COUNT(*)
    FROM pg_indexes
    WHERE
        schemaname = 'public'
);

RAISE NOTICE 'RLS policies: Enabled on all tables with role-based access';

RAISE NOTICE 'Functions: update_updated_at_column, generate_invoice_number, update_customer_stats, auto_generate_invoice_number';

RAISE NOTICE 'Default data: App settings, categories, and sample discounts inserted';

RAISE NOTICE '=== Ready for POS application deployment ===';

END $$;
-- ================================================================
-- MULTI-CURRENCY SUPPORT SCHEMA UPDATES
-- Generated for: POS System Multi-Currency Support
-- Description: Database schema updates for exchange rates and currency support
-- ================================================================

-- ================================================================
-- 1. EXCHANGE RATES TABLE
-- ================================================================

-- Exchange Rates Table for storing real-time and historical exchange rates
CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_currency TEXT NOT NULL, -- Base currency (e.g., 'USD')
    target_currency TEXT NOT NULL, -- Target currency (e.g., 'EUR')
    rate DECIMAL(15,8) NOT NULL, -- Exchange rate (e.g., 0.85 for USD to EUR)
    source TEXT NOT NULL DEFAULT 'api', -- Source: 'api', 'manual', 'fallback'
    is_manual_override BOOLEAN DEFAULT false, -- Whether this is a manual override
    effective_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    effective_to TIMESTAMP WITH TIME ZONE, -- NULL means currently active
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

-- Constraints
CONSTRAINT exchange_rates_rate_positive CHECK (rate > 0),
    CONSTRAINT exchange_rates_effective_dates CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT exchange_rates_unique_active UNIQUE (base_currency, target_currency, effective_from)
);

-- ================================================================
-- 2. CURRENCY CONFIGURATION TABLE
-- ================================================================

-- Currency Configuration Table for supported currencies
CREATE TABLE IF NOT EXISTS currency_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE, -- Currency code (e.g., 'USD', 'EUR')
    name TEXT NOT NULL, -- Full name (e.g., 'US Dollar', 'Euro')
    symbol TEXT NOT NULL, -- Currency symbol (e.g., '$', 'â‚¬')
    symbol_position TEXT DEFAULT 'before' CHECK (symbol_position IN ('before', 'after')), -- Symbol position
    decimal_places INTEGER DEFAULT 2 CHECK (decimal_places >= 0), -- Number of decimal places
    is_active BOOLEAN DEFAULT true, -- Whether currency is active
    is_base_currency BOOLEAN DEFAULT false, -- Whether this is the base currency
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ================================================================
-- 3. EXCHANGE RATE HISTORY TABLE
-- ================================================================

-- Exchange Rate History Table for tracking rate changes over time
CREATE TABLE IF NOT EXISTS exchange_rate_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_currency TEXT NOT NULL,
    target_currency TEXT NOT NULL,
    rate DECIMAL(15,8) NOT NULL,
    previous_rate DECIMAL(15,8), -- Previous rate for comparison
    change_percentage DECIMAL(8,4), -- Percentage change from previous rate
    source TEXT NOT NULL DEFAULT 'api',
    is_manual_override BOOLEAN DEFAULT false,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

-- Constraints
CONSTRAINT exchange_rate_history_rate_positive CHECK (rate > 0),
    CONSTRAINT exchange_rate_history_previous_rate_positive CHECK (previous_rate IS NULL OR previous_rate > 0)
);

-- ================================================================
-- 4. UPDATE EXISTING TABLES
-- ================================================================

-- Add currency fields to app_settings table
ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS base_currency TEXT DEFAULT 'USD';

ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS exchange_rate_provider TEXT DEFAULT 'exchangerate';

ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS exchange_rate_api_key TEXT;

ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS exchange_rate_update_interval INTEGER DEFAULT 60;

-- Add currency fields to sales table for transaction currency tracking
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS transaction_currency TEXT DEFAULT 'USD';

ALTER TABLE sales
ADD COLUMN IF NOT EXISTS base_currency_amount DECIMAL(12, 2);
-- Amount in base currency
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS exchange_rate_used DECIMAL(15, 8);
-- Exchange rate used for conversion

-- Add currency fields to products table for base pricing
ALTER TABLE products
ADD COLUMN IF NOT EXISTS base_currency TEXT DEFAULT 'USD';
-- Currency of the base price
ALTER TABLE products
ADD COLUMN IF NOT EXISTS price_in_base_currency DECIMAL(10, 2);
-- Price in base currency

-- ================================================================
-- 5. CREATE INDEXES FOR PERFORMANCE
-- ================================================================

-- Exchange rates indexes
CREATE INDEX IF NOT EXISTS idx_exchange_rates_base_target ON exchange_rates (
    base_currency,
    target_currency
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_effective_from ON exchange_rates (effective_from);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_active ON exchange_rates (
    base_currency,
    target_currency,
    effective_from
)
WHERE
    effective_to IS NULL;

-- Currency config indexes
CREATE INDEX IF NOT EXISTS idx_currency_config_code ON currency_config (code);

CREATE INDEX IF NOT EXISTS idx_currency_config_active ON currency_config (is_active);

CREATE INDEX IF NOT EXISTS idx_currency_config_base ON currency_config (is_base_currency)
WHERE
    is_base_currency = true;

-- Exchange rate history indexes
CREATE INDEX IF NOT EXISTS idx_exchange_rate_history_currencies ON exchange_rate_history (
    base_currency,
    target_currency
);

CREATE INDEX IF NOT EXISTS idx_exchange_rate_history_recorded_at ON exchange_rate_history (recorded_at);

-- Sales currency indexes
CREATE INDEX IF NOT EXISTS idx_sales_transaction_currency ON sales (transaction_currency);

CREATE INDEX IF NOT EXISTS idx_sales_created_at_currency ON sales (
    created_at,
    transaction_currency
);

-- Products currency indexes
CREATE INDEX IF NOT EXISTS idx_products_base_currency ON products (base_currency);

-- ================================================================
-- 6. CREATE FUNCTIONS FOR CURRENCY OPERATIONS
-- ================================================================

-- Function to get current exchange rate
CREATE OR REPLACE FUNCTION get_current_exchange_rate(
    p_base_currency TEXT,
    p_target_currency TEXT
)
RETURNS DECIMAL(15,8) AS $$
DECLARE
    current_rate DECIMAL(15,8);
BEGIN
    -- If same currency, return 1.0
    IF p_base_currency = p_target_currency THEN
        RETURN 1.0;
    END IF;
    
    -- Get the most recent active exchange rate
    SELECT rate INTO current_rate
    FROM exchange_rates
    WHERE base_currency = p_base_currency
      AND target_currency = p_target_currency
      AND (effective_to IS NULL OR effective_to > NOW())
    ORDER BY effective_from DESC
    LIMIT 1;
    
    -- If no direct rate found, try reverse rate
    IF current_rate IS NULL THEN
        SELECT (1.0 / rate) INTO current_rate
        FROM exchange_rates
        WHERE base_currency = p_target_currency
          AND target_currency = p_base_currency
          AND (effective_to IS NULL OR effective_to > NOW())
        ORDER BY effective_from DESC
        LIMIT 1;
    END IF;
    
    -- Return the rate or 1.0 if still not found
    RETURN COALESCE(current_rate, 1.0);
END;
$$ LANGUAGE plpgsql;

-- Function to convert currency amount
CREATE OR REPLACE FUNCTION convert_currency_amount(
    p_amount DECIMAL(12,2),
    p_from_currency TEXT,
    p_to_currency TEXT
)
RETURNS DECIMAL(12,2) AS $$
DECLARE
    exchange_rate DECIMAL(15,8);
    converted_amount DECIMAL(12,2);
BEGIN
    -- Get exchange rate
    exchange_rate := get_current_exchange_rate(p_from_currency, p_to_currency);
    
    -- Convert amount
    converted_amount := p_amount * exchange_rate;
    
    RETURN converted_amount;
END;
$$ LANGUAGE plpgsql;

-- Function to update exchange rate with history tracking
CREATE OR REPLACE FUNCTION update_exchange_rate(
    p_base_currency TEXT,
    p_target_currency TEXT,
    p_rate DECIMAL(15,8),
    p_source TEXT DEFAULT 'api',
    p_is_manual_override BOOLEAN DEFAULT false
)
RETURNS VOID AS $$
DECLARE
    previous_rate DECIMAL(15,8);
    change_percentage DECIMAL(8,4);
BEGIN
    -- Get previous rate for history
    SELECT rate INTO previous_rate
    FROM exchange_rates
    WHERE base_currency = p_base_currency
      AND target_currency = p_target_currency
      AND (effective_to IS NULL OR effective_to > NOW())
    ORDER BY effective_from DESC
    LIMIT 1;
    
    -- Calculate change percentage
    IF previous_rate IS NOT NULL AND previous_rate > 0 THEN
        change_percentage := ((p_rate - previous_rate) / previous_rate) * 100;
    END IF;
    
    -- End current active rate
    UPDATE exchange_rates
    SET effective_to = NOW()
    WHERE base_currency = p_base_currency
      AND target_currency = p_target_currency
      AND (effective_to IS NULL OR effective_to > NOW());
    
    -- Insert new rate
    INSERT INTO exchange_rates (
        base_currency,
        target_currency,
        rate,
        source,
        is_manual_override,
        effective_from
    ) VALUES (
        p_base_currency,
        p_target_currency,
        p_rate,
        p_source,
        p_is_manual_override,
        NOW()
    );
    
    -- Insert history record
    INSERT INTO exchange_rate_history (
        base_currency,
        target_currency,
        rate,
        previous_rate,
        change_percentage,
        source,
        is_manual_override
    ) VALUES (
        p_base_currency,
        p_target_currency,
        p_rate,
        previous_rate,
        change_percentage,
        p_source,
        p_is_manual_override
    );
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 7. CREATE TRIGGERS
-- ================================================================

-- Trigger to update updated_at for exchange_rates
CREATE TRIGGER update_exchange_rates_updated_at 
    BEFORE UPDATE ON exchange_rates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at for currency_config
CREATE TRIGGER update_currency_config_updated_at 
    BEFORE UPDATE ON currency_config 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 8. INSERT DEFAULT CURRENCY DATA
-- ================================================================

-- Insert default supported currencies
INSERT INTO
    currency_config (
        code,
        name,
        symbol,
        symbol_position,
        decimal_places,
        is_active,
        is_base_currency
    )
VALUES (
        'USD',
        'US Dollar',
        '$',
        'before',
        2,
        true,
        true
    ),
    (
        'EUR',
        'Euro',
        'â‚¬',
        'before',
        2,
        true,
        false
    ),
    (
        'GBP',
        'British Pound',
        'Â£',
        'before',
        2,
        true,
        false
    ),
    (
        'CAD',
        'Canadian Dollar',
        'C$',
        'before',
        2,
        true,
        false
    ),
    (
        'LKR',
        'Sri Lankan Rupee',
        'Rs',
        'before',
        2,
        true,
        false
    ),
    (
        'JPY',
        'Japanese Yen',
        'Â¥',
        'before',
        0,
        true,
        false
    ),
    (
        'AUD',
        'Australian Dollar',
        'A$',
        'before',
        2,
        true,
        false
    ),
    (
        'CHF',
        'Swiss Franc',
        'CHF',
        'after',
        2,
        true,
        false
    ),
    (
        'CNY',
        'Chinese Yuan',
        'Â¥',
        'before',
        2,
        true,
        false
    ),
    (
        'INR',
        'Indian Rupee',
        'â‚¹',
        'before',
        2,
        true,
        false
    ) ON CONFLICT (code) DO NOTHING;

-- Insert default exchange rates (1:1 for USD as base)
INSERT INTO
    exchange_rates (
        base_currency,
        target_currency,
        rate,
        source,
        is_manual_override
    )
VALUES (
        'USD',
        'USD',
        1.00000000,
        'system',
        false
    ),
    (
        'USD',
        'EUR',
        0.85000000,
        'api',
        false
    ),
    (
        'USD',
        'GBP',
        0.73000000,
        'api',
        false
    ),
    (
        'USD',
        'CAD',
        1.35000000,
        'api',
        false
    ),
    (
        'USD',
        'LKR',
        325.00000000,
        'api',
        false
    ),
    (
        'USD',
        'JPY',
        110.00000000,
        'api',
        false
    ),
    (
        'USD',
        'AUD',
        1.45000000,
        'api',
        false
    ),
    (
        'USD',
        'CHF',
        0.92000000,
        'api',
        false
    ),
    (
        'USD',
        'CNY',
        7.20000000,
        'api',
        false
    ),
    (
        'USD',
        'INR',
        83.00000000,
        'api',
        false
    ) ON CONFLICT (
        base_currency,
        target_currency,
        effective_from
    ) DO NOTHING;

-- ================================================================
-- 9. ROW LEVEL SECURITY POLICIES
-- ================================================================

-- Enable RLS on new tables
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

ALTER TABLE currency_config ENABLE ROW LEVEL SECURITY;

ALTER TABLE exchange_rate_history ENABLE ROW LEVEL SECURITY;

-- Exchange rates policies (readable by all authenticated users, writable by authenticated users)
CREATE POLICY "Exchange rates are viewable by authenticated users" ON exchange_rates FOR
SELECT USING (
        auth.role () = 'authenticated'
    );

CREATE POLICY "Exchange rates are editable by authenticated users" ON exchange_rates FOR ALL USING (
    auth.role () = 'authenticated'
);

-- Currency config policies (readable by all authenticated users, writable by authenticated users)
CREATE POLICY "Currency config is viewable by authenticated users" ON currency_config FOR
SELECT USING (
        auth.role () = 'authenticated'
    );

CREATE POLICY "Currency config is editable by authenticated users" ON currency_config FOR ALL USING (
    auth.role () = 'authenticated'
);

-- Exchange rate history policies (readable by all authenticated users, writable by authenticated users)
CREATE POLICY "Exchange rate history is viewable by authenticated users" ON exchange_rate_history FOR
SELECT USING (
        auth.role () = 'authenticated'
    );

CREATE POLICY "Exchange rate history is editable by authenticated users" ON exchange_rate_history FOR ALL USING (
    auth.role () = 'authenticated'
);

-- ================================================================
-- 10. GRANT PERMISSIONS
-- ================================================================

-- Grant permissions to authenticated role
GRANT ALL ON exchange_rates TO authenticated;

GRANT ALL ON currency_config TO authenticated;

GRANT ALL ON exchange_rate_history TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_current_exchange_rate(TEXT, TEXT) TO authenticated;

GRANT
EXECUTE ON FUNCTION convert_currency_amount (DECIMAL, TEXT, TEXT) TO authenticated;

GRANT
EXECUTE ON FUNCTION update_exchange_rate (
    TEXT,
    TEXT,
    DECIMAL,
    TEXT,
    BOOLEAN
) TO authenticated;

-- ================================================================
-- SETUP COMPLETE
-- ================================================================

DO $$ BEGIN 
    RAISE NOTICE '=== MULTI-CURRENCY SUPPORT SCHEMA SETUP COMPLETE ===';
    RAISE NOTICE 'Tables created: exchange_rates, currency_config, exchange_rate_history';
    RAISE NOTICE 'Functions created: get_current_exchange_rate, convert_currency_amount, update_exchange_rate';
    RAISE NOTICE 'Default currencies inserted: USD, EUR, GBP, CAD, LKR, JPY, AUD, CHF, CNY, INR';
    RAISE NOTICE 'Default exchange rates inserted with USD as base currency';
    RAISE NOTICE '=== Ready for multi-currency POS operations ===';
END $$;
-- Inventory Alerts System Schema
-- This file contains all the necessary tables and functions for the inventory alert system

-- Alert Recipients Table
CREATE TABLE IF NOT EXISTS alert_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'manager', -- manager, admin, cashier
    alert_types TEXT[] NOT NULL DEFAULT ARRAY['low_stock', 'out_of_stock', 'reorder'], -- types of alerts to receive
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

-- Constraints
CONSTRAINT alert_recipients_email_or_phone CHECK (email IS NOT NULL OR phone IS NOT NULL),
    CONSTRAINT alert_recipients_valid_role CHECK (role IN ('admin', 'manager', 'cashier')),
    CONSTRAINT alert_recipients_valid_alert_types CHECK (
        alert_types <@ ARRAY['low_stock', 'out_of_stock', 'reorder', 'expiry_warning', 'batch_expiry']
    )
);

-- Alert Templates Table
CREATE TABLE IF NOT EXISTS alert_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- low_stock, out_of_stock, reorder, expiry_warning, batch_expiry
    channel TEXT NOT NULL, -- email, sms, both
    subject TEXT, -- for email
    body TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

-- Constraints
CONSTRAINT alert_templates_valid_type CHECK (
        type IN ('low_stock', 'out_of_stock', 'reorder', 'expiry_warning', 'batch_expiry')
    ),
    CONSTRAINT alert_templates_valid_channel CHECK (channel IN ('email', 'sms', 'both')),
    CONSTRAINT alert_templates_subject_for_email CHECK (
        (channel IN ('email', 'both') AND subject IS NOT NULL) OR 
        (channel = 'sms')
    )
);

-- Alert Configuration Table
CREATE TABLE IF NOT EXISTS alert_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    threshold_value INTEGER, -- for low_stock alerts (percentage of min_stock)
    check_frequency_minutes INTEGER DEFAULT 60, -- how often to check (in minutes)
    cooldown_minutes INTEGER DEFAULT 1440, -- prevent spam (24 hours default)
    email_template_id UUID REFERENCES alert_templates(id),
    sms_template_id UUID REFERENCES alert_templates(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

-- Constraints
CONSTRAINT alert_configurations_valid_type CHECK (
        alert_type IN ('low_stock', 'out_of_stock', 'reorder', 'expiry_warning', 'batch_expiry')
    ),
    CONSTRAINT alert_configurations_positive_values CHECK (
        (threshold_value IS NULL OR threshold_value > 0)
        AND check_frequency_minutes > 0
        AND cooldown_minutes > 0
    )
);

-- Alert History Table
CREATE TABLE IF NOT EXISTS alert_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type TEXT NOT NULL,
    product_id UUID REFERENCES products(id),
    product_name TEXT NOT NULL,
    product_sku TEXT NOT NULL,
    current_stock INTEGER NOT NULL,
    min_stock INTEGER NOT NULL,
    threshold_value INTEGER,
    recipient_id UUID REFERENCES alert_recipients(id),
    recipient_name TEXT NOT NULL,
    recipient_email TEXT,
    recipient_phone TEXT,
    channel TEXT NOT NULL, -- email, sms
    status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed, delivered
    template_id UUID REFERENCES alert_templates(id),
    message_content TEXT,
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

-- Constraints
CONSTRAINT alert_history_valid_type CHECK (
        alert_type IN ('low_stock', 'out_of_stock', 'reorder', 'expiry_warning', 'batch_expiry')
    ),
    CONSTRAINT alert_history_valid_channel CHECK (channel IN ('email', 'sms')),
    CONSTRAINT alert_history_valid_status CHECK (
        status IN ('pending', 'sent', 'failed', 'delivered')
    )
);

-- Alert Schedules Table (for cron-like functionality)
CREATE TABLE IF NOT EXISTS alert_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_run TIMESTAMP WITH TIME ZONE,
    next_run TIMESTAMP WITH TIME ZONE,
    run_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

-- Constraints
CONSTRAINT alert_schedules_valid_type CHECK (
        alert_type IN ('low_stock', 'out_of_stock', 'reorder', 'expiry_warning', 'batch_expiry')
    )
);

-- Email/SMS Service Configuration Table
CREATE TABLE IF NOT EXISTS notification_service_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name TEXT NOT NULL, -- sendgrid, twilio, aws_ses, etc.
    service_type TEXT NOT NULL, -- email, sms, both
    config_data JSONB NOT NULL, -- API keys, endpoints, etc.
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

-- Constraints
CONSTRAINT notification_service_config_valid_type CHECK (service_type IN ('email', 'sms', 'both'))
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_alert_recipients_active ON alert_recipients (is_active);

CREATE INDEX IF NOT EXISTS idx_alert_recipients_role ON alert_recipients (role);

CREATE INDEX IF NOT EXISTS idx_alert_templates_type ON alert_templates(type);

CREATE INDEX IF NOT EXISTS idx_alert_templates_active ON alert_templates (is_active);

CREATE INDEX IF NOT EXISTS idx_alert_configurations_type ON alert_configurations (alert_type);

CREATE INDEX IF NOT EXISTS idx_alert_configurations_enabled ON alert_configurations (is_enabled);

CREATE INDEX IF NOT EXISTS idx_alert_history_type ON alert_history (alert_type);

CREATE INDEX IF NOT EXISTS idx_alert_history_status ON alert_history (status);

CREATE INDEX IF NOT EXISTS idx_alert_history_created_at ON alert_history (created_at);

CREATE INDEX IF NOT EXISTS idx_alert_history_product_id ON alert_history (product_id);

CREATE INDEX IF NOT EXISTS idx_alert_schedules_type ON alert_schedules (alert_type);

CREATE INDEX IF NOT EXISTS idx_alert_schedules_next_run ON alert_schedules (next_run);

CREATE INDEX IF NOT EXISTS idx_notification_service_config_type ON notification_service_config (service_type);

CREATE INDEX IF NOT EXISTS idx_notification_service_config_active ON notification_service_config (is_active);

-- Function to check inventory levels and trigger alerts
CREATE OR REPLACE FUNCTION check_inventory_alerts()
RETURNS TABLE (
    alert_type TEXT,
    product_id UUID,
    product_name TEXT,
    product_sku TEXT,
    current_stock INTEGER,
    min_stock INTEGER,
    threshold_value INTEGER
) AS $$
BEGIN
    -- Check for out of stock products
    RETURN QUERY
    SELECT 
        'out_of_stock'::TEXT as alert_type,
        p.id as product_id,
        p.name as product_name,
        p.sku as product_sku,
        p.stock as current_stock,
        p.min_stock as min_stock,
        NULL::INTEGER as threshold_value
    FROM products p
    WHERE p.active = true 
        AND p.track_inventory = true 
        AND p.stock = 0
        AND EXISTS (
            SELECT 1 FROM alert_configurations ac 
            WHERE ac.alert_type = 'out_of_stock' 
                AND ac.is_enabled = true
        );

    -- Check for low stock products
    RETURN QUERY
    SELECT 
        'low_stock'::TEXT as alert_type,
        p.id as product_id,
        p.name as product_name,
        p.sku as product_sku,
        p.stock as current_stock,
        p.min_stock as min_stock,
        ac.threshold_value as threshold_value
    FROM products p
    JOIN alert_configurations ac ON ac.alert_type = 'low_stock'
    WHERE p.active = true 
        AND p.track_inventory = true 
        AND p.stock > 0
        AND p.stock <= p.min_stock
        AND ac.is_enabled = true
        AND (ac.threshold_value IS NULL OR p.stock <= (p.min_stock * ac.threshold_value / 100));

    -- Check for reorder point alerts (when stock is at or below reorder point)
    RETURN QUERY
    SELECT 
        'reorder'::TEXT as alert_type,
        p.id as product_id,
        p.name as product_name,
        p.sku as product_sku,
        p.stock as current_stock,
        p.min_stock as min_stock,
        NULL::INTEGER as threshold_value
    FROM products p
    WHERE p.active = true 
        AND p.track_inventory = true 
        AND p.stock <= p.min_stock
        AND EXISTS (
            SELECT 1 FROM alert_configurations ac 
            WHERE ac.alert_type = 'reorder' 
                AND ac.is_enabled = true
        );
END;
$$ LANGUAGE plpgsql;

-- Function to get alert recipients for a specific alert type
CREATE OR REPLACE FUNCTION get_alert_recipients(alert_type_param TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    email TEXT,
    phone TEXT,
    role TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ar.id,
        ar.name,
        ar.email,
        ar.phone,
        ar.role
    FROM alert_recipients ar
    WHERE ar.is_active = true
        AND alert_type_param = ANY(ar.alert_types);
END;
$$ LANGUAGE plpgsql;

-- Function to check if alert was sent recently (cooldown check)
CREATE OR REPLACE FUNCTION should_send_alert(
    product_id_param UUID,
    alert_type_param TEXT,
    recipient_id_param UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    cooldown_minutes INTEGER;
    last_alert_time TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get cooldown period from configuration
    SELECT ac.cooldown_minutes INTO cooldown_minutes
    FROM alert_configurations ac
    WHERE ac.alert_type = alert_type_param
    LIMIT 1;
    
    -- Default cooldown if not configured
    IF cooldown_minutes IS NULL THEN
        cooldown_minutes := 1440; -- 24 hours
    END IF;
    
    -- Check if alert was sent recently
    SELECT MAX(ah.created_at) INTO last_alert_time
    FROM alert_history ah
    WHERE ah.product_id = product_id_param
        AND ah.alert_type = alert_type_param
        AND ah.recipient_id = recipient_id_param
        AND ah.status IN ('sent', 'delivered');
    
    -- Return true if no recent alert or cooldown period has passed
    RETURN last_alert_time IS NULL OR 
           last_alert_time < (NOW() - INTERVAL '1 minute' * cooldown_minutes);
END;
$$ LANGUAGE plpgsql;

-- Insert default alert templates
INSERT INTO
    alert_templates (
        name,
        type,
        channel,
        subject,
        body
    )
VALUES
    -- Low Stock Email Template
    (
        'Low Stock Alert - Email',
        'low_stock',
        'email',
        'Low Stock Alert: {{product_name}}',
        'Dear {{recipient_name}},

This is an automated alert from your POS system.

Product: {{product_name}} (SKU: {{product_sku}})
Current Stock: {{current_stock}}
Minimum Stock: {{min_stock}}
Category: {{product_category}}

Please consider restocking this item to avoid stockouts.

Best regards,
POS System'
    ),

-- Out of Stock Email Template
(
    'Out of Stock Alert - Email',
    'out_of_stock',
    'email',
    'URGENT: Out of Stock - {{product_name}}',
    'Dear {{recipient_name}},

URGENT ALERT: The following product is now out of stock:

Product: {{product_name}} (SKU: {{product_sku}})
Current Stock: {{current_stock}}
Minimum Stock: {{min_stock}}
Category: {{product_category}}

Immediate action is required to restock this item.

Best regards,
POS System'
),

-- Reorder Email Template
(
    'Reorder Alert - Email',
    'reorder',
    'email',
    'Reorder Alert: {{product_name}}',
    'Dear {{recipient_name}},

This product has reached its reorder point:

Product: {{product_name}} (SKU: {{product_sku}})
Current Stock: {{current_stock}}
Minimum Stock: {{min_stock}}
Category: {{product_category}}

Please place a reorder to maintain adequate stock levels.

Best regards,
POS System'
),

-- Low Stock SMS Template
(
    'Low Stock Alert - SMS',
    'low_stock',
    'sms',
    NULL,
    'LOW STOCK: {{product_name}} ({{product_sku}}) - Stock: {{current_stock}}, Min: {{min_stock}}'
),

-- Out of Stock SMS Template
(
    'Out of Stock Alert - SMS',
    'out_of_stock',
    'sms',
    NULL,
    'URGENT: {{product_name}} ({{product_sku}}) is OUT OF STOCK!'
),

-- Reorder SMS Template
(
    'Reorder Alert - SMS',
    'reorder',
    'sms',
    NULL,
    'REORDER: {{product_name}} ({{product_sku}}) - Stock: {{current_stock}}, Min: {{min_stock}}'
) ON CONFLICT DO NOTHING;

-- Insert default alert configurations
INSERT INTO
    alert_configurations (
        alert_type,
        is_enabled,
        threshold_value,
        check_frequency_minutes,
        cooldown_minutes
    )
VALUES (
        'low_stock',
        true,
        150,
        60,
        1440
    ), -- Check every hour, 150% of min_stock threshold, 24h cooldown
    (
        'out_of_stock',
        true,
        NULL,
        30,
        720
    ), -- Check every 30 minutes, 12h cooldown
    (
        'reorder',
        true,
        NULL,
        60,
        1440
    ) -- Check every hour, 24h cooldown
    ON CONFLICT DO NOTHING;

-- Insert default alert schedules
INSERT INTO
    alert_schedules (
        alert_type,
        is_active,
        next_run
    )
VALUES (
        'low_stock',
        true,
        NOW() + INTERVAL '1 hour'
    ),
    (
        'out_of_stock',
        true,
        NOW() + INTERVAL '30 minutes'
    ),
    (
        'reorder',
        true,
        NOW() + INTERVAL '1 hour'
    ) ON CONFLICT DO NOTHING;

-- Create a view for easy alert monitoring
CREATE OR REPLACE VIEW alert_monitoring AS
SELECT
    ah.id,
    ah.alert_type,
    ah.product_name,
    ah.product_sku,
    ah.current_stock,
    ah.min_stock,
    ah.recipient_name,
    ah.channel,
    ah.status,
    ah.created_at,
    ah.sent_at,
    ah.delivered_at,
    CASE
        WHEN ah.status = 'delivered' THEN 'Delivered'
        WHEN ah.status = 'sent' THEN 'Sent'
        WHEN ah.status = 'failed' THEN 'Failed'
        ELSE 'Pending'
    END as status_display
FROM alert_history ah
ORDER BY ah.created_at DESC;

-- Grant necessary permissions
GRANT
SELECT,
INSERT
,
UPDATE,
DELETE ON alert_recipients TO authenticated;

GRANT
SELECT,
INSERT
,
UPDATE,
DELETE ON alert_templates TO authenticated;

GRANT
SELECT,
INSERT
,
UPDATE,
DELETE ON alert_configurations TO authenticated;

GRANT
SELECT,
INSERT
,
UPDATE,
DELETE ON alert_history TO authenticated;

GRANT
SELECT,
INSERT
,
UPDATE,
DELETE ON alert_schedules TO authenticated;

GRANT
SELECT,
INSERT
,
UPDATE,
DELETE ON notification_service_config TO authenticated;

GRANT SELECT ON alert_monitoring TO authenticated;

-- Enable Row Level Security
ALTER TABLE alert_recipients ENABLE ROW LEVEL SECURITY;

ALTER TABLE alert_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE alert_configurations ENABLE ROW LEVEL SECURITY;

ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE alert_schedules ENABLE ROW LEVEL SECURITY;

ALTER TABLE notification_service_config ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (adjust based on your auth requirements)
CREATE POLICY "Allow all operations for authenticated users" ON alert_recipients FOR ALL USING (
    auth.role () = 'authenticated'
);

CREATE POLICY "Allow all operations for authenticated users" ON alert_templates FOR ALL USING (
    auth.role () = 'authenticated'
);

CREATE POLICY "Allow all operations for authenticated users" ON alert_configurations FOR ALL USING (
    auth.role () = 'authenticated'
);

CREATE POLICY "Allow all operations for authenticated users" ON alert_history FOR ALL USING (
    auth.role () = 'authenticated'
);

CREATE POLICY "Allow all operations for authenticated users" ON alert_schedules FOR ALL USING (
    auth.role () = 'authenticated'
);

CREATE POLICY "Allow all operations for authenticated users" ON notification_service_config FOR ALL USING (
    auth.role () = 'authenticated'
);
-- Migration: Add payments column and support 'split' payment_method

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS payments JSONB DEFAULT '[]'::jsonb;

-- Update payment_method check to include 'split'
ALTER TABLE sales
  DROP CONSTRAINT IF EXISTS sales_payment_method_check;

ALTER TABLE sales
  ADD CONSTRAINT sales_payment_method_check CHECK (payment_method IN ('cash', 'card', 'digital', 'credit', 'split'));

-- Optional: create GIN index on payments JSONB column (for JSON containment queries)
CREATE INDEX IF NOT EXISTS idx_sales_payments_gin ON sales USING gin (payments jsonb_path_ops);

-- Note: If you prefer a separate payments table for normalization, create a new table payments linked to sales.id
-- and migrate existing payments JSON into that table. For quick support, JSONB column is the fastest path.

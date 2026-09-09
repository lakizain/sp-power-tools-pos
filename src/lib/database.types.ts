// ================================================================
// Auto-generated Supabase types for S&P POWER TOOLS POS
// Aligned to: full_database_setup.sql + migration_optional_features_2026_09_09.sql
//             + schema_alignment migration (description column, feature_toggles, etc)
//             + migration_rentals_2026_09_09.sql (rentals, rental_items, rental_return enum)
// ================================================================
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: string;
          store_name: string;
          store_address: string | null;
          store_phone: string | null;
          store_email: string | null;
          store_logo: string | null;
          tax_rate: number;
          currency: string;
          base_currency: string | null;
          exchange_rate_provider: string | null;
          exchange_rate_api_key: string | null;
          exchange_rate_update_interval: number | null;
          auto_backup: boolean;
          receipt_printer: boolean;
          interface_mode: string | null;
          theme: string | null;
          invoice_prefix: string;
          invoice_counter: number;
          feature_toggles: Json;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          store_name: string;
          store_address?: string | null;
          store_phone?: string | null;
          store_email?: string | null;
          store_logo?: string | null;
          tax_rate?: number;
          currency?: string;
          base_currency?: string | null;
          exchange_rate_provider?: string | null;
          exchange_rate_api_key?: string | null;
          exchange_rate_update_interval?: number | null;
          auto_backup?: boolean;
          receipt_printer?: boolean;
          interface_mode?: string | null;
          theme?: string | null;
          invoice_prefix?: string;
          invoice_counter?: number;
          feature_toggles?: Json;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          store_name?: string;
          store_address?: string | null;
          store_phone?: string | null;
          store_email?: string | null;
          store_logo?: string | null;
          tax_rate?: number;
          currency?: string;
          base_currency?: string | null;
          exchange_rate_provider?: string | null;
          exchange_rate_api_key?: string | null;
          exchange_rate_update_interval?: number | null;
          auto_backup?: boolean;
          receipt_printer?: boolean;
          interface_mode?: string | null;
          theme?: string | null;
          invoice_prefix?: string;
          invoice_counter?: number;
          feature_toggles?: Json;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          active: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      customers: {
        Row: {
          id: string;
          name: string;
          email: string;
          phone: string;
          address: string | null;
          credit_limit: number;
          credit_used: number;
          price_tier: string;
          total_purchases: number;
          last_purchase: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          email?: string;
          phone?: string;
          address?: string | null;
          credit_limit?: number;
          credit_used?: number;
          price_tier?: string;
          total_purchases?: number;
          last_purchase?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          phone?: string;
          address?: string | null;
          credit_limit?: number;
          credit_used?: number;
          price_tier?: string;
          total_purchases?: number;
          last_purchase?: string | null;
          created_at?: string | null;
        };
      };

      suppliers: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          phone: string;
          phone2: string | null;
          address: string | null;
          payment_terms: string | null;
          tax_id: string | null;
          bank_details: Json | null;
          website: string | null;
          contact_person: string | null;
          rating: number;
          notes: string | null;
          total_purchases: number;
          outstanding_balance: number;
          active: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          email?: string | null;
          phone?: string;
          phone2?: string | null;
          address?: string | null;
          payment_terms?: string | null;
          tax_id?: string | null;
          bank_details?: Json | null;
          website?: string | null;
          contact_person?: string | null;
          rating?: number;
          notes?: string | null;
          total_purchases?: number;
          outstanding_balance?: number;
          active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string | null;
          phone?: string;
          phone2?: string | null;
          address?: string | null;
          payment_terms?: string | null;
          tax_id?: string | null;
          bank_details?: Json | null;
          website?: string | null;
          contact_person?: string | null;
          rating?: number;
          notes?: string | null;
          total_purchases?: number;
          outstanding_balance?: number;
          active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      products: {
        Row: {
          id: string;
          sku: string;
          barcode: string | null;
          name: string;
          description: string | null;
          category: string | null;
          base_currency: string | null;
          price_in_base_currency: number | null;
          price: number;
          cost: number;
          stock: number;
          min_stock: number;
          image: string | null;
          is_weight_based: boolean;
          price_per_unit: number | null;
          unit: string | null;
          track_inventory: boolean;
          taxable: boolean;
          active: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          sku: string;
          barcode?: string | null;
          name: string;
          description?: string | null;
          category?: string | null;
          base_currency?: string | null;
          price_in_base_currency?: number | null;
          price?: number;
          cost?: number;
          stock?: number;
          min_stock?: number;
          image?: string | null;
          is_weight_based?: boolean;
          price_per_unit?: number | null;
          unit?: string | null;
          track_inventory?: boolean;
          taxable?: boolean;
          active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          sku?: string;
          barcode?: string | null;
          name?: string;
          description?: string | null;
          category?: string | null;
          base_currency?: string | null;
          price_in_base_currency?: number | null;
          price?: number;
          cost?: number;
          stock?: number;
          min_stock?: number;
          image?: string | null;
          is_weight_based?: boolean;
          price_per_unit?: number | null;
          unit?: string | null;
          track_inventory?: boolean;
          taxable?: boolean;
          active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      product_batches: {
        Row: {
          id: string;
          product_id: string;
          batch_number: string;
          manufacturing_date: string | null;
          expiry_date: string | null;
          quantity: number;
          cost_price: number;
          supplier_info: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          product_id: string;
          batch_number: string;
          manufacturing_date?: string | null;
          expiry_date?: string | null;
          quantity?: number;
          cost_price?: number;
          supplier_info?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          product_id?: string;
          batch_number?: string;
          manufacturing_date?: string | null;
          expiry_date?: string | null;
          quantity?: number;
          cost_price?: number;
          supplier_info?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      discounts: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          type: string;
          value: number;
          conditions: Json | null;
          free_gift_products: string[] | null;
          min_amount: number | null;
          max_discount: number | null;
          valid_from: string;
          valid_to: string;
          valid_days: number[] | null;
          active: boolean;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          type: string;
          value?: number;
          conditions?: Json | null;
          free_gift_products?: string[] | null;
          min_amount?: number | null;
          max_discount?: number | null;
          valid_from: string;
          valid_to: string;
          valid_days?: number[] | null;
          active?: boolean;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          type?: string;
          value?: number;
          conditions?: Json | null;
          free_gift_products?: string[] | null;
          min_amount?: number | null;
          max_discount?: number | null;
          valid_from?: string;
          valid_to?: string;
          valid_days?: number[] | null;
          active?: boolean;
          created_at?: string | null;
        };
      };

      users: {
        Row: {
          id: string;
          username: string;
          name: string;
          email: string;
          role: string;
          permissions: string[] | null;
          password_hash: string | null;
          pin: string | null;
          active: boolean;
          last_login: string | null;
          avatar: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          username: string;
          name: string;
          email: string;
          role?: string;
          permissions?: string[] | null;
          password_hash?: string | null;
          pin?: string | null;
          active?: boolean;
          last_login?: string | null;
          avatar?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          username?: string;
          name?: string;
          email?: string;
          role?: string;
          permissions?: string[] | null;
          password_hash?: string | null;
          pin?: string | null;
          active?: boolean;
          last_login?: string | null;
          avatar?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      sales: {
        Row: {
          id: string;
          invoice_number: string;
          customer_id: string | null;
          customer_name: string | null;
          items: Json;
          subtotal: number;
          discount_amount: number;
          tax_amount: number;
          total: number;
          payment_method: string;
          payments: Json | null;
          card_details: Json | null;
          status: string;
          cashier: string;
          cashier_role: string | null;
          timestamp: string | null;
          receipt_number: string;
          notes: string | null;
          applied_discounts: Json | null;
          free_gifts: Json | null;
          transaction_currency: string | null;
          base_currency_amount: number | null;
          exchange_rate_used: number | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          invoice_number: string;
          customer_id?: string | null;
          customer_name?: string | null;
          items?: Json;
          subtotal?: number;
          discount_amount?: number;
          tax_amount?: number;
          total?: number;
          payment_method?: string;
          payments?: Json | null;
          card_details?: Json | null;
          status?: string;
          cashier?: string;
          cashier_role?: string | null;
          timestamp?: string | null;
          receipt_number: string;
          notes?: string | null;
          applied_discounts?: Json | null;
          free_gifts?: Json | null;
          transaction_currency?: string | null;
          base_currency_amount?: number | null;
          exchange_rate_used?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          invoice_number?: string;
          customer_id?: string | null;
          customer_name?: string | null;
          items?: Json;
          subtotal?: number;
          discount_amount?: number;
          tax_amount?: number;
          total?: number;
          payment_method?: string;
          payments?: Json | null;
          card_details?: Json | null;
          status?: string;
          cashier?: string;
          cashier_role?: string | null;
          timestamp?: string | null;
          receipt_number?: string;
          notes?: string | null;
          applied_discounts?: Json | null;
          free_gifts?: Json | null;
          transaction_currency?: string | null;
          base_currency_amount?: number | null;
          exchange_rate_used?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      sales_tabs: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          cart: Json;
          selected_customer: Json | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string;
          cart?: Json;
          selected_customer?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          cart?: Json;
          selected_customer?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      currency_config: {
        Row: {
          id: string;
          code: string;
          name: string;
          symbol: string;
          symbol_position: string;
          decimal_places: number;
          is_active: boolean;
          is_base_currency: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          symbol: string;
          symbol_position?: string;
          decimal_places?: number;
          is_active?: boolean;
          is_base_currency?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          symbol?: string;
          symbol_position?: string;
          decimal_places?: number;
          is_active?: boolean;
          is_base_currency?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      exchange_rates: {
        Row: {
          id: string;
          base_currency: string;
          target_currency: string;
          rate: number;
          source: string;
          is_manual_override: boolean;
          effective_from: string | null;
          effective_to: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          base_currency: string;
          target_currency: string;
          rate?: number;
          source?: string;
          is_manual_override?: boolean;
          effective_from?: string | null;
          effective_to?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          base_currency?: string;
          target_currency?: string;
          rate?: number;
          source?: string;
          is_manual_override?: boolean;
          effective_from?: string | null;
          effective_to?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      exchange_rate_history: {
        Row: {
          id: string;
          base_currency: string;
          target_currency: string;
          rate: number;
          previous_rate: number | null;
          change_percentage: number | null;
          source: string;
          is_manual_override: boolean;
          recorded_at: string | null;
        };
        Insert: {
          id?: string;
          base_currency: string;
          target_currency: string;
          rate?: number;
          previous_rate?: number | null;
          change_percentage?: number | null;
          source?: string;
          is_manual_override?: boolean;
          recorded_at?: string | null;
        };
        Update: {
          id?: string;
          base_currency?: string;
          target_currency?: string;
          rate?: number;
          previous_rate?: number | null;
          change_percentage?: number | null;
          source?: string;
          is_manual_override?: boolean;
          recorded_at?: string | null;
        };
      };

      expense_categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          color: string | null;
          icon: string | null;
          budget: number | null;
          active: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          color?: string | null;
          icon?: string | null;
          budget?: number | null;
          active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          color?: string | null;
          icon?: string | null;
          budget?: number | null;
          active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      expenses: {
        Row: {
          id: string;
          category_name: string;
          subcategory: string | null;
          description: string | null;
          amount: number;
          currency: string | null;
          date: string;
          payment_method: string;
          supplier_id: string | null;
          reference_number: string | null;
          receipt_number: string | null;
          notes: string | null;
          attachment_url: string | null;
          status: string;
          created_by: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          category_name?: string;
          subcategory?: string | null;
          description?: string | null;
          amount?: number;
          currency?: string | null;
          date: string;
          payment_method?: string;
          supplier_id?: string | null;
          reference_number?: string | null;
          receipt_number?: string | null;
          notes?: string | null;
          attachment_url?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          category_name?: string;
          subcategory?: string | null;
          description?: string | null;
          amount?: number;
          currency?: string | null;
          date?: string;
          payment_method?: string;
          supplier_id?: string | null;
          reference_number?: string | null;
          receipt_number?: string | null;
          notes?: string | null;
          attachment_url?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      product_returns: {
        Row: {
          id: string;
          return_number: string | null;
          sale_id: string;
          invoice_number: string;
          customer_id: string | null;
          customer_name: string | null;
          subtotal: number;
          tax_amount: number;
          total_refund: number;
          reason: string;
          return_method: string;
          payment_method: string | null;
          status: string;
          items_count: number | null;
          restocked: boolean;
          processed_by: string | null;
          processed_at: string | null;
          created_by: string | null;
          notes: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          return_number?: string | null;
          sale_id: string;
          invoice_number: string;
          customer_id?: string | null;
          customer_name?: string | null;
          subtotal?: number;
          tax_amount?: number;
          total_refund?: number;
          reason?: string;
          return_method?: string;
          payment_method?: string | null;
          status?: string;
          items_count?: number | null;
          restocked?: boolean;
          processed_by?: string | null;
          processed_at?: string | null;
          created_by?: string | null;
          notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          return_number?: string | null;
          sale_id?: string;
          invoice_number?: string;
          customer_id?: string | null;
          customer_name?: string | null;
          subtotal?: number;
          tax_amount?: number;
          total_refund?: number;
          reason?: string;
          return_method?: string;
          payment_method?: string | null;
          status?: string;
          items_count?: number | null;
          restocked?: boolean;
          processed_by?: string | null;
          processed_at?: string | null;
          created_by?: string | null;
          notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      return_items: {
        Row: {
          id: string;
          return_id: string;
          product_id: string;
          product_name: string;
          sku: string | null;
          quantity: number;
          unit_price: number;
          subtotal: number;
          tax_rate: number | null;
          tax_amount: number | null;
          reason: string | null;
          condition: string | null;
          notes: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          return_id: string;
          product_id: string;
          product_name: string;
          sku?: string | null;
          quantity?: number;
          unit_price?: number;
          subtotal?: number;
          tax_rate?: number | null;
          tax_amount?: number | null;
          reason?: string | null;
          condition?: string | null;
          notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          return_id?: string;
          product_id?: string;
          product_name?: string;
          sku?: string | null;
          quantity?: number;
          unit_price?: number;
          subtotal?: number;
          tax_rate?: number | null;
          tax_amount?: number | null;
          reason?: string | null;
          condition?: string | null;
          notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      rentals: {
        Row: {
          id: string;
          rental_number: string | null;
          customer_id: string | null;
          customer_name: string | null;
          items: Json;
          rent_from: string;
          rent_to: string;
          daily_rate: number;
          weekly_rate: number | null;
          security_deposit: number;
          total_rent: number;
          paid_amount: number;
          status: string;
          notes: string | null;
          created_by: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          rental_number?: string | null;
          customer_id?: string | null;
          customer_name?: string | null;
          items?: Json;
          rent_from: string;
          rent_to: string;
          daily_rate?: number;
          weekly_rate?: number | null;
          security_deposit?: number;
          total_rent?: number;
          paid_amount?: number;
          status?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          rental_number?: string | null;
          customer_id?: string | null;
          customer_name?: string | null;
          items?: Json;
          rent_from?: string;
          rent_to?: string;
          daily_rate?: number;
          weekly_rate?: number | null;
          security_deposit?: number;
          total_rent?: number;
          paid_amount?: number;
          status?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      rental_items: {
        Row: {
          id: string;
          rental_id: string;
          product_id: string | null;
          product_name: string;
          sku: string | null;
          quantity: number;
          daily_rate: number;
          subtotal: number;
          condition: string | null;
          notes: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          rental_id: string;
          product_id?: string | null;
          product_name: string;
          sku?: string | null;
          quantity?: number;
          daily_rate?: number;
          subtotal?: number;
          condition?: string | null;
          notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          rental_id?: string;
          product_id?: string | null;
          product_name?: string;
          sku?: string | null;
          quantity?: number;
          daily_rate?: number;
          subtotal?: number;
          condition?: string | null;
          notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      outstanding_payments: {
        Row: {
          id: string;
          customer_id: string;
          customer_name: string | null;
          sale_id: string;
          invoice_number: string;
          total_amount: number;
          paid_amount: number;
          outstanding_amount: number;
          due_date: string;
          issue_date: string;
          status: string;
          notes: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          customer_id: string;
          customer_name?: string | null;
          sale_id: string;
          invoice_number: string;
          total_amount?: number;
          paid_amount?: number;
          outstanding_amount?: number;
          due_date: string;
          issue_date?: string;
          status?: string;
          notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          customer_id?: string;
          customer_name?: string | null;
          sale_id?: string;
          invoice_number?: string;
          total_amount?: number;
          paid_amount?: number;
          outstanding_amount?: number;
          due_date?: string;
          issue_date?: string;
          status?: string;
          notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      payment_records: {
        Row: {
          id: string;
          outstanding_payment_id: string;
          amount: number;
          date: string;
          method: string;
          currency: string | null;
          receipt_url: string | null;
          reference: string | null;
          received_by: string;
          notes: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          outstanding_payment_id: string;
          amount?: number;
          date?: string;
          method?: string;
          currency?: string | null;
          receipt_url?: string | null;
          reference?: string | null;
          received_by: string;
          notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          outstanding_payment_id?: string;
          amount?: number;
          date?: string;
          method?: string;
          currency?: string | null;
          receipt_url?: string | null;
          reference?: string | null;
          received_by?: string;
          notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      alert_recipients: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          phone: string | null;
          role: string;
          alert_types: string[] | null;
          is_active: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          role?: string;
          alert_types?: string[] | null;
          is_active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string | null;
          phone?: string | null;
          role?: string;
          alert_types?: string[] | null;
          is_active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      alert_templates: {
        Row: {
          id: string;
          name: string;
          type: string;
          channel: string;
          subject: string | null;
          body: string;
          is_active: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          type: string;
          channel?: string;
          subject?: string | null;
          body?: string;
          is_active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          type?: string;
          channel?: string;
          subject?: string | null;
          body?: string;
          is_active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      alert_configurations: {
        Row: {
          id: string;
          alert_type: string;
          is_enabled: boolean;
          threshold_value: number | null;
          check_frequency_minutes: number;
          cooldown_minutes: number;
          email_template_id: string | null;
          sms_template_id: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          alert_type: string;
          is_enabled?: boolean;
          threshold_value?: number | null;
          check_frequency_minutes?: number;
          cooldown_minutes?: number;
          email_template_id?: string | null;
          sms_template_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          alert_type?: string;
          is_enabled?: boolean;
          threshold_value?: number | null;
          check_frequency_minutes?: number;
          cooldown_minutes?: number;
          email_template_id?: string | null;
          sms_template_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      alert_history: {
        Row: {
          id: string;
          alert_type: string;
          product_id: string;
          product_name: string;
          product_sku: string;
          current_stock: number;
          min_stock: number;
          threshold_value: number | null;
          recipient_id: string;
          recipient_name: string;
          recipient_email: string | null;
          recipient_phone: string | null;
          channel: string;
          status: string;
          template_id: string | null;
          message_content: string | null;
          error_message: string | null;
          sent_at: string | null;
          delivered_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          alert_type: string;
          product_id: string;
          product_name: string;
          product_sku: string;
          current_stock?: number;
          min_stock?: number;
          threshold_value?: number | null;
          recipient_id: string;
          recipient_name: string;
          recipient_email?: string | null;
          recipient_phone?: string | null;
          channel?: string;
          status?: string;
          template_id?: string | null;
          message_content?: string | null;
          error_message?: string | null;
          sent_at?: string | null;
          delivered_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          alert_type?: string;
          product_id?: string;
          product_name?: string;
          product_sku?: string;
          current_stock?: number;
          min_stock?: number;
          threshold_value?: number | null;
          recipient_id?: string;
          recipient_name?: string;
          recipient_email?: string | null;
          recipient_phone?: string | null;
          channel?: string;
          status?: string;
          template_id?: string | null;
          message_content?: string | null;
          error_message?: string | null;
          sent_at?: string | null;
          delivered_at?: string | null;
          created_at?: string | null;
        };
      };

      alert_schedules: {
        Row: {
          id: string;
          alert_type: string;
          is_active: boolean;
          last_run: string | null;
          next_run: string | null;
          run_count: number;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          alert_type: string;
          is_active?: boolean;
          last_run?: string | null;
          next_run?: string | null;
          run_count?: number;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          alert_type?: string;
          is_active?: boolean;
          last_run?: string | null;
          next_run?: string | null;
          run_count?: number;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };

      notification_service_config: {
        Row: {
          id: string;
          service_name: string;
          service_type: string;
          config_data: Json;
          is_active: boolean;
          is_default: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          service_name: string;
          service_type: string;
          config_data?: Json;
          is_active?: boolean;
          is_default?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          service_name?: string;
          service_type?: string;
          config_data?: Json;
          is_active?: boolean;
          is_default?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
    };

    Views: {
      alert_monitoring: {
        Row: {
          id?: string;
          alert_type?: string | null;
          active_configs?: number | null;
          active_recipients?: number | null;
          recipients_by_role?: Json | null;
          pending_alerts?: number | null;
          sent_today?: number | null;
          failed_today?: number | null;
          last_sent_at?: string | null;
          pending_alerts_detail?: Json | null;
        };
      };
    };

    Functions: {
      update_updated_at_column: { Args: { }; Returns: 'trigger' };
      generate_return_number: { Args: { }; Returns: 'trigger' };
      sync_outstanding_amount: { Args: { }; Returns: 'trigger' };
      generate_sales_invoice_number: { Args: { }; Returns: 'trigger' };
    };

    Enums: Record<string, never>;
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row'];

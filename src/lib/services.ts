import { supabase } from './supabase'
import {
  Product,
  Customer,
  Sale,
  Discount,
  User,
  AppSettings,
  SalesTab,
  ProductBatch,
  AlertRecipient,
  AlertTemplate,
  AlertConfiguration,
  AlertHistory,
  AlertSchedule,
  NotificationServiceConfig,
  InventoryAlert,
  Supplier,
  Expense,
  ProductReturn,
  OutstandingPayment,
  Rental,
  RentalItem
} from '../types'

// Products Service
export const productsService = {
  async getAll(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        product_batches (*)
      `)
      .eq('active', true)
      .order('name')

    if (error) throw error

    return data.map(product => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || undefined,
      price: product.price || 0,
      cost: product.cost || 0,
      stock: product.stock || 0,
      minStock: product.min_stock || 0,
      category: product.category,
      description: product.description || '',
      image: product.image || undefined,
      taxable: product.taxable ?? true,
      active: product.active ?? true,
      isWeightBased: product.is_weight_based ?? false,
      pricePerUnit: product.price_per_unit || undefined,
      unit: product.unit || undefined,
      trackInventory: product.track_inventory ?? true,
      batches: product.product_batches?.map((batch: any) => ({
        id: batch.id,
        batchNumber: batch.batch_number,
        manufacturingDate: new Date(batch.manufacturing_date),
        expiryDate: new Date(batch.expiry_date),
        quantity: batch.quantity || 0,
        costPrice: batch.cost_price || 0,
        supplierInfo: batch.supplier_info || ''
      })) || [],
      createdAt: new Date(product.created_at),
      updatedAt: new Date(product.updated_at)
    }))
  },

  async create(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .insert({
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        price: product.price,
        cost: product.cost,
        stock: product.stock,
        min_stock: product.minStock,
        category: product.category,
        description: product.description,
        image: product.image,
        taxable: product.taxable,
        active: product.active,
        is_weight_based: product.isWeightBased,
        price_per_unit: product.pricePerUnit,
        unit: product.unit,
        track_inventory: product.trackInventory
      })
      .select()
      .single()

    if (error) throw error

    // Insert batches if any
    if (product.batches && product.batches.length > 0) {
      const batchesData = product.batches.map(batch => ({
        product_id: data.id,
        batch_number: batch.batchNumber,
        manufacturing_date: batch.manufacturingDate.toISOString().split('T')[0],
        expiry_date: batch.expiryDate.toISOString().split('T')[0],
        quantity: batch.quantity,
        cost_price: batch.costPrice,
        supplier_info: batch.supplierInfo
      }))

      await supabase.from('product_batches').insert(batchesData)
    }

    return this.getById(data.id)
  },

  async update(id: string, product: Partial<Product>): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .update({
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        price: product.price,
        cost: product.cost,
        stock: product.stock,
        min_stock: product.minStock,
        category: product.category,
        description: product.description,
        image: product.image,
        taxable: product.taxable,
        active: product.active,
        is_weight_based: product.isWeightBased,
        price_per_unit: product.pricePerUnit,
        unit: product.unit,
        track_inventory: product.trackInventory
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Update batches if provided
    if (product.batches) {
      // Delete existing batches
      await supabase.from('product_batches').delete().eq('product_id', id)

      // Insert new batches
      if (product.batches.length > 0) {
        const batchesData = product.batches.map(batch => ({
          product_id: id,
          batch_number: batch.batchNumber,
          manufacturing_date: batch.manufacturingDate.toISOString().split('T')[0],
          expiry_date: batch.expiryDate.toISOString().split('T')[0],
          quantity: batch.quantity,
          cost_price: batch.costPrice,
          supplier_info: batch.supplierInfo
        }))

        await supabase.from('product_batches').insert(batchesData)
      }
    }

    return this.getById(id)
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  async getById(id: string): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        product_batches (*)
      `)
      .eq('id', id)
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      sku: data.sku,
      barcode: data.barcode || undefined,
      price: data.price || 0,
      cost: data.cost || 0,
      stock: data.stock || 0,
      minStock: data.min_stock || 0,
      category: data.category,
      description: data.description || '',
      image: data.image || undefined,
      taxable: data.taxable ?? true,
      active: data.active ?? true,
      isWeightBased: data.is_weight_based ?? false,
      pricePerUnit: data.price_per_unit || undefined,
      unit: data.unit || undefined,
      batches: data.product_batches?.map((batch: any) => ({
        id: batch.id,
        batchNumber: batch.batch_number,
        manufacturingDate: new Date(batch.manufacturing_date),
        expiryDate: new Date(batch.expiry_date),
        quantity: batch.quantity || 0,
        costPrice: batch.cost_price || 0,
        supplierInfo: batch.supplier_info || ''
      })) || [],
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  }
}

// Customers Service
export const customersService = {
  async getAll(): Promise<Customer[]> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name')

    if (error) throw error

    return data.map(customer => ({
      id: customer.id,
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      creditLimit: customer.credit_limit || 0,
      creditUsed: customer.credit_used || 0,
      priceTier: customer.price_tier || 'Standard',
      totalPurchases: customer.total_purchases || 0,
      lastPurchase: customer.last_purchase ? new Date(customer.last_purchase) : undefined,
      createdAt: new Date(customer.created_at)
    }))
  },

  async create(customer: Omit<Customer, 'id' | 'createdAt'>): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers')
      .insert({
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        credit_limit: customer.creditLimit,
        credit_used: customer.creditUsed,
        price_tier: customer.priceTier,
        total_purchases: customer.totalPurchases,
        last_purchase: customer.lastPurchase?.toISOString()
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      email: data.email || '',
      phone: data.phone || '',
      address: data.address || '',
      creditLimit: data.credit_limit || 0,
      creditUsed: data.credit_used || 0,
      priceTier: data.price_tier || 'Standard',
      totalPurchases: data.total_purchases || 0,
      lastPurchase: data.last_purchase ? new Date(data.last_purchase) : undefined,
      createdAt: new Date(data.created_at)
    }
  },

  async update(id: string, customer: Partial<Customer>): Promise<Customer> {
    // Only include fields that are actually provided
    const updateData: any = {};

    if (customer.name !== undefined) updateData.name = customer.name;
    if (customer.email !== undefined) updateData.email = customer.email;
    if (customer.phone !== undefined) updateData.phone = customer.phone;
    if (customer.address !== undefined) updateData.address = customer.address;
    if (customer.creditLimit !== undefined) updateData.credit_limit = customer.creditLimit;
    if (customer.creditUsed !== undefined) updateData.credit_used = customer.creditUsed;
    if (customer.priceTier !== undefined) updateData.price_tier = customer.priceTier;
    if (customer.totalPurchases !== undefined) updateData.total_purchases = customer.totalPurchases;
    if (customer.lastPurchase !== undefined) updateData.last_purchase = customer.lastPurchase?.toISOString();

    const { data, error } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      email: data.email || '',
      phone: data.phone || '',
      address: data.address || '',
      creditLimit: data.credit_limit || 0,
      creditUsed: data.credit_used || 0,
      priceTier: data.price_tier || 'Standard',
      totalPurchases: data.total_purchases || 0,
      lastPurchase: data.last_purchase ? new Date(data.last_purchase) : undefined,
      createdAt: new Date(data.created_at)
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

// Sales Service
export const salesService = {
  async getAll(): Promise<Sale[]> {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return data.map(sale => ({
      id: sale.id,
      invoiceNumber: sale.invoice_number,
      customerId: sale.customer_id || undefined,
      customerName: sale.customer_name || undefined,
      items: sale.items as any[],
      subtotal: sale.subtotal || 0,
      discountAmount: sale.discount_amount || 0,
      taxAmount: sale.tax_amount || 0,
      total: sale.total || 0,
      paymentMethod: sale.payment_method as any,
      payments: sale.payments as any,
      cardDetails: sale.card_details as any,
      status: sale.status as any,
      cashier: sale.cashier || '',
      timestamp: new Date(sale.created_at),
      receiptNumber: sale.receipt_number || undefined,
      notes: sale.notes || undefined,
      appliedDiscounts: sale.applied_discounts as any,
      freeGifts: sale.free_gifts as any
    }))
  },

  async create(sale: Omit<Sale, 'id'>): Promise<Sale> {
    const { data, error } = await supabase
      .from('sales')
      .insert({
        invoice_number: sale.invoiceNumber,
        customer_id: sale.customerId,
        customer_name: sale.customerName,
        items: sale.items,
        subtotal: sale.subtotal,
        discount_amount: sale.discountAmount,
        tax_amount: sale.taxAmount,
        total: sale.total,
        payment_method: sale.paymentMethod,
        payments: sale.payments,
        card_details: sale.cardDetails,
        status: sale.status,
        cashier: sale.cashier,
        receipt_number: sale.receiptNumber,
        notes: sale.notes,
        applied_discounts: sale.appliedDiscounts,
        free_gifts: sale.freeGifts
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      invoiceNumber: data.invoice_number,
      customerId: data.customer_id || undefined,
      customerName: data.customer_name || undefined,
      items: data.items as any[],
      subtotal: data.subtotal || 0,
      discountAmount: data.discount_amount || 0,
      taxAmount: data.tax_amount || 0,
      total: data.total || 0,
      paymentMethod: data.payment_method as any,
      cardDetails: data.card_details as any,
      status: data.status as any,
      cashier: data.cashier || '',
      timestamp: new Date(data.created_at),
      receiptNumber: data.receipt_number || undefined,
      notes: data.notes || undefined,
      appliedDiscounts: data.applied_discounts as any,
      freeGifts: data.free_gifts as any
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

// Discounts Service
export const discountsService = {
  async getAll(): Promise<Discount[]> {
    const { data, error } = await supabase
      .from('discounts')
      .select('*')
      .order('name')

    if (error) throw error

    return data.map(discount => ({
      id: discount.id,
      name: discount.name,
      description: discount.description || '',
      type: discount.type as any,
      value: discount.value || 0,
      conditions: discount.conditions as any,
      freeGiftProducts: discount.free_gift_products || undefined,
      minAmount: discount.min_amount || undefined,
      maxDiscount: discount.max_discount || undefined,
      validFrom: new Date(discount.valid_from),
      validTo: new Date(discount.valid_to),
      validDays: discount.valid_days || undefined,
      active: discount.active ?? true,
      createdAt: new Date(discount.created_at)
    }))
  },

  async create(discount: Omit<Discount, 'id' | 'createdAt'>): Promise<Discount> {
    const { data, error } = await supabase
      .from('discounts')
      .insert({
        name: discount.name,
        description: discount.description,
        type: discount.type,
        value: discount.value,
        conditions: discount.conditions,
        free_gift_products: discount.freeGiftProducts,
        min_amount: discount.minAmount,
        max_discount: discount.maxDiscount,
        valid_from: discount.validFrom.toISOString(),
        valid_to: discount.validTo.toISOString(),
        valid_days: discount.validDays,
        active: discount.active
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      description: data.description || '',
      type: data.type as any,
      value: data.value || 0,
      conditions: data.conditions as any,
      freeGiftProducts: data.free_gift_products || undefined,
      minAmount: data.min_amount || undefined,
      maxDiscount: data.max_discount || undefined,
      validFrom: new Date(data.valid_from),
      validTo: new Date(data.valid_to),
      validDays: data.valid_days || undefined,
      active: data.active ?? true,
      createdAt: new Date(data.created_at)
    }
  },

  async update(id: string, discount: Partial<Discount>): Promise<Discount> {
    const { data, error } = await supabase
      .from('discounts')
      .update({
        name: discount.name,
        description: discount.description,
        type: discount.type,
        value: discount.value,
        conditions: discount.conditions,
        free_gift_products: discount.freeGiftProducts,
        min_amount: discount.minAmount,
        max_discount: discount.maxDiscount,
        valid_from: discount.validFrom?.toISOString(),
        valid_to: discount.validTo?.toISOString(),
        valid_days: discount.validDays,
        active: discount.active
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      description: data.description || '',
      type: data.type as any,
      value: data.value || 0,
      conditions: data.conditions as any,
      freeGiftProducts: data.free_gift_products || undefined,
      minAmount: data.min_amount || undefined,
      maxDiscount: data.max_discount || undefined,
      validFrom: new Date(data.valid_from),
      validTo: new Date(data.valid_to),
      validDays: data.valid_days || undefined,
      active: data.active ?? true,
      createdAt: new Date(data.created_at)
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('discounts')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

// Settings Service
export const settingsService = {
  async get(): Promise<AppSettings> {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .limit(1)
      .single()

    if (error) throw error

    return {
      storeName: data.store_name || 'S&P POWER TOOLS',
      storeAddress: data.store_address || '',
      storePhone: data.store_phone || '',
      storeEmail: data.store_email || '',
      storeLogo: data.store_logo || undefined,
      taxRate: data.tax_rate || 0,
      currency: data.currency || 'USD',
      baseCurrency: data.base_currency || 'USD',
      interfaceMode: data.interface_mode as any || 'touch',
      autoBackup: data.auto_backup ?? true,
      receiptPrinter: data.receipt_printer ?? true,
      theme: data.theme as any || 'light',
      invoicePrefix: data.invoice_prefix || 'INV',
      invoiceCounter: data.invoice_counter || 1000,
      exchangeRateProvider: data.exchange_rate_provider as any || 'exchangerate',
      exchangeRateApiKey: data.exchange_rate_api_key || undefined,
      exchangeRateUpdateInterval: data.exchange_rate_update_interval || 60,
      featureToggles: (data.feature_toggles as any) || undefined
    }
  },

  async update(settings: Partial<AppSettings>): Promise<AppSettings> {
    // First, get the existing settings record to get its ID
    const { data: existingData, error: fetchError } = await supabase
      .from('app_settings')
      .select('id')
      .limit(1)
      .single()

    if (fetchError) throw fetchError

    // Update the existing record by ID
    const { data, error } = await supabase
      .from('app_settings')
      .update({
        store_name: settings.storeName,
        store_address: settings.storeAddress,
        store_phone: settings.storePhone,
        store_email: settings.storeEmail,
        store_logo: settings.storeLogo,
        tax_rate: settings.taxRate,
        currency: settings.currency,
        base_currency: settings.baseCurrency,
        interface_mode: settings.interfaceMode,
        auto_backup: settings.autoBackup,
        receipt_printer: settings.receiptPrinter,
        theme: settings.theme,
        invoice_prefix: settings.invoicePrefix,
        invoice_counter: settings.invoiceCounter,
        exchange_rate_provider: settings.exchangeRateProvider,
        exchange_rate_api_key: settings.exchangeRateApiKey,
        exchange_rate_update_interval: settings.exchangeRateUpdateInterval,
        feature_toggles: settings.featureToggles
      })
      .eq('id', existingData.id)
      .select()
      .single()

    if (error) throw error

    return {
      storeName: data.store_name || 'S&P POWER TOOLS',
      storeAddress: data.store_address || '',
      storePhone: data.store_phone || '',
      storeEmail: data.store_email || '',
      storeLogo: data.store_logo || undefined,
      taxRate: data.tax_rate || 0,
      currency: data.currency || 'USD',
      baseCurrency: data.base_currency || 'USD',
      interfaceMode: data.interface_mode as any || 'touch',
      autoBackup: data.auto_backup ?? true,
      receiptPrinter: data.receipt_printer ?? true,
      theme: data.theme as any || 'light',
      invoicePrefix: data.invoice_prefix || 'INV',
      invoiceCounter: data.invoice_counter || 1000,
      exchangeRateProvider: data.exchange_rate_provider as any || 'exchangerate',
      exchangeRateApiKey: data.exchange_rate_api_key || undefined,
      exchangeRateUpdateInterval: data.exchange_rate_update_interval || 60,
      featureToggles: (data.feature_toggles as any) || undefined
    }
  }
}

// Users Service
export const usersService = {
  async getAll(): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('name')

    if (error) throw error

    return data.map(user => ({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role as any,
      permissions: user.permissions || [],
      active: user.active ?? true,
      lastLogin: user.last_login ? new Date(user.last_login) : undefined,
      avatar: user.avatar || undefined
    }))
  },

  async create(user: Omit<User, 'id'>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .insert({
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        active: user.active,
        avatar: user.avatar
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      username: data.username,
      name: data.name,
      email: data.email,
      role: data.role as any,
      permissions: data.permissions || [],
      active: data.active ?? true,
      lastLogin: data.last_login ? new Date(data.last_login) : undefined,
      avatar: data.avatar || undefined
    }
  },

  async update(id: string, user: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update({
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        active: user.active,
        avatar: user.avatar,
        last_login: user.lastLogin?.toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      username: data.username,
      name: data.name,
      email: data.email,
      role: data.role as any,
      permissions: data.permissions || [],
      active: data.active ?? true,
      lastLogin: data.last_login ? new Date(data.last_login) : undefined,
      avatar: data.avatar || undefined
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

// Sales Tabs Service
export const salesTabsService = {
  async getByUserId(userId: string): Promise<SalesTab[]> {
    const { data, error } = await supabase
      .from('sales_tabs')
      .select(`
        *,
        selected_customer:customers(*)
      `)
      .eq('user_id', userId)
      .order('created_at')

    if (error) throw error

    return data.map(tab => ({
      id: tab.id,
      name: tab.name,
      cart: tab.cart as any[] || [],
      selectedCustomer: tab.selected_customer ? {
        id: tab.selected_customer.id,
        name: tab.selected_customer.name,
        email: tab.selected_customer.email || '',
        phone: tab.selected_customer.phone || '',
        address: tab.selected_customer.address || '',
        creditLimit: tab.selected_customer.credit_limit || 0,
        creditUsed: tab.selected_customer.credit_used || 0,
        priceTier: tab.selected_customer.price_tier || 'Standard',
        totalPurchases: tab.selected_customer.total_purchases || 0,
        lastPurchase: tab.selected_customer.last_purchase ? new Date(tab.selected_customer.last_purchase) : undefined,
        createdAt: new Date(tab.selected_customer.created_at)
      } : null,
      createdAt: new Date(tab.created_at)
    }))
  },

  async create(userId: string, tab: Omit<SalesTab, 'id' | 'createdAt'>): Promise<SalesTab> {
    const { data, error } = await supabase
      .from('sales_tabs')
      .insert({
        user_id: userId,
        name: tab.name,
        cart: tab.cart,
        selected_customer_id: tab.selectedCustomer?.id
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      cart: data.cart as any[] || [],
      selectedCustomer: tab.selectedCustomer,
      createdAt: new Date(data.created_at)
    }
  },

  async update(id: string, tab: Partial<SalesTab>): Promise<SalesTab> {
    const { data, error } = await supabase
      .from('sales_tabs')
      .update({
        name: tab.name,
        cart: tab.cart,
        selected_customer_id: tab.selectedCustomer?.id
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      cart: data.cart as any[] || [],
      selectedCustomer: tab.selectedCustomer || null,
      createdAt: new Date(data.created_at)
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('sales_tabs')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

// Alert Recipients Service
export const alertRecipientsService = {
  async getAll(): Promise<AlertRecipient[]> {
    const { data, error } = await supabase
      .from('alert_recipients')
      .select('*')
      .order('name')

    if (error) throw error

    return data.map(recipient => ({
      id: recipient.id,
      name: recipient.name,
      email: recipient.email || undefined,
      phone: recipient.phone || undefined,
      role: recipient.role as 'admin' | 'manager' | 'cashier',
      alertTypes: recipient.alert_types as ('low_stock' | 'out_of_stock' | 'reorder' | 'expiry_warning' | 'batch_expiry')[],
      isActive: recipient.is_active ?? true,
      createdAt: new Date(recipient.created_at),
      updatedAt: new Date(recipient.updated_at)
    }))
  },

  async create(recipient: Omit<AlertRecipient, 'id' | 'createdAt' | 'updatedAt'>): Promise<AlertRecipient> {
    const { data, error } = await supabase
      .from('alert_recipients')
      .insert({
        name: recipient.name,
        email: recipient.email,
        phone: recipient.phone,
        role: recipient.role,
        alert_types: recipient.alertTypes,
        is_active: recipient.isActive
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      email: data.email || undefined,
      phone: data.phone || undefined,
      role: data.role as 'admin' | 'manager' | 'cashier',
      alertTypes: data.alert_types as ('low_stock' | 'out_of_stock' | 'reorder' | 'expiry_warning' | 'batch_expiry')[],
      isActive: data.is_active ?? true,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  },

  async update(id: string, recipient: Partial<AlertRecipient>): Promise<AlertRecipient> {
    const { data, error } = await supabase
      .from('alert_recipients')
      .update({
        name: recipient.name,
        email: recipient.email,
        phone: recipient.phone,
        role: recipient.role,
        alert_types: recipient.alertTypes,
        is_active: recipient.isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      email: data.email || undefined,
      phone: data.phone || undefined,
      role: data.role as 'admin' | 'manager' | 'cashier',
      alertTypes: data.alert_types as ('low_stock' | 'out_of_stock' | 'reorder' | 'expiry_warning' | 'batch_expiry')[],
      isActive: data.is_active ?? true,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('alert_recipients')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

// Alert Templates Service
export const alertTemplatesService = {
  async getAll(): Promise<AlertTemplate[]> {
    const { data, error } = await supabase
      .from('alert_templates')
      .select('*')
      .order('name')

    if (error) throw error

    return data.map(template => ({
      id: template.id,
      name: template.name,
      type: template.type as 'low_stock' | 'out_of_stock' | 'reorder' | 'expiry_warning' | 'batch_expiry',
      channel: template.channel as 'email' | 'sms' | 'both',
      subject: template.subject || undefined,
      body: template.body,
      isActive: template.is_active ?? true,
      createdAt: new Date(template.created_at),
      updatedAt: new Date(template.updated_at)
    }))
  },

  async create(template: Omit<AlertTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<AlertTemplate> {
    const { data, error } = await supabase
      .from('alert_templates')
      .insert({
        name: template.name,
        type: template.type,
        channel: template.channel,
        subject: template.subject,
        body: template.body,
        is_active: template.isActive
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      type: data.type as 'low_stock' | 'out_of_stock' | 'reorder' | 'expiry_warning' | 'batch_expiry',
      channel: data.channel as 'email' | 'sms' | 'both',
      subject: data.subject || undefined,
      body: data.body,
      isActive: data.is_active ?? true,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  },

  async update(id: string, template: Partial<AlertTemplate>): Promise<AlertTemplate> {
    const { data, error } = await supabase
      .from('alert_templates')
      .update({
        name: template.name,
        type: template.type,
        channel: template.channel,
        subject: template.subject,
        body: template.body,
        is_active: template.isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      name: data.name,
      type: data.type as 'low_stock' | 'out_of_stock' | 'reorder' | 'expiry_warning' | 'batch_expiry',
      channel: data.channel as 'email' | 'sms' | 'both',
      subject: data.subject || undefined,
      body: data.body,
      isActive: data.is_active ?? true,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('alert_templates')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

// Alert Configurations Service
export const alertConfigurationsService = {
  async getAll(): Promise<AlertConfiguration[]> {
    const { data, error } = await supabase
      .from('alert_configurations')
      .select('*')
      .order('alert_type')

    if (error) throw error

    return data.map(config => ({
      id: config.id,
      alertType: config.alert_type as 'low_stock' | 'out_of_stock' | 'reorder' | 'expiry_warning' | 'batch_expiry',
      isEnabled: config.is_enabled ?? true,
      thresholdValue: config.threshold_value || undefined,
      checkFrequencyMinutes: config.check_frequency_minutes || 60,
      cooldownMinutes: config.cooldown_minutes || 1440,
      emailTemplateId: config.email_template_id || undefined,
      smsTemplateId: config.sms_template_id || undefined,
      createdAt: new Date(config.created_at),
      updatedAt: new Date(config.updated_at)
    }))
  },

  async update(id: string, config: Partial<AlertConfiguration>): Promise<AlertConfiguration> {
    const { data, error } = await supabase
      .from('alert_configurations')
      .update({
        alert_type: config.alertType,
        is_enabled: config.isEnabled,
        threshold_value: config.thresholdValue,
        check_frequency_minutes: config.checkFrequencyMinutes,
        cooldown_minutes: config.cooldownMinutes,
        email_template_id: config.emailTemplateId,
        sms_template_id: config.smsTemplateId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      alertType: data.alert_type as 'low_stock' | 'out_of_stock' | 'reorder' | 'expiry_warning' | 'batch_expiry',
      isEnabled: data.is_enabled ?? true,
      thresholdValue: data.threshold_value || undefined,
      checkFrequencyMinutes: data.check_frequency_minutes || 60,
      cooldownMinutes: data.cooldown_minutes || 1440,
      emailTemplateId: data.email_template_id || undefined,
      smsTemplateId: data.sms_template_id || undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  }
}

// Alert History Service
export const alertHistoryService = {
  async getAll(limit: number = 100): Promise<AlertHistory[]> {
    const { data, error } = await supabase
      .from('alert_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return data.map(history => ({
      id: history.id,
      alertType: history.alert_type as 'low_stock' | 'out_of_stock' | 'reorder' | 'expiry_warning' | 'batch_expiry',
      productId: history.product_id,
      productName: history.product_name,
      productSku: history.product_sku,
      currentStock: history.current_stock,
      minStock: history.min_stock,
      thresholdValue: history.threshold_value || undefined,
      recipientId: history.recipient_id,
      recipientName: history.recipient_name,
      recipientEmail: history.recipient_email || undefined,
      recipientPhone: history.recipient_phone || undefined,
      channel: history.channel as 'email' | 'sms',
      status: history.status as 'pending' | 'sent' | 'failed' | 'delivered',
      templateId: history.template_id || undefined,
      messageContent: history.message_content || undefined,
      errorMessage: history.error_message || undefined,
      sentAt: history.sent_at ? new Date(history.sent_at) : undefined,
      deliveredAt: history.delivered_at ? new Date(history.delivered_at) : undefined,
      createdAt: new Date(history.created_at)
    }))
  },

  async getByProduct(productId: string): Promise<AlertHistory[]> {
    const { data, error } = await supabase
      .from('alert_history')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return data.map(history => ({
      id: history.id,
      alertType: history.alert_type as 'low_stock' | 'out_of_stock' | 'reorder' | 'expiry_warning' | 'batch_expiry',
      productId: history.product_id,
      productName: history.product_name,
      productSku: history.product_sku,
      currentStock: history.current_stock,
      minStock: history.min_stock,
      thresholdValue: history.threshold_value || undefined,
      recipientId: history.recipient_id,
      recipientName: history.recipient_name,
      recipientEmail: history.recipient_email || undefined,
      recipientPhone: history.recipient_phone || undefined,
      channel: history.channel as 'email' | 'sms',
      status: history.status as 'pending' | 'sent' | 'failed' | 'delivered',
      templateId: history.template_id || undefined,
      messageContent: history.message_content || undefined,
      errorMessage: history.error_message || undefined,
      sentAt: history.sent_at ? new Date(history.sent_at) : undefined,
      deliveredAt: history.delivered_at ? new Date(history.delivered_at) : undefined,
      createdAt: new Date(history.created_at)
    }))
  }
}

// Notification Service Config Service
export const notificationServiceConfigService = {
  async getAll(): Promise<NotificationServiceConfig[]> {
    const { data, error } = await supabase
      .from('notification_service_config')
      .select('*')
      .order('service_name')

    if (error) throw error

    return data.map(config => ({
      id: config.id,
      serviceName: config.service_name,
      serviceType: config.service_type as 'email' | 'sms' | 'both',
      configData: config.config_data,
      isActive: config.is_active ?? true,
      isDefault: config.is_default ?? false,
      createdAt: new Date(config.created_at),
      updatedAt: new Date(config.updated_at)
    }))
  },

  async create(config: Omit<NotificationServiceConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationServiceConfig> {
    const { data, error } = await supabase
      .from('notification_service_config')
      .insert({
        service_name: config.serviceName,
        service_type: config.serviceType,
        config_data: config.configData,
        is_active: config.isActive,
        is_default: config.isDefault
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      serviceName: data.service_name,
      serviceType: data.service_type as 'email' | 'sms' | 'both',
      configData: data.config_data,
      isActive: data.is_active ?? true,
      isDefault: data.is_default ?? false,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  },

  async update(id: string, config: Partial<NotificationServiceConfig>): Promise<NotificationServiceConfig> {
    const { data, error } = await supabase
      .from('notification_service_config')
      .update({
        service_name: config.serviceName,
        service_type: config.serviceType,
        config_data: config.configData,
        is_active: config.isActive,
        is_default: config.isDefault,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      serviceName: data.service_name,
      serviceType: data.service_type as 'email' | 'sms' | 'both',
      configData: data.config_data,
      isActive: data.is_active ?? true,
      isDefault: data.is_default ?? false,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('notification_service_config')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}

// ============================================================
// Suppliers Service (EXPANDED ERP fields)
// ============================================================
export const suppliersService = {
  async getAll(): Promise<Supplier[]> {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name')

    if (error) throw error

    return data.map(s => ({
      id: s.id,
      name: s.name,
      contactPerson: s.contact_person,
      email: s.email || '',
      phone: s.phone || '',
      phone2: s.phone2,
      address: s.address || '',
      taxId: s.tax_id,
      bankDetails: s.bank_details as any,
      website: s.website,
      paymentTerms: s.payment_terms,
      rating: s.rating || 5,
      totalPurchases: s.total_purchases || 0,
      outstandingBalance: s.outstanding_balance || 0,
      notes: s.notes,
      active: s.active ?? true,
      createdAt: new Date(s.created_at),
      updatedAt: new Date(s.updated_at),
    }))
  },

  async create(supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Promise<Supplier> {
    const { data, error } = await supabase
      .from('suppliers')
      .insert({
        name: supplier.name,
        contact_person: supplier.contactPerson,
        email: supplier.email,
        phone: supplier.phone,
        phone2: supplier.phone2,
        address: supplier.address,
        tax_id: supplier.taxId,
        bank_details: supplier.bankDetails,
        website: supplier.website,
        payment_terms: supplier.paymentTerms,
        rating: supplier.rating,
        total_purchases: supplier.totalPurchases,
        outstanding_balance: supplier.outstandingBalance,
        notes: supplier.notes,
        active: supplier.active,
      })
      .select()
      .single()

    if (error) throw error
    return this.getById(data.id)
  },

  async update(id: string, s: Partial<Supplier>): Promise<Supplier> {
    const { data, error } = await supabase
      .from('suppliers')
      .update({
        name: s.name,
        contact_person: s.contactPerson,
        email: s.email,
        phone: s.phone,
        phone2: s.phone2,
        address: s.address,
        tax_id: s.taxId,
        bank_details: s.bankDetails,
        website: s.website,
        payment_terms: s.paymentTerms,
        rating: s.rating,
        total_purchases: s.totalPurchases,
        outstanding_balance: s.outstandingBalance,
        notes: s.notes,
        active: s.active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return this.getById(data.id)
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('suppliers').delete().eq('id', id)
    if (error) throw error
  },

  async getById(id: string): Promise<Supplier> {
    const { data, error } = await supabase.from('suppliers').select('*').eq('id', id).single()
    if (error) throw error
    return {
      id: data.id,
      name: data.name,
      contactPerson: data.contact_person,
      email: data.email || '',
      phone: data.phone || '',
      phone2: data.phone2,
      address: data.address || '',
      taxId: data.tax_id,
      bankDetails: data.bank_details as any,
      website: data.website,
      paymentTerms: data.payment_terms,
      rating: data.rating || 5,
      totalPurchases: data.total_purchases || 0,
      outstandingBalance: data.outstanding_balance || 0,
      notes: data.notes,
      active: data.active ?? true,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    }
  },
}

// ============================================================
// Expenses Service
// ============================================================
export const expensesService = {
  async getAll(): Promise<Expense[]> {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false })

    if (error) throw error

    return data.map(e => ({
      id: e.id,
      category: e.category_name as any,
      subcategory: e.subcategory,
      description: e.description ?? '',
      amount: e.amount || 0,
      currency: e.currency,
      date: new Date(e.date),
      paymentMethod: e.payment_method as any,
      supplierId: e.supplier_id,
      referenceNumber: e.reference_number,
      receiptNumber: e.receipt_number,
      notes: e.notes,
      attachmentUrl: e.attachment_url,
      status: (e.status as any) || 'approved',
      createdBy: e.created_by,
      createdAt: new Date(e.created_at),
      updatedAt: new Date(e.updated_at),
    }))
  },

  async create(expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>): Promise<Expense> {
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        category_name: expense.category,
        subcategory: expense.subcategory,
        description: expense.description,
        amount: expense.amount,
        currency: expense.currency,
        date: expense.date instanceof Date ? expense.date.toISOString().split('T')[0] : expense.date,
        payment_method: expense.paymentMethod,
        supplier_id: expense.supplierId,
        reference_number: expense.referenceNumber,
        receipt_number: expense.receiptNumber,
        notes: expense.notes,
        attachment_url: expense.attachmentUrl,
        status: expense.status,
        created_by: expense.createdBy,
      })
      .select()
      .single()
    if (error) throw error
    const list = await this.getAll()
    return list.find(r => r.id === data.id) as Expense
  },

  async update(id: string, expense: Partial<Expense>): Promise<Expense> {
    const { data, error } = await supabase
      .from('expenses')
      .update({
        category_name: expense.category,
        subcategory: expense.subcategory,
        description: expense.description,
        amount: expense.amount,
        currency: expense.currency,
        date: expense.date instanceof Date ? expense.date.toISOString().split('T')[0] : expense.date,
        payment_method: expense.paymentMethod,
        supplier_id: expense.supplierId,
        reference_number: expense.referenceNumber,
        receipt_number: expense.receiptNumber,
        notes: expense.notes,
        attachment_url: expense.attachmentUrl,
        status: expense.status,
        created_by: expense.createdBy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    const list = await this.getAll()
    return list.find(r => r.id === id) as Expense
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) throw error
  },
}

// ============================================================
// Inventory Helpers
// ============================================================
async function restockInventory(items: ReturnItem[] | RentalItem[]): Promise<void> {
  for (const item of items) {
    const productId = (item as any).productId || (item as any).product_id
    const qty = Number(item.quantity || 0)
    if (!productId || productId.startsWith('custom-') || qty <= 0) continue
    try {
      const { error } = await supabase.rpc('increment_product_stock', {
        p_id: productId,
        p_amount: qty
      }) as any
      // If RPC doesn't exist (not defined yet), fall back to direct update
      if (error) {
        const { data: curr } = await supabase
          .from('products')
          .select('stock')
          .eq('id', productId)
          .limit(1)
          .maybeSingle()
        if (curr) {
          const newStock = Number(curr.stock || 0) + qty
          await supabase.from('products').update({ stock: newStock }).eq('id', productId)
        }
      }
    } catch (err) {
      console.warn(`Restock skipped for product ${productId}:`, err)
    }
  }
}

// ============================================================
// Product Returns Service
// ============================================================
export const returnsService = {
  async getAll(): Promise<ProductReturn[]> {
    const { data, error } = await supabase
      .from('product_returns')
      .select(`*, return_items (*)`)
      .order('created_at', { ascending: false })

    if (error) throw error

    return data.map(r => ({
      id: r.id,
      returnNumber: r.return_number,
      saleId: r.sale_id,
      invoiceNumber: r.invoice_number,
      customerId: r.customer_id,
      customerName: r.customer_name,
      items: (r.return_items || []).map((ri: any) => ({
        id: ri.id,
        productId: ri.product_id,
        productName: ri.product_name,
        sku: ri.sku,
        quantity: ri.quantity,
        condition: ri.condition,
        unitPrice: ri.unit_price,
        subtotal: ri.subtotal,
        taxRate: ri.tax_rate,
        taxAmount: ri.tax_amount,
        notes: ri.notes,
      })),
      status: r.status as any,
      returnMethod: r.return_method as any,
      paymentMethod: r.payment_method,
      reason: r.reason,
      notes: r.notes,
      subtotal: r.subtotal,
      taxAmount: r.tax_amount,
      totalRefund: r.total_refund,
      itemsCount: r.items_count,
      restocked: r.restocked,
      processedBy: r.processed_by,
      processedAt: r.processed_at ? new Date(r.processed_at) : undefined,
      createdBy: r.created_by,
      timestamp: new Date(r.created_at),
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
    }))
  },

  async create(ret: Omit<ProductReturn, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductReturn> {
    const isRentalReturn = ret.returnMethod === 'rental_return'
    const normalized = {
      ...ret,
      subtotal: isRentalReturn ? 0 : ret.subtotal,
      taxAmount: isRentalReturn ? 0 : ret.taxAmount,
      totalRefund: isRentalReturn ? 0 : ret.totalRefund,
      restocked: isRentalReturn ? true : !!ret.restocked,
    }

    const { data: header, error: hErr } = await supabase
      .from('product_returns')
      .insert({
        return_number: normalized.returnNumber,
        sale_id: normalized.saleId,
        invoice_number: normalized.invoiceNumber,
        customer_id: normalized.customerId,
        customer_name: normalized.customerName,
        status: normalized.status,
        return_method: normalized.returnMethod,
        payment_method: normalized.paymentMethod,
        reason: normalized.reason,
        notes: normalized.notes,
        subtotal: normalized.subtotal,
        tax_amount: normalized.taxAmount,
        total_refund: normalized.totalRefund,
        items_count: normalized.itemsCount,
        restocked: normalized.restocked,
        processed_by: normalized.processedBy,
        processed_at: normalized.processedAt?.toISOString(),
        created_by: normalized.createdBy,
      })
      .select()
      .single()
    if (hErr) throw hErr

    if (normalized.items && normalized.items.length > 0) {
      const rows = normalized.items.map(i => ({
        return_id: header.id,
        product_id: i.productId,
        product_name: i.productName,
        sku: i.sku,
        quantity: i.quantity,
        condition: i.condition,
        unit_price: i.unitPrice,
        subtotal: i.subtotal,
        tax_rate: i.taxRate,
        tax_amount: i.taxAmount,
        notes: i.notes,
      }))
      const { error: riErr } = await supabase.from('return_items').insert(rows)
      if (riErr) throw riErr
    }

    if (normalized.restocked && normalized.items) {
      await restockInventory(normalized.items)
    }

    const list = await this.getAll()
    return list.find(r => r.id === header.id) as ProductReturn
  },

  async update(id: string, ret: Partial<ProductReturn>): Promise<ProductReturn> {
    const isRentalReturn = ret.returnMethod === 'rental_return'
    const normalized: Partial<ProductReturn> = {
      ...ret,
    }
    if (isRentalReturn) {
      normalized.subtotal = 0
      normalized.taxAmount = 0
      normalized.totalRefund = 0
      normalized.restocked = true
    }

    const { data: header, error: hErr } = await supabase
      .from('product_returns')
      .update({
        status: normalized.status,
        return_method: normalized.returnMethod,
        payment_method: normalized.paymentMethod,
        reason: normalized.reason,
        notes: normalized.notes,
        subtotal: normalized.subtotal,
        tax_amount: normalized.taxAmount,
        total_refund: normalized.totalRefund,
        items_count: normalized.itemsCount,
        restocked: normalized.restocked,
        processed_by: normalized.processedBy,
        processed_at: normalized.processedAt?.toISOString(),
        created_by: normalized.createdBy,
      })
      .eq('id', id)
      .select()
      .single()
    if (hErr) throw hErr

    if (normalized.items) {
      await supabase.from('return_items').delete().eq('return_id', id)
      if (normalized.items.length > 0) {
        const rows = normalized.items.map(i => ({
          return_id: id,
          product_id: i.productId,
          product_name: i.productName,
          sku: i.sku,
          quantity: i.quantity,
          condition: i.condition,
          unit_price: i.unitPrice,
          subtotal: i.subtotal,
          tax_rate: i.taxRate,
          tax_amount: i.taxAmount,
          notes: i.notes,
        }))
        const { error: riErr } = await supabase.from('return_items').insert(rows)
        if (riErr) throw riErr
      }
    }

    if (normalized.restocked && normalized.items) {
      await restockInventory(normalized.items)
    }

    const list = await this.getAll()
    return list.find(r => r.id === id) as ProductReturn
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('product_returns').delete().eq('id', id)
    if (error) throw error
  },
}

// ============================================================
// Outstanding Payments Service
// ============================================================
export const outstandingPaymentsService = {
  async getAll(): Promise<OutstandingPayment[]> {
    const { data, error } = await supabase
      .from('outstanding_payments')
      .select(`*, payment_records (*)`)
      .order('due_date', { ascending: true })

    if (error) throw error

    return data.map(op => ({
      id: op.id,
      customerId: op.customer_id,
      customerName: op.customer_name,
      saleId: op.sale_id,
      invoiceNumber: op.invoice_number,
      totalAmount: op.total_amount,
      paidAmount: op.paid_amount,
      outstandingAmount: op.outstanding_amount,
      dueDate: new Date(op.due_date),
      issueDate: new Date(op.issue_date),
      status: op.status as any,
      paymentHistory: (op.payment_records || []).map((pr: any) => ({
        id: pr.id,
        amount: pr.amount,
        date: new Date(pr.payment_date),
        method: pr.method,
        receivedBy: pr.received_by,
        reference: pr.reference_number,
        notes: pr.notes,
      })),
      notes: op.notes,
      createdAt: new Date(op.created_at),
      updatedAt: new Date(op.updated_at),
    }))
  },

  async create(op: Omit<OutstandingPayment, 'id' | 'createdAt' | 'updatedAt'>): Promise<OutstandingPayment> {
    const { data, error } = await supabase
      .from('outstanding_payments')
      .insert({
        customer_id: op.customerId,
        customer_name: op.customerName,
        sale_id: op.saleId,
        invoice_number: op.invoiceNumber,
        total_amount: op.totalAmount,
        paid_amount: op.paidAmount,
        issue_date: op.issueDate instanceof Date ? op.issueDate.toISOString().split('T')[0] : op.issueDate,
        due_date: op.dueDate instanceof Date ? op.dueDate.toISOString().split('T')[0] : op.dueDate,
        status: op.status,
        notes: op.notes,
      })
      .select()
      .single()
    if (error) throw error
    const list = await this.getAll()
    return list.find(r => r.id === data.id) as OutstandingPayment
  },

  async addPayment(outstandingPaymentId: string, record: any): Promise<OutstandingPayment> {
    const opResp = await supabase.from('outstanding_payments').select('paid_amount, total_amount').eq('id', outstandingPaymentId).single()
    if (opResp.error) throw opResp.error
    const currentPaid = opResp.data.paid_amount
    const newPaid = currentPaid + (record.amount || 0)

    const { error: prErr } = await supabase.from('payment_records').insert({
      outstanding_payment_id: outstandingPaymentId,
      customer_id: record.customerId,
      amount: record.amount,
      currency: record.currency,
      payment_date: record.date instanceof Date ? record.date.toISOString() : record.date,
      method: record.method,
      reference_number: record.reference,
      notes: record.notes,
      received_by: record.receivedBy,
    })
    if (prErr) throw prErr

    const { data: updated, error: uErr } = await supabase
      .from('outstanding_payments')
      .update({ paid_amount: newPaid, updated_at: new Date().toISOString() })
      .eq('id', outstandingPaymentId)
      .select()
      .single()
    if (uErr) throw uErr
    const list = await this.getAll()
    return list.find(r => r.id === updated.id) as OutstandingPayment
  },

  async update(id: string, op: Partial<OutstandingPayment>): Promise<OutstandingPayment> {
    const { data, error } = await supabase
      .from('outstanding_payments')
      .update({
        customer_id: op.customerId,
        customer_name: op.customerName,
        sale_id: op.saleId,
        invoice_number: op.invoiceNumber,
        total_amount: op.totalAmount,
        paid_amount: op.paidAmount,
        issue_date: op.issueDate instanceof Date ? op.issueDate.toISOString().split('T')[0] : op.issueDate,
        due_date: op.dueDate instanceof Date ? op.dueDate.toISOString().split('T')[0] : op.dueDate,
        status: op.status,
        notes: op.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    const list = await this.getAll()
    return list.find(r => r.id === data.id) as OutstandingPayment
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('outstanding_payments').delete().eq('id', id)
    if (error) throw error
  },
}

// ============================================================
// Rentals Service
// ============================================================
export const rentalsService = {
  async getAll(): Promise<Rental[]> {
    const { data, error } = await supabase
      .from('rentals')
      .select(`*, rental_items (*)`)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map(r => ({
      id: r.id,
      rentalNumber: r.rental_number,
      customerId: r.customer_id,
      customerName: r.customer_name,
      items: (r.rental_items || []).map((ri: any) => ({
        id: ri.id,
        productId: ri.product_id,
        productName: ri.product_name,
        sku: ri.sku,
        quantity: ri.quantity,
        dailyRate: ri.daily_rate,
        subtotal: ri.subtotal,
        condition: ri.condition as any,
        notes: ri.notes,
      })),
      rentFrom: new Date(r.rent_from),
      rentTo: new Date(r.rent_to),
      dailyRate: r.daily_rate,
      weeklyRate: r.weekly_rate ?? undefined,
      securityDeposit: r.security_deposit,
      totalRent: r.total_rent,
      paidAmount: r.paid_amount,
      status: r.status as any,
      notes: r.notes,
      createdBy: r.created_by,
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
    }))
  },

  async create(r: Omit<Rental, 'id' | 'createdAt' | 'updatedAt'>): Promise<Rental> {
    const { data: header, error: hErr } = await supabase
      .from('rentals')
      .insert({
        rental_number: r.rentalNumber,
        customer_id: r.customerId,
        customer_name: r.customerName,
        rent_from: r.rentFrom instanceof Date ? r.rentFrom.toISOString().split('T')[0] : r.rentFrom,
        rent_to: r.rentTo instanceof Date ? r.rentTo.toISOString().split('T')[0] : r.rentTo,
        daily_rate: r.dailyRate,
        weekly_rate: r.weeklyRate,
        security_deposit: r.securityDeposit,
        total_rent: r.totalRent,
        paid_amount: r.paidAmount,
        status: r.status,
        notes: r.notes,
        created_by: r.createdBy,
      })
      .select()
      .single()
    if (hErr) throw hErr

    if (r.items && r.items.length > 0) {
      const rows = r.items.map(i => ({
        rental_id: header.id,
        product_id: i.productId,
        product_name: i.productName,
        sku: i.sku,
        quantity: i.quantity,
        daily_rate: i.dailyRate,
        subtotal: i.subtotal,
        condition: i.condition,
        notes: i.notes,
      }))
      const { error: riErr } = await supabase.from('rental_items').insert(rows)
      if (riErr) throw riErr
    }

    const list = await this.getAll()
    return list.find(x => x.id === header.id) as Rental
  },

  async update(id: string, r: Partial<Rental>): Promise<Rental> {
    const { data: header, error: hErr } = await supabase
      .from('rentals')
      .update({
        rental_number: r.rentalNumber,
        customer_id: r.customerId,
        customer_name: r.customerName,
        rent_from: r.rentFrom instanceof Date ? r.rentFrom.toISOString().split('T')[0] : r.rentFrom,
        rent_to: r.rentTo instanceof Date ? r.rentTo.toISOString().split('T')[0] : r.rentTo,
        daily_rate: r.dailyRate,
        weekly_rate: r.weeklyRate,
        security_deposit: r.securityDeposit,
        total_rent: r.totalRent,
        paid_amount: r.paidAmount,
        status: r.status,
        notes: r.notes,
        created_by: r.createdBy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()
    if (hErr) throw hErr

    if (r.items) {
      await supabase.from('rental_items').delete().eq('rental_id', id)
      if (r.items.length > 0) {
        const rows = r.items.map(i => ({
          rental_id: id,
          product_id: i.productId,
          product_name: i.productName,
          sku: i.sku,
          quantity: i.quantity,
          daily_rate: i.dailyRate,
          subtotal: i.subtotal,
          condition: i.condition,
          notes: i.notes,
        }))
        const { error: riErr } = await supabase.from('rental_items').insert(rows)
        if (riErr) throw riErr
      }
    }

    const list = await this.getAll()
    return list.find(x => x.id === id) as Rental
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('rentals').delete().eq('id', id)
    if (error) throw error
  },
}

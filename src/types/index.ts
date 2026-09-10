export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  category: string;
  description: string;
  image?: string;
  taxable: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  // New fields for advanced features
  isWeightBased?: boolean;
  pricePerUnit?: number; // For weight-based pricing (per kg, per lb, etc.)
  unit?: string; // kg, lb, piece, etc.
  batches?: ProductBatch[];
  trackInventory?: boolean; // Whether to track and manage inventory for this product
}

export interface ProductBatch {
  id: string;
  batchNumber: string;
  manufacturingDate: Date;
  expiryDate: Date;
  quantity: number;
  costPrice: number;
  supplierInfo?: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  creditLimit: number;
  creditUsed: number;
  priceTier: string;
  totalPurchases: number;
  lastPurchase?: Date;
  createdAt: Date;
}

export interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  paymentTerms: string;
  rating: number;
  createdAt: Date;
  contactPerson?: string;
  phone2?: string;
  website?: string;
  bankDetails?: Record<string, any> | string;
  taxId?: string;
  notes?: string;
  totalPurchases?: number;
  outstandingBalance?: number;
  updatedAt?: Date;
  active?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
  weight?: number; // For weight-based products
  discount: number;
  discountType: 'percentage' | 'fixed';
  subtotal: number;
  batchId?: string; // For batch tracking
}

export interface Discount {
  id: string;
  name: string;
  description: string;
  type: 'percentage' | 'fixed' | 'bogo' | 'free_gift';
  value: number;
  conditions: DiscountCondition[];
  freeGiftProducts?: string[]; // Product IDs for free gifts
  minAmount?: number;
  maxDiscount?: number;
  validFrom: Date;
  validTo: Date;
  validDays?: number[]; // 0-6 (Sunday-Saturday)
  active: boolean;
  createdAt: Date;
}

export interface DiscountCondition {
  type: 'min_amount' | 'specific_products' | 'payment_method' | 'customer_tier' | 'card_type' | 'bank_name';
  value: any;
  operator?: 'equals' | 'greater_than' | 'less_than' | 'in_array';
  minQuantity?: number; // For specific_products condition - minimum quantity required
}

export interface CardDetails {
  id: string;
  bankName: string;
  cardType: 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown';
  cardNumber: string;
  lastFourDigits: string;
  holderName: string;
}

export interface Payment {
  id: string;
  method: 'cash' | 'card' | 'digital' | 'credit';
  amount: number;
  cardDetails?: CardDetails;
  notes?: string;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  customerId?: string;
  customerName?: string;
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  // allow split payments; keep legacy single-method field
  paymentMethod: 'cash' | 'card' | 'digital' | 'credit' | 'split';
  // when split payments used, payments contains breakdown
  payments?: Payment[];
  cardDetails?: CardDetails;
  status: 'pending' | 'completed' | 'refunded' | 'credit' | 'draft';
  cashier: string;
  timestamp: Date;
  receiptNumber: string;
  notes?: string;
  appliedDiscounts?: AppliedDiscount[];
  freeGifts?: CartItem[];
}

export interface AppliedDiscount {
  discountId: string;
  discountName: string;
  discountAmount: number;
  type: 'percentage' | 'fixed' | 'bogo' | 'free_gift';
}

export interface SalesTab {
  id: string;
  name: string;
  cart: CartItem[];
  selectedCustomer: Customer | null;
  createdAt: Date;
}

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'cashier';
  permissions: string[];
  active: boolean;
  lastLogin?: Date;
  avatar?: string;
}

export interface AppSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeEmail: string;
  storeLogo?: string;
  taxRate: number;
  currency: string;
  baseCurrency: string; // Base currency for pricing
  interfaceMode: 'touch' | 'traditional';
  autoBackup: boolean;
  receiptPrinter: boolean;
  theme: 'light' | 'dark' | 'auto';
  invoicePrefix: string;
  invoiceCounter: number;
  exchangeRateProvider?: 'fixer' | 'currencylayer' | 'exchangerate' | 'manual';
  exchangeRateApiKey?: string;
  exchangeRateUpdateInterval?: number; // in minutes
  // Optional feature toggles
  featureToggles?: FeatureToggles;
}

export interface FeatureToggles {
  transactionDelete: boolean;
  productReturns: boolean;
  outstandingPayments: boolean;
  productDiscount: boolean;
  expenseTracking: boolean;
  supplierManagement: boolean;
  alertMonitoring: boolean;
  productRentals: boolean;
}

export interface Expense {
  id: string;
  category: string;
  subcategory?: string;
  description: string;
  amount: number;
  currency?: string;
  date: Date;
  paymentMethod: 'cash' | 'card' | 'digital' | 'bank_transfer' | 'check' | 'digital_wallet' | 'other';
  receiptNumber?: string;
  referenceNumber?: string;
  supplierId?: string;
  supplierName?: string;
  status?: 'pending' | 'approved' | 'reimbursed' | 'archived';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  attachmentUrl?: string;
  attachments?: string[];
}

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  budget?: number;
}

export interface ProductReturn {
  id: string;
  saleId: string;
  invoiceNumber: string;
  customerId?: string;
  customerName?: string;
  returnNumber?: string;
  itemsCount?: number;
  items: ReturnItem[];
  subtotal: number;
  taxAmount: number;
  totalRefund: number;
  reason: string;
  returnMethod: 'refund' | 'exchange' | 'store_credit' | 'rental_return';
  paymentMethod?: string;
  status: 'pending' | 'approved' | 'completed' | 'rejected' | 'exchanged';
  processedBy: string;
  processedAt?: Date;
  restocked?: boolean;
  createdBy?: string;
  timestamp: Date;
  createdAt?: Date;
  notes?: string;
}

export interface ReturnItem {
  id?: string;
  productId: string;
  productName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  reason?: string;
  condition: 'new' | 'unused' | 'opened' | 'used' | 'damaged' | 'defective' | 'missing_parts';
  notes?: string;
}

export interface OutstandingPayment {
  id: string;
  customerId: string;
  customerName: string;
  saleId: string;
  invoiceNumber: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  dueDate: Date;
  issueDate: Date;
  status: 'pending' | 'overdue' | 'partial' | 'paid';
  paymentHistory: PaymentRecord[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  date: Date;
  method: 'cash' | 'card' | 'digital' | 'bank_transfer' | 'check' | 'digital_wallet' | 'other';
  currency?: string;
  receiptUrl?: string;
  reference?: string;
  receivedBy: string;
  notes?: string;
}

// ===== Rental Management =====
export type RentalStatus = 'active' | 'overdue' | 'returned' | 'lost' | 'damaged';

export interface RentalItem {
  id?: string;
  productId: string;
  productName: string;
  sku?: string;
  quantity: number;
  dailyRate: number;
  subtotal: number;
  condition?: 'new' | 'unused' | 'opened' | 'used' | 'damaged' | 'defective' | 'missing_parts';
  notes?: string;
}

export interface Rental {
  id: string;
  rentalNumber: string;
  customerId?: string;
  customerName?: string;
  items: RentalItem[];
  rentFrom: Date;
  rentTo: Date;
  dailyRate: number;
  weeklyRate?: number;
  securityDeposit: number;
  totalRent: number;
  paidAmount: number;
  status: RentalStatus;
  notes?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

// Currency-related interfaces
export interface CurrencyConfig {
  id: string;
  code: string;
  name: string;
  symbol: string;
  symbolPosition: 'before' | 'after';
  decimalPlaces: number;
  isActive: boolean;
  isBaseCurrency: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExchangeRate {
  id: string;
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  source: 'api' | 'manual' | 'fallback';
  isManualOverride: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExchangeRateHistory {
  id: string;
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  previousRate?: number;
  changePercentage?: number;
  source: 'api' | 'manual' | 'fallback';
  isManualOverride: boolean;
  recordedAt: Date;
}

export interface CurrencyConversion {
  originalAmount: number;
  convertedAmount: number;
  fromCurrency: string;
  toCurrency: string;
  exchangeRate: number;
  timestamp: Date;
}

// Enhanced Sale interface with currency support
export interface SaleWithCurrency extends Sale {
  transactionCurrency: string;
  baseCurrencyAmount?: number;
  exchangeRateUsed?: number;
}

// Inventory Alert System Types
export interface AlertRecipient {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: 'admin' | 'manager' | 'cashier';
  alertTypes: AlertType[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertTemplate {
  id: string;
  name: string;
  type: AlertType;
  channel: 'email' | 'sms' | 'both';
  subject?: string;
  body: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertConfiguration {
  id: string;
  alertType: AlertType;
  isEnabled: boolean;
  thresholdValue?: number; // percentage of min_stock for low_stock alerts
  checkFrequencyMinutes: number;
  cooldownMinutes: number;
  emailTemplateId?: string;
  smsTemplateId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertHistory {
  id: string;
  alertType: AlertType;
  productId: string;
  productName: string;
  productSku: string;
  currentStock: number;
  minStock: number;
  thresholdValue?: number;
  recipientId: string;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  channel: 'email' | 'sms';
  status: 'pending' | 'sent' | 'failed' | 'delivered';
  templateId?: string;
  messageContent?: string;
  errorMessage?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
}

export interface AlertSchedule {
  id: string;
  alertType: AlertType;
  isActive: boolean;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationServiceConfig {
  id: string;
  serviceName: string; // sendgrid, twilio, aws_ses, etc.
  serviceType: 'email' | 'sms' | 'both';
  configData: Record<string, any>; // API keys, endpoints, etc.
  isActive: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type AlertType = 'low_stock' | 'out_of_stock' | 'reorder' | 'expiry_warning' | 'batch_expiry';

export interface InventoryAlert {
  alertType: AlertType;
  productId: string;
  productName: string;
  productSku: string;
  currentStock: number;
  minStock: number;
  thresholdValue?: number;
}

export interface AlertContext {
  product: Product;
  recipient: AlertRecipient;
  template: AlertTemplate;
  configuration: AlertConfiguration;
}

export interface ProcessedAlert {
  alert: InventoryAlert;
  recipients: AlertRecipient[];
  shouldSend: boolean;
  reason?: string;
}
import { useState, useMemo } from 'react';
import { Search, Download, Eye, RefreshCw, CreditCard, Banknote, Smartphone, Receipt, FileText, X, ShoppingCart, Trash2, RotateCcw, Edit2, Plus, Minus, AlertTriangle, Save, Printer, CalendarRange } from 'lucide-react';
import { useApp, useFeatureToggles } from '../../context/SupabaseAppContext';
import { useAuth } from '../../context/AuthContext';
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek } from 'date-fns';
import { Sale, CartItem } from '../../types';
import { CheckoutModal } from '../pos/CheckoutModal';
import { ReturnModal } from '../returns/ReturnModal';
import { salesService, productsService, customersService, returnsService } from '../../lib/services';
import { swalConfig } from '../../lib/sweetAlert';
import { matchesAnyField, sortBySearchRelevance } from '../../lib/searchUtils';
import { TablePrintModal, PrintColumn, PrintSummary, PrintFilterInfo } from '../ui/TablePrintModal';

const isDraftSale = (sale: Sale) => {
  return sale.invoiceNumber.startsWith('DRAFT-') || 
         sale.notes?.includes('Draft sale') || 
         sale.notes?.includes('DRAFT_SALE');
};

interface EditableCartItem extends CartItem {
  _tempQty?: number;
  _tempDiscount?: number;
  _removed?: boolean;
}

function buildStockImpact(sale: Sale, currency: string) {
  const items: { productId: string; productName: string; qty: number; unit: string }[] = [];
  let totalRestockQty = 0;
  for (const ci of sale.items) {
    const anyCi: any = ci;
    const p = anyCi.product || {};
    const pid = p.id || anyCi.productId;
    const pname = p.name || anyCi.productName || 'Unknown';
    const unit = p.unit || '';
    const qty: number = Number(ci.weight || ci.quantity || 0);
    if (pid && !String(pid).startsWith('custom-')) {
      items.push({ productId: pid, productName: pname, qty, unit });
      totalRestockQty += qty;
    }
  }
  const summaryLines = items.slice(0, 8).map(it =>
    `• ${it.productName}: +${it.qty}${it.unit || ''} back to stock`
  );
  if (items.length > 8) summaryLines.push(`• ... +${items.length - 8} more items`);
  const summary = summaryLines.join('\n');
  return { items, totalRestockQty, summary, currency };
}

export function TransactionsManager() {
  const { state, dispatch } = useApp();
  const features = useFeatureToggles();
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [datePreset, setDatePreset] = useState('all');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Sale | null>(null);

  const canDelete = features.transactionDelete && (profile?.role === 'admin' || profile?.role === 'manager');
  const canReturn = features.productReturns && (profile?.role === 'admin' || profile?.role === 'manager');
  const canEdit = (profile?.role === 'admin' || profile?.role === 'manager');

  const restockSaleItems = async (sale: Sale): Promise<void> => {
    for (const ci of sale.items) {
      const anyCi: any = ci;
      const p = anyCi.product || {};
      const pid = p.id || anyCi.productId;
      if (!pid || String(pid).startsWith('custom-')) continue;
      const qty: number = Number(ci.weight || ci.quantity || 0);
      if (qty <= 0) continue;
      const product = state.products.find(pr => pr.id === pid);
      if (!product || !product.trackInventory) continue;
      const currentStock = Number(product.stock || 0);
      const updated: any = {
        ...product,
        stock: currentStock + qty,
        updatedAt: new Date(),
      };
      try {
        await productsService.update(pid, updated);
      } catch (e) {
      }
      dispatch({ type: 'UPDATE_PRODUCT', payload: updated });
    }
  };

  const revertCustomerStatsOnDelete = async (sale: Sale) => {
    if (!sale.customerId) return;
    const customer = state.customers.find(c => c.id === sale.customerId);
    if (!customer) return;
    const updatePatch: any = {
      totalPurchases: Math.max(0, Number(customer.totalPurchases || 0) - Number(sale.total || 0)),
    };
    if (sale.paymentMethod === 'credit' || sale.status === 'credit') {
      updatePatch.creditUsed = Math.max(0, Number(customer.creditUsed || 0) - Number(sale.total || 0));
    }
    const updated: any = { ...customer, ...updatePatch };
    try {
      await customersService.update(customer.id, updated);
    } catch (e) {
    }
    dispatch({ type: 'UPDATE_CUSTOMER', payload: updated });
  };

  const handleDeleteTransaction = async (sale: Sale) => {
    if (!canDelete) {
      swalConfig.error('You do not have permission to delete transactions.');
      return;
    }
    if (isDraftSale(sale)) {
      const result = await swalConfig.confirm(
        'Delete Draft Transaction?',
        `Delete draft ${sale.invoiceNumber}? Drafts do not affect inventory.`,
        'Delete Draft'
      );
      if (!result.isConfirmed) return;
      try {
        swalConfig.loading('Deleting draft...');
        try { await salesService.delete(sale.id); } catch (e) {}
        dispatch({ type: 'DELETE_SALE', payload: sale.id });
        setSelectedTransaction(null);
        swalConfig.close();
        swalConfig.success('Draft deleted successfully.');
      } catch (e: any) {
        console.error(e);
        swalConfig.close();
        swalConfig.error('Failed to delete: ' + (e.message || 'Unknown error'));
      }
      return;
    }

    const impact = buildStockImpact(sale, state.settings.currency);
    let warningText = `⚠️  WARNING: This action CANNOT be undone!\n\n`;
    warningText += `Invoice: ${sale.invoiceNumber}\n`;
    warningText += `Customer: ${sale.customerName || 'Walk-in'}\n`;
    warningText += `Total: ${state.settings.currency} ${sale.total.toFixed(2)}\n\n`;
    if (impact.items.length > 0) {
      warningText += `📦 INVENTORY IMPACT (RESTOCK):\n${impact.summary}\n\n`;
    } else {
      warningText += `📦 No trackable inventory items to restock.\n\n`;
    }
    if (sale.paymentMethod === 'credit' || sale.status === 'credit') {
      warningText += `💳 CREDIT IMPACT:\n`;
      warningText += `• Customer credit used will be reduced by ${state.settings.currency} ${sale.total.toFixed(2)}\n\n`;
    }
    warningText += `Are you absolutely sure you want to permanently DELETE this transaction?`;

    const result = await swalConfig.confirm(
      '⚠️  PERMANENTLY DELETE TRANSACTION?',
      warningText,
      'Yes, Delete Permanently'
    );
    if (!result.isConfirmed) return;
    try {
      swalConfig.loading('Restocking inventory & deleting transaction...');
      await restockSaleItems(sale);
      await revertCustomerStatsOnDelete(sale);
      try {
        await salesService.delete(sale.id);
      } catch (e) {
      }
      dispatch({ type: 'DELETE_SALE', payload: sale.id });
      setSelectedTransaction(null);
      swalConfig.close();
      swalConfig.success(
        `Transaction deleted. ${impact.items.length > 0
          ? ` ${impact.totalRestockQty} units restocked across ${impact.items.length} item(s).`
          : ''
        }`
      );
    } catch (e: any) {
      console.error(e);
      swalConfig.close();
      swalConfig.error('Failed to delete transaction: ' + (e.message || 'Unknown error'));
    }
  };

  const filteredTransactions = useMemo(() => {
    const result = state.sales.filter(sale => {
      const matchesSearch = matchesAnyField(
        [
          sale.invoiceNumber,
          sale.receiptNumber,
          sale.customerName,
          sale.cashier,
          sale.notes,
          ...(sale.items?.map(i => (i as any).productName || (i.product as any)?.name) || []),
        ],
        searchTerm
      );
      const saleStatus = isDraftSale(sale) ? 'draft' : sale.status;
      const matchesStatus = statusFilter === 'all' || saleStatus === statusFilter;
      const matchesPayment = paymentFilter === 'all' ||
        sale.paymentMethod === paymentFilter ||
        (sale.payments && sale.payments.some(p => p.method === paymentFilter));
      let matchesDate = true;
      const saleDate = new Date(sale.timestamp);
      if (datePreset === 'custom') {
        if (customFromDate) {
          const from = new Date(customFromDate);
          from.setHours(0, 0, 0, 0);
          matchesDate = matchesDate && saleDate >= from;
        }
        if (customToDate) {
          const to = new Date(customToDate);
          to.setHours(23, 59, 59, 999);
          matchesDate = matchesDate && saleDate <= to;
        }
      } else if (datePreset !== 'all') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        switch (datePreset) {
          case 'today': {
            const todayStart = new Date(today);
            const todayEnd = new Date(today);
            todayEnd.setHours(23, 59, 59, 999);
            matchesDate = saleDate >= todayStart && saleDate <= todayEnd;
            break;
          }
          case 'week': {
            const weekStart = startOfWeek(today, { weekStartsOn: 1 });
            const weekEnd = new Date();
            weekEnd.setHours(23, 59, 59, 999);
            matchesDate = saleDate >= weekStart && saleDate <= weekEnd;
            break;
          }
          case 'month': {
            const mStart = startOfMonth(today);
            const mEnd = endOfMonth(today);
            matchesDate = saleDate >= mStart && saleDate <= mEnd;
            break;
          }
          case 'last_month': {
            const last = subMonths(today, 1);
            matchesDate = saleDate >= startOfMonth(last) && saleDate <= endOfMonth(last);
            break;
          }
          case 'last_3_months': {
            const threeAgo = subMonths(today, 3);
            const nowEnd = new Date();
            nowEnd.setHours(23, 59, 59, 999);
            matchesDate = saleDate >= startOfMonth(threeAgo) && saleDate <= nowEnd;
            break;
          }
          case 'year': {
            const yearStart = new Date(today.getFullYear(), 0, 1);
            const yearEnd = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
            matchesDate = saleDate >= yearStart && saleDate <= yearEnd;
            break;
          }
        }
      }
      return matchesSearch && matchesStatus && matchesPayment && matchesDate;
    });
    const sorted = sortBySearchRelevance(
      result,
      searchTerm,
      s => `${s.invoiceNumber} ${s.receiptNumber || ''} ${s.customerName || ''} ${s.cashier || ''}`
    );
    if (!searchTerm) {
      return sorted.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    return sorted;
  }, [state.sales, searchTerm, statusFilter, paymentFilter, datePreset, customFromDate, customToDate]);

  const totalRevenue = filteredTransactions.reduce((sum, sale) => sum + sale.total, 0);
  const totalTransactions = filteredTransactions.length;
  const averageTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'cash': return <Banknote className="h-4 w-4" />;
      case 'card': return <CreditCard className="h-4 w-4" />;
      case 'digital': return <Smartphone className="h-4 w-4" />;
      case 'credit': return <Receipt className="h-4 w-4" />;
      default: return <CreditCard className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'refunded': return 'bg-red-100 text-red-800';
      case 'credit': return 'bg-blue-100 text-blue-800';
      case 'draft': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const exportTransactions = () => {
    const csvContent = [
      ['Receipt #', 'Date', 'Customer', 'Items', 'Total', 'Payment', 'Status', 'Cashier'].join(','),
      ...filteredTransactions.map(sale => [
        sale.receiptNumber ?? '',
        format(new Date(sale.timestamp), 'yyyy-MM-dd HH:mm'),
        sale.customerName || 'Walk-in',
        sale.items.length,
        sale.total.toFixed(2),
        sale.paymentMethod,
        sale.status,
        sale.cashier ?? ''
      ].join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const printColumns: PrintColumn<Sale>[] = [
    {
      key: 'receipt',
      header: 'Receipt #',
      accessor: (s) => `#${s.receiptNumber ?? 'N/A'}`,
      width: '12%',
    },
    {
      key: 'date',
      header: 'Date & Time',
      accessor: (s) => format(new Date(s.timestamp), 'yyyy-MM-dd HH:mm'),
      width: '15%',
    },
    {
      key: 'customer',
      header: 'Customer',
      accessor: (s) => s.customerName || 'Walk-in',
      width: '18%',
    },
    {
      key: 'items',
      header: 'Items',
      accessor: (s) => `${s.items.length} item${s.items.length !== 1 ? 's' : ''}`,
      width: '8%',
      align: 'center',
    },
    {
      key: 'subtotal',
      header: 'Subtotal',
      accessor: (s) => `${state.settings.currency} ${Number(s.subtotal || s.total).toFixed(2)}`,
      width: '11%',
      align: 'right',
    },
    {
      key: 'discount',
      header: 'Discount',
      accessor: (s) => Number(s.discountAmount || 0) > 0 ? `-${state.settings.currency} ${Number(s.discountAmount || 0).toFixed(2)}` : '-',
      width: '10%',
      align: 'right',
    },
    {
      key: 'total',
      header: 'Total',
      accessor: (s) => `${state.settings.currency} ${s.total.toFixed(2)}`,
      width: '11%',
      align: 'right',
    },
    {
      key: 'payment',
      header: 'Payment',
      accessor: (s) => s.paymentMethod.charAt(0).toUpperCase() + s.paymentMethod.slice(1),
      width: '8%',
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (s) => isDraftSale(s) ? 'Draft' : s.status.charAt(0).toUpperCase() + s.status.slice(1),
      width: '7%',
    },
  ];

  const printSummaries: PrintSummary[] = [
    { label: 'Total Revenue', value: `${state.settings.currency} ${totalRevenue.toFixed(2)}`, highlight: true },
    { label: 'Transactions', value: String(totalTransactions) },
    { label: 'Avg. Sale', value: `${state.settings.currency} ${averageTransaction.toFixed(2)}` },
    { label: 'Currency', value: state.settings.currency },
  ];

  const getDateFilterLabel = (): string => {
    switch (datePreset) {
      case 'all': return 'All Time';
      case 'today': return 'Today';
      case 'week': return 'This Week';
      case 'month': return 'This Month';
      case 'last_month': return 'Last Month';
      case 'last_3_months': return 'Last 3 Months';
      case 'year': return 'This Year';
      case 'custom':
        if (customFromDate && customToDate) return `${customFromDate} → ${customToDate}`;
        if (customFromDate) return `From ${customFromDate}`;
        if (customToDate) return `Up to ${customToDate}`;
        return 'Custom';
      default: return 'All Time';
    }
  };

  const printFilters: PrintFilterInfo[] = [
    { label: 'Date Range', value: getDateFilterLabel() },
    ...(statusFilter !== 'all' ? [{ label: 'Status', value: statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1) }] : []),
    ...(paymentFilter !== 'all' ? [{ label: 'Payment', value: paymentFilter.charAt(0).toUpperCase() + paymentFilter.slice(1) }] : []),
    ...(searchTerm ? [{ label: 'Search', value: searchTerm }] : []),
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-600 mt-1">View and manage all sales transactions</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowPrintModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium"
          >
            <Printer className="h-4 w-4" />
            <span>Print PDF</span>
          </button>
          <button
            onClick={exportTransactions}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all font-medium shadow-lg hover:shadow-xl"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 md:p-6 rounded-2xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Revenue</p>
              <p className="text-xl md:text-2xl font-bold">{state.settings.currency} {totalRevenue.toFixed(2)}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <CreditCard className="h-6 w-6" />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-r from-green-500 to-green-600 p-4 md:p-6 rounded-2xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Total Transactions</p>
              <p className="text-xl md:text-2xl font-bold">{totalTransactions}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <Receipt className="h-6 w-6" />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-4 md:p-6 rounded-2xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Average Sale</p>
              <p className="text-xl md:text-2xl font-bold">{state.settings.currency} {averageTransaction.toFixed(2)}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <RefreshCw className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search by receipt, customer, or cashier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="credit">Credit</option>
            <option value="draft">Draft</option>
            <option value="refunded">Refunded</option>
          </select>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Payments</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="digital">Digital</option>
            <option value="credit">Credit</option>
          </select>
          <div className="md:col-span-2 lg:col-span-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <CalendarRange className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <select
                  value={datePreset}
                  onChange={(e) => setDatePreset(e.target.value)}
                  className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none text-sm"
                >
                  <option value="all">📅 All Time</option>
                  <option value="today">🗓️ Today</option>
                  <option value="week">📆 This Week</option>
                  <option value="month">📊 This Month</option>
                  <option value="last_month">📅 Last Month</option>
                  <option value="last_3_months">📈 Last 3 Months</option>
                  <option value="year">🗃️ This Year</option>
                  <option value="custom">🎯 Custom Range...</option>
                </select>
              </div>
              {datePreset === 'custom' && (
                <>
                  <div>
                    <input
                      type="date"
                      value={customFromDate}
                      onChange={(e) => setCustomFromDate(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="From date"
                    />
                  </div>
                  <div>
                    <input
                      type="date"
                      value={customToDate}
                      onChange={(e) => setCustomToDate(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="To date"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Receipt</th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date & Time</th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Customer</th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Items</th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Payment</th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden lg:table-cell">Cashier</th>
                <th className="px-4 md:px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTransactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {isDraftSale(transaction) && <FileText className="h-4 w-4 text-purple-500" />}
                      <div className="text-sm font-semibold text-gray-900">#{transaction.receiptNumber ?? 'N/A'}</div>
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{format(new Date(transaction.timestamp), 'MMM dd, yyyy')}</div>
                    <div className="text-xs text-gray-500">{format(new Date(transaction.timestamp), 'HH:mm')}</div>
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 truncate max-w-32">{transaction.customerName || 'Walk-in Customer'}</div>
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{transaction.items.length} items</div>
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">{state.settings.currency} {transaction.total.toFixed(2)}</div>
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {getPaymentIcon(transaction.paymentMethod)}
                      {transaction.payments && transaction.payments.length > 0 ? (
                        <span className="text-sm text-gray-900">
                          {transaction.payments.map(p => `${p.method} ${state.settings.currency} ${p.amount.toFixed(2)}`).join(' | ')}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-900 capitalize">{transaction.paymentMethod}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(isDraftSale(transaction) ? 'draft' : transaction.status)}`}>
                      {isDraftSale(transaction) ? 'draft' : transaction.status}
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-900 hidden lg:table-cell">
                    <div className="truncate max-w-24">{transaction.cashier ?? 'N/A'}</div>
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-1">
                      <button
                        onClick={() => setSelectedTransaction(transaction)}
                        className="text-blue-600 hover:text-blue-900 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {(canEdit && !isDraftSale(transaction)) && (
                        <button
                          onClick={() => setSelectedTransaction(transaction)}
                          className="text-amber-600 hover:text-amber-900 p-2 rounded-lg hover:bg-amber-50 transition-colors"
                          title="View / Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}
                      {(canDelete && !isDraftSale(transaction)) && (
                        <button
                          onClick={() => handleDeleteTransaction(transaction)}
                          className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50 transition-colors"
                          title="Delete Transaction"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTransaction && (
        <TransactionDetailModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          canDelete={canDelete && !isDraftSale(selectedTransaction)}
          canReturn={canReturn && !isDraftSale(selectedTransaction)}
          canEdit={canEdit && !isDraftSale(selectedTransaction)}
          onDelete={() => handleDeleteTransaction(selectedTransaction)}
        />
      )}

      <TablePrintModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="Sales Transactions Report"
        subtitle="All sales transactions with applied filters"
        columns={printColumns}
        data={filteredTransactions}
        summaries={printSummaries}
        filters={printFilters}
        orientation="landscape"
      />
    </div>
  );
}

interface TransactionDetailModalProps {
  transaction: Sale;
  onClose: () => void;
  canDelete?: boolean;
  canReturn?: boolean;
  canEdit?: boolean;
  onDelete?: () => void;
}

function TransactionDetailModal({ transaction, onClose, canDelete, canReturn, canEdit, onDelete }: TransactionDetailModalProps) {
  const { state, dispatch } = useApp();
  const { profile } = useAuth();
  const [showCheckout, setShowCheckout] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editItems, setEditItems] = useState<EditableCartItem[]>([]);
  const [editStatus, setEditStatus] = useState<Sale['status']>('completed');
  const [editNotes, setEditNotes] = useState<string>('');

  const startEditing = () => {
    setEditItems(transaction.items.map(it => ({ ...it })));
    setEditStatus(transaction.status);
    setEditNotes(transaction.notes || '');
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditItems([]);
  };

  const updateEditQty = (index: number, delta: number) => {
    setEditItems(prev => {
      const next = [...prev];
      const it = { ...next[index] };
      if (it.product.isWeightBased) {
        const newW = Math.max(0, Number((it.weight || 1) + delta));
        it.weight = newW;
      } else {
        it.quantity = Math.max(0, it.quantity + delta);
      }
      const price = it.product.isWeightBased
        ? (it.product.pricePerUnit || 0) * (it.weight || 1)
        : it.product.price;
      const qtyOrW: number = it.product.isWeightBased ? (it.weight || 0) : it.quantity;
      it.subtotal = Number(((price / (it.product.isWeightBased ? (it.weight || 1) : 1)) * qtyOrW - (it.discount || 0)).toFixed(2));
      if (qtyOrW <= 0) it.subtotal = 0;
      next[index] = it;
      return next;
    });
  };

  const removeEditItem = (index: number) => {
    setEditItems(prev => prev.filter((_, i) => i !== index));
  };

  const editTotals = useMemo(() => {
    if (!isEditing) return { subtotal: 0, discount: 0, total: 0 };
    let sub = 0;
    let disc = 0;
    for (const it of editItems) {
      const price = it.product.isWeightBased
        ? (it.product.pricePerUnit || 0) * (it.weight || 1)
        : it.product.price;
      const qtyOrW: number = it.product.isWeightBased ? (it.weight || 0) : it.quantity;
      const baseS = (price / (it.product.isWeightBased ? (it.weight || 1) : 1)) * qtyOrW;
      sub += baseS;
      disc += (it.discount || 0);
    }
    const total = Number((sub - disc).toFixed(2));
    return { subtotal: Number(sub.toFixed(2)), discount: Number(disc.toFixed(2)), total };
  }, [isEditing, editItems]);

  const handleOpenReturn = () => {
    if (!canReturn) {
      swalConfig.warning('Product Returns feature is disabled or you do not have permission.');
      return;
    }
    setShowReturn(true);
  };

  const handleReturnSaved = async (returnRecord: any) => {
    try {
      let saved = returnRecord;
      try {
        if (returnRecord.id && state.returns.some(r => r.id === returnRecord.id)) {
          saved = await returnsService.update(returnRecord.id, returnRecord);
        } else {
          saved = await returnsService.create(returnRecord);
        }
        if (saved.restocked && saved.status === 'completed') {
          for (const ri of saved.items) {
            const product = state.products.find(p => p.id === ri.productId);
            if (product && product.trackInventory && ri.quantity > 0) {
              const qtyToAdd = Number(ri.quantity || 0);
              const updated: any = { ...product, stock: product.stock + qtyToAdd, updatedAt: new Date() };
              try { await productsService.update(product.id, updated); } catch (e) {}
              dispatch({ type: 'UPDATE_PRODUCT', payload: updated });
            }
          }
        }
      } catch (e) {
        console.warn('returnsService save failed, using local-only fallback:', e);
      }
      dispatch({ type: 'ADD_RETURN', payload: saved });
      swalConfig.success('Return processed successfully!');
      setShowReturn(false);
      onClose();
    } catch (e: any) {
      console.error(e);
      swalConfig.error('Failed to save return: ' + (e.message || 'Unknown error'));
    }
  };

  const handleCompleteDraft = () => {
    dispatch({ type: 'CLEAR_CART' });
    transaction.items.forEach(item => {
      dispatch({ type: 'ADD_TO_CART', payload: item });
    });
    if (transaction.customerId) {
      const customer = state.customers.find(c => c.id === transaction.customerId);
      if (customer) dispatch({ type: 'SET_SELECTED_CUSTOMER', payload: customer });
    }
    setShowCheckout(true);
  };

  const handleCheckoutComplete = async (_completedSale: Sale) => {
    try {
      await salesService.delete(transaction.id);
      dispatch({ type: 'DELETE_SALE', payload: transaction.id });
      setShowCheckout(false);
      onClose();
    } catch (error) {
      console.error('Error completing draft sale:', error);
      swalConfig.error('Failed to complete the draft sale. Please try again.');
    }
  };

  const computeStockDiff = (oldItems: CartItem[], newItems: EditableCartItem[]) => {
    const map = new Map<string, { name: string; old: number; new: number }>();
    for (const ci of oldItems) {
      const anyCi: any = ci;
      const pid: string = anyCi.product?.id || anyCi.productId || '';
      if (!pid || pid.startsWith('custom-')) continue;
      const qty = Number(ci.weight || ci.quantity || 0);
      const name = anyCi.product?.name || anyCi.productName || 'Unknown';
      map.set(pid, { name, old: qty, new: 0 });
    }
    for (const ci of newItems) {
      const anyCi: any = ci;
      const pid: string = anyCi.product?.id || anyCi.productId || '';
      if (!pid || pid.startsWith('custom-')) continue;
      const qty = Number(ci.weight || ci.quantity || 0);
      const name = anyCi.product?.name || anyCi.productName || 'Unknown';
      const existing = map.get(pid);
      if (existing) existing.new = qty;
      else map.set(pid, { name, old: 0, new: qty });
    }
    const diffs: { productId: string; name: string; delta: number }[] = [];
    map.forEach((v, k) => {
      const delta = v.old - v.new; // positive => restock (add back), negative => deduct more
      diffs.push({ productId: k, name: v.name, delta });
    });
    return diffs;
  };

  const applyStockDiffs = async (diffs: { productId: string; name: string; delta: number }[]) => {
    for (const d of diffs) {
      if (d.delta === 0) continue;
      const product = state.products.find(p => p.id === d.productId);
      if (!product || !product.trackInventory) continue;
      const currentStock = Number(product.stock || 0);
      const newStock = Math.max(0, currentStock + d.delta);
      const updated: any = { ...product, stock: newStock, updatedAt: new Date() };
      try { await productsService.update(d.productId, updated); } catch (e) {}
      dispatch({ type: 'UPDATE_PRODUCT', payload: updated });
    }
  };

  const adjustCustomerStatsOnUpdate = async (oldTotal: number, newTotal: number, customerId?: string) => {
    if (!customerId) return;
    const customer = state.customers.find(c => c.id === customerId);
    if (!customer) return;
    const diff = Number(newTotal) - Number(oldTotal);
    const patch: any = {
      totalPurchases: Math.max(0, Number(customer.totalPurchases || 0) + diff),
    };
    if (transaction.status === 'credit' || transaction.paymentMethod === 'credit') {
      patch.creditUsed = Math.max(0, Number(customer.creditUsed || 0) + diff);
    }
    const updated: any = { ...customer, ...patch };
    try { await customersService.update(customer.id, updated); } catch (e) {}
    dispatch({ type: 'UPDATE_CUSTOMER', payload: updated });
  };

  const handleUpdateTransaction = async () => {
    if (!canEdit) return;
    if (editItems.length === 0) {
      swalConfig.warning('At least one item is required. Use Delete instead if removing entire transaction.');
      return;
    }
    const diffs = computeStockDiff(transaction.items, editItems);
    const restockLines: string[] = [];
    for (const d of diffs) {
      if (d.delta === 0) continue;
      if (d.delta > 0) restockLines.push(`• ${d.name}: +${d.delta} (restock)`);
      else restockLines.push(`• ${d.name}: ${d.delta} (deduct more stock)`);
    }
    let confirmText = `Update transaction ${transaction.invoiceNumber}?\n\n`;
    confirmText += `Old Total: ${state.settings.currency} ${transaction.total.toFixed(2)}\n`;
    confirmText += `New Total: ${state.settings.currency} ${editTotals.total.toFixed(2)}\n\n`;
    if (restockLines.length > 0) {
      confirmText += `📦 INVENTORY ADJUSTMENTS:\n${restockLines.slice(0, 10).join('\n')}${restockLines.length > 10 ? '\n...' : ''}\n\n`;
    }
    confirmText += `Proceed with update?`;

    const res = await swalConfig.confirm('Update Transaction?', confirmText, 'Save Changes');
    if (!res.isConfirmed) return;
    try {
      swalConfig.loading('Updating inventory and transaction...');
      await applyStockDiffs(diffs);
      await adjustCustomerStatsOnUpdate(transaction.total, editTotals.total, transaction.customerId);

      const updatedSale: Sale = {
        ...transaction,
        items: editItems.filter(it => (it.product.isWeightBased ? (it.weight || 0) : it.quantity) > 0),
        subtotal: editTotals.subtotal,
        discountAmount: editTotals.discount,
        taxAmount: 0,
        total: editTotals.total,
        status: editStatus,
        notes: editNotes || transaction.notes,
      };

      let saved: Sale = updatedSale;
      try {
        saved = await salesService.update(transaction.id, updatedSale);
      } catch (e) {
        console.warn('Supabase update failed, updating local state only:', e);
      }
      dispatch({ type: 'UPDATE_SALE', payload: saved });
      swalConfig.close();
      swalConfig.success('Transaction updated successfully.');
      setIsEditing(false);
    } catch (e: any) {
      console.error(e);
      swalConfig.close();
      swalConfig.error('Failed to update: ' + (e.message || 'Unknown error'));
    }
  };

  const renderViewItems = () => (
    <div className="space-y-3">
      {transaction.items.map((item, index) => {
        const anyItem: any = item;
        const pname: string = anyItem.product?.name || anyItem.productName || 'Unknown Product';
        const unitPrice: number = anyItem.product?.isWeightBased
          ? (anyItem.product?.pricePerUnit || 0)
          : (anyItem.product?.price ?? anyItem.unitPrice ?? 0);
        const unit: string = anyItem.product?.unit || '';
        const qtyLabel = anyItem.weight ? `${anyItem.weight}${unit}` : item.quantity;
        const perLabel = anyItem.product?.isWeightBased ? `per ${unit}` : '';
        return (
          <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
            <div>
              <p className="font-medium text-gray-900">{pname}</p>
              <p className="text-sm text-gray-600">
                {state.settings.currency} {Number(unitPrice).toFixed(2)} {perLabel} × {qtyLabel}
              </p>
              {(item.discount || 0) > 0 && (
                <p className="text-xs text-green-600">
                  Discount: -{state.settings.currency} {Number(item.discount).toFixed(2)}
                </p>
              )}
            </div>
            <p className="font-semibold text-gray-900">
              {state.settings.currency} {Number(item.subtotal).toFixed(2)}
            </p>
          </div>
        );
      })}
    </div>
  );

  const renderEditItems = () => (
    <div className="space-y-3">
      {editItems.map((item, index) => {
        const anyItem: any = item;
        const pname: string = anyItem.product?.name || anyItem.productName || 'Unknown Product';
        const unitPrice: number = anyItem.product?.isWeightBased
          ? (anyItem.product?.pricePerUnit || 0)
          : (anyItem.product?.price ?? anyItem.unitPrice ?? 0);
        const unit: string = anyItem.product?.unit || '';
        const qtyVal = item.product.isWeightBased ? Number(item.weight || 0) : item.quantity;
        return (
          <div key={index} className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm truncate">{pname}</p>
                <p className="text-xs text-gray-600">
                  {state.settings.currency} {Number(unitPrice).toFixed(2)} {item.product.isWeightBased ? `per ${unit}` : ''}
                </p>
              </div>
              <button
                onClick={() => removeEditItem(index)}
                className="text-red-500 hover:bg-red-100 p-1 rounded-lg transition-colors flex-shrink-0"
                title="Remove item"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => updateEditQty(index, -1)}
                  className="w-7 h-7 flex items-center justify-center rounded bg-white border border-amber-300 hover:bg-amber-100 transition-colors"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <div className="px-2 py-1 bg-white border border-amber-300 rounded min-w-[48px] text-center text-sm font-semibold">
                  {qtyVal}{unit}
                </div>
                <button
                  onClick={() => updateEditQty(index, 1)}
                  className="w-7 h-7 flex items-center justify-center rounded bg-white border border-amber-300 hover:bg-amber-100 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <div className="text-sm font-semibold text-gray-900">
                {state.settings.currency} {Number(item.subtotal).toFixed(2)}
              </div>
            </div>
          </div>
        );
      })}
      {editItems.length === 0 && (
        <div className="p-6 text-center text-gray-500 bg-red-50 rounded-xl border border-red-200">
          <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-red-500" />
          <p className="font-semibold text-red-700">No items remaining</p>
          <p className="text-xs text-red-600 mt-1">Use DELETE to remove the entire transaction.</p>
        </div>
      )}
      {isEditing && (
        <div className="space-y-3 pt-4 border-t border-gray-200">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
            <select
              value={editStatus}
              onChange={e => setEditStatus(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="credit">Credit</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
            <textarea
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Optional notes about this edit..."
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-900">
                  {isEditing ? '✏️  Edit Transaction' : 'Transaction Details'}
                </h2>
                {isEditing && (
                  <span className="inline-flex items-center px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
                    EDIT MODE
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-600">Receipt Number</p>
                <p className="text-lg font-semibold text-gray-900">#{transaction.receiptNumber ?? 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Date & Time</p>
                <p className="text-lg font-semibold text-gray-900">
                  {format(new Date(transaction.timestamp), 'MMM dd, yyyy HH:mm')}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Customer</p>
                <p className="text-lg font-semibold text-gray-900">
                  {transaction.customerName || 'Walk-in Customer'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Cashier</p>
                <p className="text-lg font-semibold text-gray-900">{transaction.cashier ?? 'N/A'}</p>
              </div>
            </div>

            {transaction.cardDetails && (
              <div className="bg-gray-50 rounded-2xl p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Card Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><p className="text-gray-600">Bank</p><p className="font-medium">{transaction.cardDetails.bankName}</p></div>
                  <div><p className="text-gray-600">Card Type</p><p className="font-medium capitalize">{transaction.cardDetails.cardType}</p></div>
                  <div><p className="text-gray-600">Card Ending</p><p className="font-medium">****{transaction.cardDetails.lastFourDigits}</p></div>
                  <div><p className="text-gray-600">Holder</p><p className="font-medium">{transaction.cardDetails.holderName}</p></div>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Items {isEditing ? `(${editItems.length})` : `(${transaction.items.length})`}
                </h3>
                {canEdit && !isDraftSale(transaction) && !isEditing && (
                  <button
                    onClick={startEditing}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-lg text-xs font-bold transition-colors"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Edit Items / Status</span>
                  </button>
                )}
              </div>
              {isEditing ? renderEditItems() : renderViewItems()}
            </div>

            <div className="space-y-2 pt-4 border-t border-gray-200">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">{state.settings.currency} {(isEditing ? editTotals.subtotal : transaction.subtotal).toFixed(2)}</span>
              </div>
              {(isEditing ? editTotals.discount : transaction.discountAmount) > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount:</span>
                  <span className="font-medium">
                    -{state.settings.currency} {(isEditing ? editTotals.discount : transaction.discountAmount).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                <span>Total:</span>
                <span>{state.settings.currency} {(isEditing ? editTotals.total : transaction.total).toFixed(2)}</span>
              </div>
            </div>

            {(transaction.notes || (isEditing && editNotes)) && !isEditing && (
              <div className="bg-blue-50 rounded-2xl p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Notes</h3>
                <p className="text-gray-700">{transaction.notes}</p>
              </div>
            )}

            {isDraftSale(transaction) && (
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-purple-900 mb-1">Draft Sale</h3>
                    <p className="text-purple-700 text-sm">This sale is pending payment completion.</p>
                  </div>
                  <button
                    onClick={handleCompleteDraft}
                    className="btn btn-primary btn-md flex items-center space-x-2"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    <span>Complete Payment</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer flex flex-wrap gap-3 justify-end">
            {isEditing ? (
              <>
                <button onClick={cancelEditing} className="btn btn-secondary btn-md">
                  Cancel Edit
                </button>
                <button
                  onClick={handleUpdateTransaction}
                  className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-orange-700 shadow-md transition-all"
                >
                  <Save className="h-4 w-4" />
                  <span>Save Changes</span>
                </button>
              </>
            ) : (
              <>
                {(canDelete || canReturn || canEdit) && (
                  <>
                    {canReturn && !isDraftSale(transaction) && (
                      <button
                        onClick={handleOpenReturn}
                        className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-orange-700 shadow-md transition-all"
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span>Process Return</span>
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => onDelete?.()}
                        className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-semibold hover:from-red-600 hover:to-rose-700 shadow-md transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Delete Transaction</span>
                      </button>
                    )}
                  </>
                )}
                <button onClick={onClose} className="btn btn-secondary btn-md">Close</button>
              </>
            )}
          </div>
        </div>
      </div>

      {showCheckout && (
        <CheckoutModal
          isOpen={showCheckout}
          onClose={() => setShowCheckout(false)}
          onComplete={handleCheckoutComplete}
        />
      )}

      {showReturn && (
        <ReturnModal
          isOpen={showReturn}
          onClose={() => setShowReturn(false)}
          onSave={handleReturnSaved}
          fromSale={transaction}
        />
      )}
    </>
  );
}

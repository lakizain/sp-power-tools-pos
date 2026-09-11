import React, { useState, useMemo } from 'react';
import {
  Search, Plus, Edit2, Trash2, Download, Filter,
  RotateCcw, AlertTriangle, CheckCircle, XCircle, Clock,
  DollarSign, Box, TrendingDown, FileText, ShoppingCart,
  ArrowRight, Receipt
} from 'lucide-react';
import { useApp } from '../../context/SupabaseAppContext';
import { useAuth } from '../../context/AuthContext';
import { ProductReturn, Sale, CartItem } from '../../types';
import { swalConfig } from '../../lib/sweetAlert';
import { matchesAnyField, sortBySearchRelevance } from '../../lib/searchUtils';
import { returnsService, productsService } from '../../lib/services';
import { ReturnModal } from './ReturnModal';
import { format } from 'date-fns';

export function ReturnsManager() {
  const { state, dispatch } = useApp();
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReturn, setEditingReturn] = useState<ProductReturn | null>(null);
  const [fromSale, setFromSale] = useState<Sale | null>(null);

  const [billSearchTerm, setBillSearchTerm] = useState('');
  const [searchedBill, setSearchedBill] = useState<Sale | null>(null);
  const [billSearchError, setBillSearchError] = useState('');
  const [showBillSuggestions, setShowBillSuggestions] = useState(false);

  const billSuggestions = useMemo(() => {
    const term = billSearchTerm.trim();
    if (!term) return [];
    const matched = state.sales.filter(s =>
      matchesAnyField(
        [s.invoiceNumber, s.receiptNumber, s.customerName, s.cashier],
        term
      )
    );
    return sortBySearchRelevance(
      matched.slice(0, 8),
      term,
      s => `${s.invoiceNumber} ${s.receiptNumber || ''} ${s.customerName || ''}`
    );
  }, [state.sales, billSearchTerm]);

  const canEdit = profile?.role === 'admin' || profile?.role === 'manager';

  const filteredReturns = useMemo(() => {
    const result = state.returns.filter(r => {
      const matchesSearch = matchesAnyField(
        [
          r.invoiceNumber,
          r.customerName,
          r.reason,
          ...r.items.map(i => i.productName),
        ],
        searchTerm
      );

      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchesMethod = methodFilter === 'all' || r.returnMethod === methodFilter;

      return matchesSearch && matchesStatus && matchesMethod;
    });
    const sorted = sortBySearchRelevance(
      result,
      searchTerm,
      r => `${r.invoiceNumber} ${r.customerName || ''} ${r.reason}`
    );
    if (!searchTerm) {
      return sorted.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    return sorted;
  }, [state.returns, searchTerm, statusFilter, methodFilter]);

  const summary = useMemo(() => {
    const total = state.returns.length;
    const totalRefund = state.returns.reduce((sum, r) => sum + r.totalRefund, 0);
    const totalItems = state.returns.reduce((sum, r) => sum + r.items.reduce((s, i) => s + i.quantity, 0), 0);
    const pending = state.returns.filter(r => r.status === 'pending').length;
    return { total, totalRefund, totalItems, pending };
  }, [state.returns]);

  const handleAdd = () => {
    if (!canEdit) {
      swalConfig.error('You do not have permission to process returns.');
      return;
    }
    setEditingReturn(null);
    setFromSale(null);
    setIsModalOpen(true);
  };

  const handleEdit = (r: ProductReturn) => {
    if (!canEdit) {
      swalConfig.error('You do not have permission to edit returns.');
      return;
    }
    setEditingReturn(r);
    setFromSale(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (r: ProductReturn) => {
    if (!canEdit) {
      swalConfig.error('You do not have permission to delete returns.');
      return;
    }
    const result = await swalConfig.confirm(
      'Delete Return Record?',
      `Delete return for invoice "${r.invoiceNumber}" with refund amount of ${state.settings.currency} ${r.totalRefund.toFixed(2)}? This cannot be undone.`,
      'Delete'
    );
    if (result.isConfirmed) {
      dispatch({ type: 'DELETE_RETURN', payload: r.id });
      swalConfig.success('Return record deleted.');
    }
  };

  const handleSave = async (r: ProductReturn) => {
    try {
      swalConfig.loading(editingReturn ? 'Updating return...' : 'Saving return...');
      let saved: ProductReturn;
      if (editingReturn) {
        saved = await returnsService.update(editingReturn.id, r);
        dispatch({ type: 'UPDATE_RETURN', payload: saved });
      } else {
        saved = await returnsService.create(r);
        dispatch({ type: 'ADD_RETURN', payload: saved });
      }

      if (r.restocked && r.status === 'completed') {
        for (const ri of r.items) {
          const product = state.products.find(p => p.id === ri.productId);
          if (product && product.trackInventory && ri.quantity > 0) {
            const qtyToAdd = Number(ri.quantity || 0);
            const updatedProduct: any = {
              ...product,
              stock: product.stock + qtyToAdd,
              updatedAt: new Date(),
            };
            try {
              await productsService.update(product.id, updatedProduct);
            } catch (e) {
            }
            dispatch({ type: 'UPDATE_PRODUCT', payload: updatedProduct });
          }
        }
      }

      swalConfig.close();
      swalConfig.success(editingReturn ? 'Return updated successfully.' : 'Return recorded successfully.');
      setIsModalOpen(false);
      setEditingReturn(null);
      setFromSale(null);
      setSearchedBill(null);
      setBillSearchTerm('');
    } catch (e: any) {
      console.error(e);
      swalConfig.close();
      swalConfig.error('Failed to save return: ' + (e.message || 'Unknown error'));
    }
  };

  const handleBillSearch = () => {
    setBillSearchError('');
    setShowBillSuggestions(false);
    const term = billSearchTerm.trim();
    if (!term) {
      setBillSearchError('Please enter an invoice / bill number.');
      setSearchedBill(null);
      return;
    }
    const matched = state.sales.filter(s =>
      matchesAnyField(
        [s.invoiceNumber, s.receiptNumber, s.customerName, s.cashier],
        term
      )
    );
    const sorted = sortBySearchRelevance(
      matched,
      term,
      s => `${s.invoiceNumber} ${s.receiptNumber || ''} ${s.customerName || ''}`
    );
    if (sorted.length === 0) {
      setBillSearchError(`No bill found for "${billSearchTerm}". Try another invoice number.`);
      setSearchedBill(null);
      return;
    }
    setSearchedBill(sorted[0]);
  };

  const handleSelectSuggestion = (sale: Sale) => {
    setBillSearchTerm(sale.invoiceNumber);
    setSearchedBill(sale);
    setShowBillSuggestions(false);
    setBillSearchError('');
  };

  const handleReturnFullBill = () => {
    if (!searchedBill || !canEdit) return;
    setEditingReturn(null);
    setFromSale(searchedBill);
    setIsModalOpen(true);
  };

  const handleReturnSingleItem = (cartItem: CartItem) => {
    if (!searchedBill || !canEdit) return;
    const singleItemSale: Sale = {
      ...searchedBill,
      items: [cartItem],
      subtotal: cartItem.subtotal,
      discountAmount: 0,
      taxAmount: 0,
      total: cartItem.subtotal,
    };
    setEditingReturn(null);
    setFromSale(singleItemSale);
    setIsModalOpen(true);
  };

  const handleClearBillSearch = () => {
    setBillSearchTerm('');
    setSearchedBill(null);
    setBillSearchError('');
  };

  const exportData = () => {
    const csvContent = [
      ['Date', 'Invoice', 'Customer', 'Items', 'Reason', 'Method', 'Status', 'Refund Amount', 'Processed By', 'Notes'].join(','),
      ...filteredReturns.map(r => [
        format(new Date(r.timestamp), 'yyyy-MM-dd HH:mm'),
        r.invoiceNumber,
        r.customerName || 'N/A',
        r.items.length,
        r.reason,
        r.returnMethod,
        r.status,
        r.totalRefund.toFixed(2),
        r.processedBy,
        `"${(r.notes || '').replace(/"/g, '""')}"`,
      ].join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `returns-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const statusBadge = (status: ProductReturn['status']) => {
    const map: Record<ProductReturn['status'], string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      exchanged: 'bg-purple-100 text-purple-800',
    };
    const icons: Record<ProductReturn['status'], React.ReactNode> = {
      pending: <Clock className="h-3 w-3" />,
      approved: <CheckCircle className="h-3 w-3" />,
      completed: <CheckCircle className="h-3 w-3" />,
      rejected: <XCircle className="h-3 w-3" />,
      exchanged: <Box className="h-3 w-3" />,
    };
    return (
      <span className={`inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold rounded-full capitalize ${map[status]}`}>
        {icons[status]}
        <span>{status}</span>
      </span>
    );
  };

  const methodBadge = (method: ProductReturn['returnMethod']) => {
    const map: Record<ProductReturn['returnMethod'], string> = {
      refund: 'bg-emerald-100 text-emerald-800',
      exchange: 'bg-purple-100 text-purple-800',
      store_credit: 'bg-indigo-100 text-indigo-800',
      rental_return: 'bg-violet-100 text-violet-800',
    };
    return (
      <span className={`inline-flex px-2.5 py-1 text-[11px] font-bold rounded-full capitalize ${map[method]}`}>
        {method.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Product Returns</h1>
          <p className="text-gray-600 mt-1">Track and process customer returns, refunds, and exchanges</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={exportData}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
          <button
            onClick={handleAdd}
            disabled={!canEdit}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium shadow-lg transition-all ${
              canEdit
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700 hover:shadow-xl'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <RotateCcw className="h-4 w-4" />
            <span>New Return</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 md:p-6 rounded-2xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-sm font-medium">Total Returns</p>
              <p className="text-xl md:text-2xl font-bold">{summary.total}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <RotateCcw className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-rose-500 to-red-500 p-4 md:p-6 rounded-2xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-rose-100 text-sm font-medium">Total Refund</p>
              <p className="text-xl md:text-2xl font-bold">{state.settings.currency} {summary.totalRefund.toFixed(2)}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <TrendingDown className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-cyan-500 to-blue-500 p-4 md:p-6 rounded-2xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-cyan-100 text-sm font-medium">Items Returned</p>
              <p className="text-xl md:text-2xl font-bold">{summary.totalItems}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <Box className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-yellow-500 to-amber-500 p-4 md:p-6 rounded-2xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-100 text-sm font-medium">Pending</p>
              <p className="text-xl md:text-2xl font-bold">{summary.pending}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <Clock className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-50 to-amber-50/50 p-4 md:p-6 rounded-2xl border border-amber-200/60 shadow-sm">
        <div className="flex items-center space-x-3 mb-4">
          <div className="bg-amber-100 p-2.5 rounded-xl">
            <Receipt className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h3 className="text-base md:text-lg font-bold text-gray-900">
              Search Old Bill / Invoice
            </h3>
            <p className="text-xs md:text-sm text-gray-600">
              Enter invoice number to create returns for individual items
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 mb-3">
          <div className="relative flex-1">
            <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Enter invoice / bill number (e.g. INV-1001) – try typing just a number like 2"
              value={billSearchTerm}
              onChange={(e) => { setBillSearchTerm(e.target.value); setShowBillSuggestions(true); }}
              onFocus={() => setShowBillSuggestions(true)}
              onBlur={() => setTimeout(() => setShowBillSuggestions(false), 150)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleBillSearch();
                }
              }}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white"
            />
            {showBillSuggestions && billSuggestions.length > 0 && (
              <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-amber-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                {billSuggestions.map((s) => (
                  <li
                    key={s.id}
                    onMouseDown={() => handleSelectSuggestion(s)}
                    className="px-4 py-2.5 hover:bg-amber-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col min-w-0">
                        <div className="text-sm font-bold text-gray-900 truncate">
                          {s.invoiceNumber}
                          {s.receiptNumber && <span className="ml-2 text-xs text-gray-500 font-normal">Receipt: {s.receiptNumber}</span>}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {s.customerName || 'Walk-in'} · {format(new Date(s.timestamp), 'MMM dd, yyyy')}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-amber-700 whitespace-nowrap">
                        {state.settings.currency} {s.total.toFixed(2)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleBillSearch}
              disabled={!canEdit}
              className={`flex items-center justify-center space-x-2 px-5 py-3 rounded-xl font-semibold shadow transition-all whitespace-nowrap ${
                canEdit
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Search className="h-4 w-4" />
              <span>Find Bill</span>
            </button>
            {(searchedBill || billSearchTerm) && (
              <button
                onClick={handleClearBillSearch}
                className="px-5 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {billSearchError && (
          <div className="mb-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {billSearchError}
          </div>
        )}

        {searchedBill && (
          <div className="mt-4 border border-amber-200 rounded-2xl bg-white overflow-hidden shadow-sm">
            <div className="p-4 md:p-5 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-start space-x-3">
                <div className="bg-white p-2 rounded-xl border border-amber-200">
                  <ShoppingCart className="h-5 w-5 text-amber-700" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold text-gray-900">
                      {searchedBill.invoiceNumber}
                    </h4>
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 uppercase">
                      {searchedBill.status}
                    </span>
                    {searchedBill.receiptNumber && (
                      <span className="text-xs text-gray-500">
                        Receipt: {searchedBill.receiptNumber}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                    <div>
                      <span className="font-medium">Customer:</span>{' '}
                      {searchedBill.customerName || 'Walk-in Customer'}
                    </div>
                    <div>
                      <span className="font-medium">Date:</span>{' '}
                      {format(new Date(searchedBill.timestamp), 'MMM dd, yyyy · HH:mm')}
                    </div>
                    <div>
                      <span className="font-medium">Cashier:</span> {searchedBill.cashier || '—'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-left md:text-right">
                <div className="text-xs text-gray-500 mb-0.5">Bill Total</div>
                <div className="text-xl font-bold text-gray-900">
                  {state.settings.currency} {searchedBill.total.toFixed(2)}
                </div>
                <button
                  onClick={handleReturnFullBill}
                  disabled={!canEdit}
                  className={`mt-2 inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all whitespace-nowrap ${
                    canEdit
                      ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white hover:from-rose-600 hover:to-red-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Return Entire Bill</span>
                </button>
              </div>
            </div>

            <div className="p-3 md:p-4">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5 px-1">
                Bill Items — click "Return Item" on any item to create a return for it individually
              </div>
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 md:px-4 py-2.5 text-left text-[11px] font-bold text-gray-600 uppercase">
                        Product
                      </th>
                      <th className="px-3 md:px-4 py-2.5 text-right text-[11px] font-bold text-gray-600 uppercase">
                        Sold Qty
                      </th>
                      <th className="px-3 md:px-4 py-2.5 text-right text-[11px] font-bold text-gray-600 uppercase hidden sm:table-cell">
                        Unit Price
                      </th>
                      <th className="px-3 md:px-4 py-2.5 text-right text-[11px] font-bold text-gray-600 uppercase">
                        Subtotal
                      </th>
                      <th className="px-3 md:px-4 py-2.5 text-right text-[11px] font-bold text-gray-600 uppercase">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {searchedBill.items.map((item, idx) => {
                      const product = (item as any).product;
                      const productName = product?.name || (item as any).productName || `Item ${idx + 1}`;
                      const sku = product?.sku || (item as any).sku;
                      const qty = item.quantity || 0;
                      const unitPrice = product?.price ?? (item as any).unitPrice ?? 0;
                      const lineTotal = item.subtotal ?? (qty * unitPrice);
                      return (
                        <tr key={idx} className="hover:bg-amber-50/40 transition-colors">
                          <td className="px-3 md:px-4 py-3">
                            <div className="text-sm font-semibold text-gray-900">
                              {productName}
                            </div>
                            {sku && (
                              <div className="text-[11px] text-gray-500 mt-0.5">
                                SKU: {sku}
                              </div>
                            )}
                          </td>
                          <td className="px-3 md:px-4 py-3 text-right text-sm font-semibold text-gray-800">
                            ×{qty}
                          </td>
                          <td className="px-3 md:px-4 py-3 text-right text-sm text-gray-700 hidden sm:table-cell">
                            {state.settings.currency} {Number(unitPrice).toFixed(2)}
                          </td>
                          <td className="px-3 md:px-4 py-3 text-right text-sm font-bold text-gray-900">
                            {state.settings.currency} {Number(lineTotal).toFixed(2)}
                          </td>
                          <td className="px-3 md:px-4 py-3 text-right">
                            <button
                              onClick={() => handleReturnSingleItem(item)}
                              disabled={!canEdit}
                              className={`inline-flex items-center space-x-1 px-3 py-2 rounded-lg text-xs font-bold shadow-sm transition-all whitespace-nowrap ${
                                canEdit
                                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700'
                                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              }`}
                            >
                              <ArrowRight className="h-3 w-3" />
                              <span>Return Item</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search existing returns by invoice, customer, reason, product..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent appearance-none text-sm"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent appearance-none text-sm"
              >
                <option value="all">All Methods</option>
                <option value="refund">Refund</option>
                <option value="exchange">Exchange</option>
                <option value="store_credit">Store Credit</option>
                <option value="rental_return">Rental Return</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Invoice / Date</th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Details</th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">Reason</th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell">Method / Status</th>
                <th className="px-4 md:px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Refund</th>
                <th className="px-4 md:px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <AlertTriangle className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No returns found</h3>
                    <p className="text-gray-500 mb-4">
                      {searchTerm || statusFilter !== 'all' || methodFilter !== 'all'
                        ? 'Try adjusting your filters'
                        : 'Product returns will appear here once recorded'}
                    </p>
                    {canEdit && (
                      <button
                        onClick={handleAdd}
                        className="inline-flex items-center space-x-2 px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-medium hover:from-amber-600 hover:to-orange-700 transition-all"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Record First Return</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredReturns.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">{r.invoiceNumber}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {format(new Date(r.timestamp), 'MMM dd, yyyy · HH:mm')}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <div className="text-sm font-semibold text-gray-900">
                        {r.customerName || 'Walk-in Customer'}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {r.items.length} item{r.items.length !== 1 ? 's' : ''} · {r.items.reduce((s, i) => s + i.quantity, 0)} total units
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {r.items.slice(0, 2).map((i, idx) => (
                          <span key={idx} className="inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            {i.quantity}× {i.productName.length > 20 ? i.productName.substr(0, 20) + '…' : i.productName}
                          </span>
                        ))}
                        {r.items.length > 2 && (
                          <span className="inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-100 text-gray-600">
                            +{r.items.length - 2} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                      <span className="inline-flex px-2.5 py-1 text-[11px] font-bold rounded-full bg-gray-100 text-gray-700">
                        {r.reason}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4 hidden lg:table-cell">
                      <div className="flex flex-col space-y-1.5">
                        {methodBadge(r.returnMethod)}
                        {statusBadge(r.status)}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-bold text-gray-900">
                        {state.settings.currency} {r.totalRefund.toFixed(2)}
                      </div>
                      {r.paymentMethod && (
                        <div className="text-[11px] text-gray-500 capitalize mt-0.5">
                          via {r.paymentMethod.replace('_', ' ')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => handleEdit(r)}
                          disabled={!canEdit}
                          className={`p-2 rounded-lg transition-colors ${
                            canEdit ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-300 cursor-not-allowed'
                          }`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(r)}
                          disabled={!canEdit}
                          className={`p-2 rounded-lg transition-colors ${
                            canEdit ? 'text-red-600 hover:bg-red-50' : 'text-gray-300 cursor-not-allowed'
                          }`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ReturnModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingReturn(null); setFromSale(null); }}
        onSave={handleSave}
        editingReturn={editingReturn}
        fromSale={fromSale}
      />
    </div>
  );
}

export type { ReturnModal };

import React, { useState, useMemo } from 'react';
import {
  Search, Plus, Edit2, Trash2, Download, Calendar,
  DollarSign, PieChart, TrendingUp, AlertTriangle, Filter, Tag, Printer, CalendarRange
} from 'lucide-react';
import { useApp } from '../../context/SupabaseAppContext';
import { useAuth } from '../../context/AuthContext';
import { Expense } from '../../types';
import { swalConfig } from '../../lib/sweetAlert';
import { matchesAnyField, sortBySearchRelevance } from '../../lib/searchUtils';
import { ExpenseModal, DEFAULT_CATEGORIES } from './ExpenseModal';
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths, startOfWeek } from 'date-fns';
import { TablePrintModal, PrintColumn, PrintSummary, PrintFilterInfo } from '../ui/TablePrintModal';

export function ExpenseManager() {
  const { state, dispatch } = useApp();
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [datePreset, setDatePreset] = useState('all');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const canEdit = profile?.role === 'admin' || profile?.role === 'manager';

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const filtered = state.expenses.filter(expense => {
      const matchesSearch = matchesAnyField(
        [
          expense.description,
          expense.category,
          expense.receiptNumber,
          expense.supplierName,
          expense.paymentMethod,
          expense.notes,
        ],
        searchTerm
      );

      const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;
      const matchesPayment = paymentFilter === 'all' || expense.paymentMethod === paymentFilter;

      let matchesDate = true;
      const expenseDate = new Date(expense.date);
      if (datePreset === 'custom') {
        if (customFromDate) {
          const from = new Date(customFromDate);
          from.setHours(0, 0, 0, 0);
          matchesDate = matchesDate && expenseDate >= from;
        }
        if (customToDate) {
          const to = new Date(customToDate);
          to.setHours(23, 59, 59, 999);
          matchesDate = matchesDate && expenseDate <= to;
        }
      } else if (datePreset !== 'all') {
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        switch (datePreset) {
          case 'today':
            matchesDate = expenseDate.toDateString() === today.toDateString();
            break;
          case 'week': {
            const ws = startOfWeek(today, { weekStartsOn: 1 });
            const we = new Date();
            we.setHours(23, 59, 59, 999);
            matchesDate = expenseDate >= ws && expenseDate <= we;
            break;
          }
          case 'month':
            matchesDate = isWithinInterval(expenseDate, {
              start: startOfMonth(today),
              end: endOfMonth(today),
            });
            break;
          case 'last_month': {
            const last = subMonths(today, 1);
            matchesDate = isWithinInterval(expenseDate, {
              start: startOfMonth(last),
              end: endOfMonth(last),
            });
            break;
          }
          case 'last_3_months': {
            const threeAgo = subMonths(today, 3);
            const nowEnd = new Date();
            nowEnd.setHours(23, 59, 59, 999);
            matchesDate = expenseDate >= startOfMonth(threeAgo) && expenseDate <= nowEnd;
            break;
          }
          case 'year': {
            const ys = new Date(today.getFullYear(), 0, 1);
            const ye = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
            matchesDate = expenseDate >= ys && expenseDate <= ye;
            break;
          }
        }
      }

      return matchesSearch && matchesCategory && matchesPayment && matchesDate;
    });
    const sorted = sortBySearchRelevance(
      filtered,
      searchTerm,
      e => `${e.description} ${e.category} ${e.receiptNumber || ''} ${e.supplierName || ''}`
    );
    if (!searchTerm) {
      return sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return sorted;
  }, [state.expenses, searchTerm, categoryFilter, paymentFilter, datePreset, customFromDate, customToDate]);

  const summary = useMemo(() => {
    const now = new Date();
    const total = state.expenses.reduce((sum, e) => sum + e.amount, 0);
    const thisMonth = state.expenses.filter(e =>
      isWithinInterval(new Date(e.date), { start: startOfMonth(now), end: endOfMonth(now) })
    ).reduce((sum, e) => sum + e.amount, 0);
    const filteredTotal = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const count = state.expenses.length;

    const categoryTotals: Record<string, number> = {};
    state.expenses.forEach(e => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });
    const topCategory = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)[0];

    return { total, thisMonth, filteredTotal, count, topCategory };
  }, [state.expenses, filteredExpenses]);

  const categoryColors = useMemo(() => {
    const palette = [
      'bg-red-50 text-red-700 border-red-200',
      'bg-orange-50 text-orange-700 border-orange-200',
      'bg-amber-50 text-amber-700 border-amber-200',
      'bg-yellow-50 text-yellow-700 border-yellow-200',
      'bg-lime-50 text-lime-700 border-lime-200',
      'bg-green-50 text-green-700 border-green-200',
      'bg-emerald-50 text-emerald-700 border-emerald-200',
      'bg-teal-50 text-teal-700 border-teal-200',
      'bg-cyan-50 text-cyan-700 border-cyan-200',
      'bg-sky-50 text-sky-700 border-sky-200',
      'bg-blue-50 text-blue-700 border-blue-200',
      'bg-indigo-50 text-indigo-700 border-indigo-200',
      'bg-violet-50 text-violet-700 border-violet-200',
      'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
    ];
    const map: Record<string, string> = {};
    DEFAULT_CATEGORIES.forEach((cat, i) => {
      map[cat] = palette[i % palette.length];
    });
    return map;
  }, []);

  const handleAdd = () => {
    if (!canEdit) {
      swalConfig.error('You do not have permission to record expenses.');
      return;
    }
    setEditingExpense(null);
    setIsModalOpen(true);
  };

  const handleEdit = (expense: Expense) => {
    if (!canEdit) {
      swalConfig.error('You do not have permission to edit expenses.');
      return;
    }
    setEditingExpense(expense);
    setIsModalOpen(true);
  };

  const handleDelete = async (expense: Expense) => {
    if (!canEdit) {
      swalConfig.error('You do not have permission to delete expenses.');
      return;
    }
    const result = await swalConfig.confirm(
      'Delete Expense?',
      `Are you sure you want to delete this expense of ${state.settings.currency} ${expense.amount.toFixed(2)}? This cannot be undone.`,
      'Delete'
    );
    if (result.isConfirmed) {
      dispatch({ type: 'DELETE_EXPENSE', payload: expense.id });
      swalConfig.success('Expense deleted successfully.');
    }
  };

  const handleSave = (expense: Expense) => {
    if (editingExpense) {
      dispatch({ type: 'UPDATE_EXPENSE', payload: expense });
      swalConfig.success('Expense updated successfully.');
    } else {
      dispatch({ type: 'ADD_EXPENSE', payload: expense });
      swalConfig.success('Expense recorded successfully.');
    }
    setIsModalOpen(false);
    setEditingExpense(null);
  };

  const exportExpenses = () => {
    const csvContent = [
      ['Date', 'Category', 'Description', 'Amount', 'Payment Method', 'Receipt #', 'Supplier', 'Notes'].join(','),
      ...filteredExpenses.map(e => [
        format(new Date(e.date), 'yyyy-MM-dd'),
        e.category,
        `"${e.description.replace(/"/g, '""')}"`,
        e.amount.toFixed(2),
        e.paymentMethod,
        e.receiptNumber || '',
        e.supplierName || '',
        `"${(e.notes || '').replace(/"/g, '""')}"`,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const methodBadge = (method: string) => {
    const styles: Record<string, string> = {
      cash: 'bg-green-100 text-green-800',
      card: 'bg-blue-100 text-blue-800',
      digital: 'bg-purple-100 text-purple-800',
      bank_transfer: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`inline-flex px-2.5 py-1 text-[11px] font-bold rounded-full ${styles[method] || 'bg-gray-100 text-gray-800'}`}>
        {method.replace('_', ' ')}
      </span>
    );
  };

  const printColumns: PrintColumn<Expense>[] = [
    { key: 'date', header: 'Date', accessor: (e) => format(new Date(e.date), 'yyyy-MM-dd'), width: '11%' },
    { key: 'category', header: 'Category', accessor: (e) => e.category, width: '13%' },
    { key: 'description', header: 'Description', accessor: (e) => e.description, width: '24%' },
    { key: 'payment', header: 'Payment', accessor: (e) => e.paymentMethod.charAt(0).toUpperCase() + e.paymentMethod.slice(1).replace('_', ' '), width: '12%' },
    { key: 'amount', header: 'Amount', accessor: (e) => `${state.settings.currency} ${e.amount.toFixed(2)}`, width: '11%', align: 'right' },
    { key: 'supplier', header: 'Supplier', accessor: (e) => e.supplierName || '—', width: '15%' },
    { key: 'receipt', header: 'Receipt #', accessor: (e) => e.receiptNumber || '—', width: '14%' },
  ];

  const filteredSummary = useMemo(() => {
    const total = filteredExpenses.reduce((s, e) => s + e.amount, 0);
    const categoryCount = new Set(filteredExpenses.map(e => e.category)).size;
    return { total, count: filteredExpenses.length, categoryCount };
  }, [filteredExpenses]);

  const printSummaries: PrintSummary[] = [
    { label: 'Total Expenses', value: `${state.settings.currency} ${filteredSummary.total.toFixed(2)}`, highlight: true },
    { label: 'Transactions', value: String(filteredSummary.count) },
    { label: 'Categories Used', value: String(filteredSummary.categoryCount) },
    { label: 'Avg/Transaction', value: `${state.settings.currency} ${filteredSummary.count ? (filteredSummary.total / filteredSummary.count).toFixed(2) : '0.00'}` },
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
        return 'Custom Range';
      default: return 'All Time';
    }
  };

  const printFilters: PrintFilterInfo[] = [
    { label: 'Date', value: getDateFilterLabel() },
    ...(categoryFilter !== 'all' ? [{ label: 'Category', value: categoryFilter }] : []),
    ...(paymentFilter !== 'all' ? [{ label: 'Payment', value: paymentFilter.charAt(0).toUpperCase() + paymentFilter.slice(1).replace('_', ' ') }] : []),
    ...(searchTerm ? [{ label: 'Search', value: searchTerm }] : []),
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Expense Tracking</h1>
          <p className="text-gray-600 mt-1">Monitor and categorize all business expenses</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowPrintModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium"
          >
            <Printer className="h-4 w-4" />
            <span>Print PDF</span>
          </button>
          <button
            onClick={exportExpenses}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleAdd}
            disabled={!canEdit}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium shadow-lg transition-all ${
              canEdit
                ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white hover:from-rose-700 hover:to-pink-700 hover:shadow-xl'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Plus className="h-4 w-4" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-gradient-to-r from-rose-500 to-pink-500 p-4 md:p-6 rounded-2xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-rose-100 text-sm font-medium">All-Time Expenses</p>
              <p className="text-xl md:text-2xl font-bold">{state.settings.currency} {summary.total.toFixed(2)}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-4 md:p-6 rounded-2xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium">This Month</p>
              <p className="text-xl md:text-2xl font-bold">{state.settings.currency} {summary.thisMonth.toFixed(2)}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <Calendar className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-4 md:p-6 rounded-2xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm font-medium">Total Records</p>
              <p className="text-xl md:text-2xl font-bold">{summary.count}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-violet-500 to-indigo-500 p-4 md:p-6 rounded-2xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-violet-100 text-sm font-medium">Top Category</p>
              <p className="text-xl md:text-2xl font-bold truncate max-w-36">
                {summary.topCategory ? summary.topCategory[0] : 'N/A'}
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <PieChart className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search by description, category, receipt, supplier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="relative">
            <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent appearance-none"
            >
              <option value="all">All Categories</option>
              {DEFAULT_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <CalendarRange className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value)}
              className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent appearance-none"
            >
              <option value="all">📅 All Dates</option>
              <option value="today">🗓️ Today</option>
              <option value="week">📆 This Week</option>
              <option value="month">📊 This Month</option>
              <option value="last_month">📅 Last Month</option>
              <option value="last_3_months">📈 Last 3 Months</option>
              <option value="year">🗃️ This Year</option>
              <option value="custom">🎯 Custom Range...</option>
            </select>
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent appearance-none"
            >
              <option value="all">All Payments</option>
              {['cash', 'card', 'digital', 'bank_transfer'].map(m => (
                <option key={m} value={m} className="capitalize">{m.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        {datePreset === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <input
                type="date"
                value={customFromDate}
                onChange={(e) => setCustomFromDate(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent text-sm"
                placeholder="From Date"
              />
            </div>
            <div>
              <input
                type="date"
                value={customToDate}
                onChange={(e) => setCustomToDate(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent text-sm"
                placeholder="To Date"
              />
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">Category</th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell">Payment</th>
                <th className="px-4 md:px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Amount</th>
                <th className="px-4 md:px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <AlertTriangle className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No expenses found</h3>
                    <p className="text-gray-500 mb-4">
                      {searchTerm || categoryFilter !== 'all' || datePreset !== 'all'
                        ? 'Try adjusting your search filters'
                        : 'Start tracking your expenses to see them here'}
                    </p>
                    {canEdit && (
                      <button
                        onClick={handleAdd}
                        className="inline-flex items-center space-x-2 px-5 py-2 bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-xl font-medium hover:from-rose-700 hover:to-pink-700 transition-all"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Record First Expense</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredExpenses.map(expense => (
                  <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {format(new Date(expense.date), 'MMM dd')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {format(new Date(expense.date), 'yyyy')}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <div className="text-sm font-semibold text-gray-900">{expense.description}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded border ${categoryColors[expense.category] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                          {expense.category}
                        </span>
                        {expense.receiptNumber && (
                          <span className="inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600">
                            # {expense.receiptNumber}
                          </span>
                        )}
                        {expense.supplierName && (
                          <span className="inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-600">
                            {expense.supplierName}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                      <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-xl border ${categoryColors[expense.category] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                      {methodBadge(expense.paymentMethod)}
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-bold text-gray-900">
                        {state.settings.currency} {expense.amount.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => handleEdit(expense)}
                          disabled={!canEdit}
                          className={`p-2 rounded-lg transition-colors ${
                            canEdit ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-300 cursor-not-allowed'
                          }`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(expense)}
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
            {filteredExpenses.length > 0 && (
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td colSpan={4} className="px-4 md:px-6 py-4 text-right text-sm text-gray-600">
                    Total for filtered results:
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right">
                    <span className="text-base font-bold text-rose-600">
                      {state.settings.currency} {summary.filteredTotal.toFixed(2)}
                    </span>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <ExpenseModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingExpense(null); }}
        onSave={handleSave}
        editingExpense={editingExpense}
      />

      <TablePrintModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="Expense Report"
        subtitle="Business expenses with applied date, category, and payment filters"
        columns={printColumns}
        data={filteredExpenses}
        summaries={printSummaries}
        filters={printFilters}
        orientation="landscape"
      />
    </div>
  );
}

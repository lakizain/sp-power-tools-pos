import React, { useState, useMemo } from 'react';
import {
  Search, Plus, Edit2, Trash2, Download, Filter, X,
  CalendarDays, CreditCard, Users, AlertCircle, KeyRound,
  CheckCircle2, Clock, AlertTriangle, RotateCcw, Printer, CalendarRange
} from 'lucide-react';
import { useApp, useFeatureToggles } from '../../context/SupabaseAppContext';
import { useAuth } from '../../context/AuthContext';
import { Rental, RentalItem, ReturnItem, ProductReturn } from '../../types';
import { swalConfig } from '../../lib/sweetAlert';
import { matchesAnyField, sortBySearchRelevance } from '../../lib/searchUtils';
import { RentalModal } from './RentalModal';
import { ReturnModal } from '../returns/ReturnModal';
import { format, isBefore, differenceInDays, startOfMonth, endOfMonth, isWithinInterval, subMonths, startOfWeek } from 'date-fns';
import { TablePrintModal, PrintColumn, PrintSummary, PrintFilterInfo } from '../ui/TablePrintModal';

export function RentalsManager() {
  const { state, dispatch } = useApp();
  const features = useFeatureToggles();
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Rental['status'] | 'all'>('all');
  const [datePreset, setDatePreset] = useState('all');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingRental, setEditingRental] = useState<Rental | null>(null);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [rentalForReturn, setRentalForReturn] = useState<Rental | null>(null);

  const canEdit = features.productRentals && (profile?.role === 'admin' || profile?.role === 'manager');

  const list = useMemo(() => {
    const now = new Date();
    const mapped = state.rentals.map(rental => {
      let computedStatus: Rental['status'] = rental.status;
      if ((rental.status === 'active') && isBefore(new Date(rental.rentTo), now)) {
        computedStatus = 'overdue';
      }
      const daysOverdue = computedStatus === 'overdue' ? differenceInDays(now, new Date(rental.rentTo)) : 0;
      const daysRented = Math.max(1, differenceInDays(new Date(rental.rentTo), new Date(rental.rentFrom)) + 1);
      const balance = Math.max(0, rental.totalRent - rental.paidAmount);
      return { ...rental, computedStatus, daysOverdue, daysRented, balance };
    });
    const filtered = mapped.filter(rental => {
      const matchesSearch = matchesAnyField(
        [
          rental.rentalNumber,
          rental.customerName,
          rental.notes,
          ...rental.items.map(i => `${i.productName} ${i.sku}`),
        ],
        searchTerm
      );
      const matchesStatus = statusFilter === 'all' || rental.computedStatus === statusFilter;

      let matchesDate = true;
      const targetDate = new Date(rental.createdAt);
      if (datePreset === 'custom') {
        if (customFromDate) {
          const from = new Date(customFromDate);
          from.setHours(0, 0, 0, 0);
          matchesDate = matchesDate && targetDate >= from;
        }
        if (customToDate) {
          const to = new Date(customToDate);
          to.setHours(23, 59, 59, 999);
          matchesDate = matchesDate && targetDate <= to;
        }
      } else if (datePreset !== 'all') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        switch (datePreset) {
          case 'today': {
            const tStart = new Date(today);
            const tEnd = new Date(today);
            tEnd.setHours(23, 59, 59, 999);
            matchesDate = targetDate >= tStart && targetDate <= tEnd;
            break;
          }
          case 'week': {
            const ws = startOfWeek(today, { weekStartsOn: 1 });
            const we = new Date();
            we.setHours(23, 59, 59, 999);
            matchesDate = targetDate >= ws && targetDate <= we;
            break;
          }
          case 'month': {
            matchesDate = targetDate >= startOfMonth(today) && targetDate <= endOfMonth(today);
            break;
          }
          case 'last_month': {
            const last = subMonths(today, 1);
            matchesDate = targetDate >= startOfMonth(last) && targetDate <= endOfMonth(last);
            break;
          }
          case 'last_3_months': {
            const threeAgo = subMonths(today, 3);
            const nowEnd = new Date();
            nowEnd.setHours(23, 59, 59, 999);
            matchesDate = targetDate >= startOfMonth(threeAgo) && targetDate <= nowEnd;
            break;
          }
          case 'year': {
            const ys = new Date(today.getFullYear(), 0, 1);
            const ye = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
            matchesDate = targetDate >= ys && targetDate <= ye;
            break;
          }
        }
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
    const sorted = sortBySearchRelevance(
      filtered,
      searchTerm,
      r => `${r.rentalNumber} ${r.customerName || ''} ${r.notes || ''}`
    );
    if (!searchTerm) {
      return sorted.sort((a, b) => {
        const statusOrder: Record<string, number> = { overdue: 0, active: 1, damaged: 2, lost: 3, returned: 4 };
        if (statusOrder[a.computedStatus] !== statusOrder[b.computedStatus]) {
          return statusOrder[a.computedStatus] - statusOrder[b.computedStatus];
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }
    return sorted;
  }, [state.rentals, searchTerm, statusFilter, datePreset, customFromDate, customToDate]);

  const summary = useMemo(() => {
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);

    let activeCount = 0;
    let overdueCount = 0;
    let thisMonthRent = 0;
    let totalDeposits = 0;

    state.rentals.forEach(rental => {
      let computedStatus: Rental['status'] = rental.status;
      if ((rental.status === 'active') && isBefore(new Date(rental.rentTo), now)) {
        computedStatus = 'overdue';
      }
      if (computedStatus === 'active') activeCount++;
      if (computedStatus === 'overdue') overdueCount++;
      totalDeposits += rental.securityDeposit;
      if (isWithinInterval(new Date(rental.createdAt), { start: thisMonthStart, end: thisMonthEnd })) {
        thisMonthRent += rental.totalRent;
      }
    });

    return { activeCount, overdueCount, thisMonthRent, totalDeposits, totalCount: state.rentals.length };
  }, [state.rentals]);

  const handleRentalSaved = (rental: Rental) => {
    if (editingRental) {
      dispatch({ type: 'UPDATE_RENTAL', payload: rental });
      swalConfig.success('Rental updated successfully.');
    } else {
      dispatch({ type: 'ADD_RENTAL', payload: rental });
      swalConfig.success('Rental created successfully.');
    }
    resetRentalModal();
  };

  const resetRentalModal = () => {
    setIsAddOpen(false);
    setEditingRental(null);
  };

  const handleEdit = (rental: Rental) => {
    if (!canEdit) { swalConfig.error('Permission denied.'); return; }
    setEditingRental(rental);
    setIsAddOpen(true);
  };

  const handleDelete = async (rental: Rental) => {
    if (!canEdit) { swalConfig.error('Permission denied.'); return; }
    const res = await swalConfig.confirm(
      'Delete Rental Record?',
      `Delete Rental #${rental.rentalNumber} for ${rental.customerName || 'Unknown'}?`,
      'Delete'
    );
    if (res.isConfirmed) {
      dispatch({ type: 'DELETE_RENTAL', payload: rental.id });
      swalConfig.success('Rental removed.');
    }
  };

  const handleMarkReturned = (rental: Rental) => {
    if (!canEdit) { swalConfig.error('Permission denied.'); return; }
    if (rental.status === 'returned') {
      swalConfig.info('This rental is already marked as returned.');
      return;
    }
    setRentalForReturn(rental);
    setIsReturnOpen(true);
  };

  const handleReturnSaved = (returnRecord: ProductReturn) => {
    if (!rentalForReturn) return;
    const now = new Date();
    const updatedRental: Rental = {
      ...rentalForReturn,
      status: 'returned',
      updatedAt: now,
    };
    dispatch({ type: 'UPDATE_RENTAL', payload: updatedRental });
    swalConfig.success(`Rental #${rentalForReturn.rentalNumber} marked as returned. Items restocked.`);
    setIsReturnOpen(false);
    setRentalForReturn(null);
  };

  const exportData = () => {
    const csvContent = [
      ['Rental #', 'Customer', 'Items Count', 'Rent From', 'Rent To', 'Status', 'Total Rent', 'Paid', 'Balance', 'Deposit', 'Notes'].join(','),
      ...list.map(rental => {
        const anyRental = rental as any;
        return [
          rental.rentalNumber,
          `"${(rental.customerName || 'Unknown').replace(/"/g, '""')}"`,
          rental.items.length,
          format(new Date(rental.rentFrom), 'yyyy-MM-dd'),
          format(new Date(rental.rentTo), 'yyyy-MM-dd'),
          anyRental.computedStatus,
          rental.totalRent.toFixed(2),
          rental.paidAmount.toFixed(2),
          anyRental.balance.toFixed(2),
          rental.securityDeposit.toFixed(2),
          `"${(rental.notes || '').replace(/"/g, '""')}"`,
        ].join(',');
      })
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `rentals_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const statusBadge = (status: Rental['status']) => {
    const map: Record<Rental['status'], string> = {
      active: 'bg-emerald-100 text-emerald-800',
      overdue: 'bg-rose-100 text-rose-800',
      returned: 'bg-blue-100 text-blue-800',
      lost: 'bg-red-100 text-red-800',
      damaged: 'bg-amber-100 text-amber-800',
    };
    const icons: Record<Rental['status'], React.ReactNode> = {
      active: <Clock className="h-3 w-3" />,
      overdue: <AlertTriangle className="h-3 w-3" />,
      returned: <CheckCircle2 className="h-3 w-3" />,
      lost: <AlertCircle className="h-3 w-3" />,
      damaged: <AlertCircle className="h-3 w-3" />,
    };
    return (
      <span className={`inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold rounded-full capitalize ${map[status]}`}>
        {icons[status]}
        <span>{status}</span>
      </span>
    );
  };

  const renderRentalForReturn = () => {
    if (!rentalForReturn) return null;
    const returnItems: ReturnItem[] = rentalForReturn.items.map(ri => ({
      productId: ri.productId,
      productName: ri.productName,
      sku: ri.sku,
      quantity: ri.quantity,
      unitPrice: 0,
      subtotal: 0,
      condition: 'used' as ReturnItem['condition'],
      reason: 'Rental Item Returned',
    }));
    const fakeSaleForReturn = {
      id: `rental-${rentalForReturn.id}`,
      invoiceNumber: `RENTAL-${rentalForReturn.rentalNumber}`,
      customerId: rentalForReturn.customerId || '',
      customerName: rentalForReturn.customerName || '',
      items: returnItems.map(ri => ({
        id: ri.productId,
        productId: ri.productId,
        productName: ri.productName,
        sku: ri.sku,
        quantity: ri.quantity,
        subtotal: 0,
        unitPrice: 0,
      })) as any,
      paymentMethod: 'cash',
      totalAmount: 0,
      amountPaid: 0,
      createdAt: rentalForReturn.createdAt,
    } as any;
    return { fakeSaleForReturn, returnItems };
  };

  const preparedForReturn = rentalForReturn ? renderRentalForReturn() : null;

  const printColumns: PrintColumn<any>[] = [
    { key: 'rentalNumber', header: 'Rental #', accessor: (r) => r.rentalNumber, width: '10%' },
    { key: 'customer', header: 'Customer', accessor: (r) => r.customerName || '—', width: '15%' },
    { key: 'items', header: 'Items', accessor: (r) => `${r.items.length} item${r.items.length !== 1 ? 's' : ''}`, width: '8%' },
    { key: 'rentFrom', header: 'Rent From', accessor: (r) => format(new Date(r.rentFrom), 'yyyy-MM-dd'), width: '10%' },
    { key: 'rentTo', header: 'Rent To', accessor: (r) => format(new Date(r.rentTo), 'yyyy-MM-dd'), width: '10%' },
    { key: 'status', header: 'Status', accessor: (r) => {
      const computed = (r as any).computedStatus;
      return computed.charAt(0).toUpperCase() + computed.slice(1);
    }, width: '9%' },
    { key: 'totalRent', header: 'Total Rent', accessor: (r) => `${state.settings.currency} ${r.totalRent.toFixed(2)}`, width: '10%', align: 'right' },
    { key: 'paid', header: 'Paid', accessor: (r) => `${state.settings.currency} ${r.paidAmount.toFixed(2)}`, width: '10%', align: 'right' },
    { key: 'balance', header: 'Balance', accessor: (r) => `${state.settings.currency} ${(r as any).balance.toFixed(2)}`, width: '9%', align: 'right' },
    { key: 'deposit', header: 'Deposit', accessor: (r) => `${state.settings.currency} ${r.securityDeposit.toFixed(2)}`, width: '9%', align: 'right' },
  ];

  const filteredSummary = useMemo(() => {
    const totalRent = list.reduce((s, r) => s + r.totalRent, 0);
    const totalPaid = list.reduce((s, r) => s + r.paidAmount, 0);
    const totalDeposit = list.reduce((s, r) => s + r.securityDeposit, 0);
    const totalBalance = list.reduce((s, r: any) => s + (r.balance || 0), 0);
    const activeCount = list.filter((r: any) => r.computedStatus === 'active').length;
    const overdueCount = list.filter((r: any) => r.computedStatus === 'overdue').length;
    return { totalRent, totalPaid, totalDeposit, totalBalance, activeCount, overdueCount, count: list.length };
  }, [list]);

  const printSummaries: PrintSummary[] = [
    { label: 'Total Rentals', value: String(filteredSummary.count), highlight: true },
    { label: 'Total Rent', value: `${state.settings.currency} ${filteredSummary.totalRent.toFixed(2)}` },
    { label: 'Collected', value: `${state.settings.currency} ${filteredSummary.totalPaid.toFixed(2)}` },
    { label: 'Balance Due', value: `${state.settings.currency} ${filteredSummary.totalBalance.toFixed(2)}` },
  ];

  const getDateFilterLabel = (): string => {
    switch (datePreset) {
      case 'all': return 'All Rentals';
      case 'today': return 'Created Today';
      case 'week': return 'Created This Week';
      case 'month': return 'Created This Month';
      case 'last_month': return 'Created Last Month';
      case 'last_3_months': return 'Last 3 Months';
      case 'year': return 'Created This Year';
      case 'custom':
        if (customFromDate && customToDate) return `${customFromDate} → ${customToDate}`;
        if (customFromDate) return `From ${customFromDate}`;
        if (customToDate) return `Up to ${customToDate}`;
        return 'Custom Range';
      default: return 'All Rentals';
    }
  };

  const statusFilterLabel = statusFilter === 'all' ? 'All' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1);

  const printFilters: PrintFilterInfo[] = [
    { label: 'Date', value: getDateFilterLabel() },
    ...(statusFilter !== 'all' ? [{ label: 'Status', value: statusFilterLabel }] : []),
    ...(searchTerm ? [{ label: 'Search', value: searchTerm }] : []),
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center space-x-3">
            <KeyRound className="h-8 w-8 text-violet-600" />
            <span>Product Rentals</span>
          </h1>
          <p className="text-gray-600 mt-1">Track rented items, customers, rental periods, and returns</p>
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
            onClick={exportData}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
          {canEdit && (
            <button
              onClick={() => { setEditingRental(null); setIsAddOpen(true); }}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-violet-500/30 transition-all font-medium"
            >
              <Plus className="h-4 w-4" />
              <span>New Rental</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-5 rounded-2xl shadow-lg shadow-emerald-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-50/80 text-xs font-semibold uppercase tracking-wide">Active Rentals</p>
              <p className="text-3xl font-black mt-2">{summary.activeCount}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <Clock className="h-6 w-6" />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-rose-500 to-red-600 text-white p-5 rounded-2xl shadow-lg shadow-rose-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-rose-50/80 text-xs font-semibold uppercase tracking-wide">Overdue</p>
              <p className="text-3xl font-black mt-2">{summary.overdueCount}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white p-5 rounded-2xl shadow-lg shadow-amber-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-50/80 text-xs font-semibold uppercase tracking-wide">This Month Rent</p>
              <p className="text-3xl font-black mt-2">{state.settings.currency} {summary.thisMonthRent.toFixed(2)}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <CreditCard className="h-6 w-6" />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-violet-500 to-purple-600 text-white p-5 rounded-2xl shadow-lg shadow-violet-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-violet-50/80 text-xs font-semibold uppercase tracking-wide">Deposits Held</p>
              <p className="text-3xl font-black mt-2">{state.settings.currency} {summary.totalDeposits.toFixed(2)}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <KeyRound className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search rental number, customer name, or notes..."
              className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full md:w-64 pl-9 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent appearance-none text-sm"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="overdue">Overdue</option>
              <option value="returned">Returned</option>
              <option value="lost">Lost</option>
              <option value="damaged">Damaged</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'active', 'overdue', 'returned', 'lost'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all capitalize ${
                statusFilter === s
                  ? s === 'all' ? 'bg-gray-900 text-white shadow'
                  : s === 'active' ? 'bg-emerald-500 text-white shadow'
                  : s === 'overdue' ? 'bg-rose-500 text-white shadow'
                  : s === 'returned' ? 'bg-blue-500 text-white shadow'
                  : 'bg-red-500 text-white shadow'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {s === 'all' ? `All (${summary.totalCount})` : s}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-gray-100">
          <div className="md:col-span-1 relative">
            <CalendarRange className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent appearance-none text-sm"
            >
              <option value="all">📅 All Time</option>
              <option value="today">🗓️ Created Today</option>
              <option value="week">📆 Created This Week</option>
              <option value="month">📊 Created This Month</option>
              <option value="last_month">📅 Created Last Month</option>
              <option value="last_3_months">📈 Last 3 Months</option>
              <option value="year">🗃️ Created This Year</option>
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
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <input
                  type="date"
                  value={customToDate}
                  onChange={(e) => setCustomToDate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Rental # / Date</th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Customer</th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">Items</th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell">Rent Period</th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 md:px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">Finances</th>
                <th className="px-4 md:px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {list.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <KeyRound className="h-16 w-16 text-gray-300 mb-4" />
                      <p className="text-gray-500 font-semibold">No rentals found</p>
                      <p className="text-gray-400 text-sm mt-1">
                        {searchTerm || statusFilter !== 'all'
                          ? 'Try adjusting search or filters'
                          : 'Click "New Rental" to create your first rental record'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                list.map(rental => {
                  const anyRental = rental as any;
                  return (
                    <tr key={rental.id} className="hover:bg-violet-50/30 transition-colors">
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-gray-900 text-sm">{rental.rentalNumber}</div>
                        <div className="text-xs text-gray-500 mt-0.5 flex items-center">
                          <CalendarDays className="h-3 w-3 mr-1" />
                          {format(new Date(rental.createdAt), 'yyyy-MM-dd • h:mm a')}
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="bg-gradient-to-br from-violet-100 to-purple-100 p-2 rounded-xl">
                            <Users className="h-4 w-4 text-violet-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 text-sm">{rental.customerName || 'Unknown Customer'}</div>
                            <div className="text-xs text-gray-500 mt-0.5">Balance: {state.settings.currency} {anyRental.balance.toFixed(2)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-4 hidden md:table-cell">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{rental.items.length} item{rental.items.length !== 1 ? 's' : ''}</div>
                          <div className="text-xs text-gray-500 mt-1 max-w-xs truncate">
                            {rental.items.map(i => i.productName).slice(0, 2).join(', ')}{rental.items.length > 2 ? ` +${rental.items.length - 2} more` : ''}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            Qty: {rental.items.reduce((s, i) => s + i.quantity, 0)} total
                          </div>
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-4 hidden lg:table-cell">
                        <div className="text-xs">
                          <div className="flex items-center text-gray-700">
                            <span className="font-semibold">From:</span>
                            <span className="ml-2 text-gray-600">{format(new Date(rental.rentFrom), 'yyyy-MM-dd')}</span>
                          </div>
                          <div className="flex items-center text-gray-700 mt-1">
                            <span className="font-semibold">To:</span>
                            <span className="ml-2 text-gray-600">{format(new Date(rental.rentTo), 'yyyy-MM-dd')}</span>
                          </div>
                          <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-gray-700">
                            <Clock className="h-3 w-3 mr-1" />
                            {anyRental.daysRented} day{anyRental.daysRented !== 1 ? 's' : ''}
                            {anyRental.computedStatus === 'overdue' && (
                              <span className="ml-2 text-rose-600 font-bold">
                                +{anyRental.daysOverdue}d overdue
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        {statusBadge(anyRental.computedStatus)}
                      </td>
                      <td className="px-4 md:px-6 py-4 hidden md:table-cell text-right text-xs">
                        <div className="space-y-1">
                          <div className="flex justify-between text-gray-700">
                            <span>Total Rent:</span>
                            <span className="font-bold ml-3">{state.settings.currency} {rental.totalRent.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-emerald-700">
                            <span>Paid:</span>
                            <span className="font-bold ml-3">{state.settings.currency} {rental.paidAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-rose-700">
                            <span>Balance:</span>
                            <span className="font-bold ml-3">{state.settings.currency} {anyRental.balance.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-violet-700 pt-1 border-t border-gray-100">
                            <span>Deposit:</span>
                            <span className="font-bold ml-3">{state.settings.currency} {rental.securityDeposit.toFixed(2)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center space-x-1.5">
                          {anyRental.computedStatus !== 'returned' && (
                            <button
                              onClick={() => handleMarkReturned(rental)}
                              disabled={!canEdit}
                              className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Mark as Returned (Restock items)"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(rental)}
                            disabled={!canEdit}
                            className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Edit Rental"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(rental)}
                            disabled={!canEdit}
                            className="p-2 text-rose-600 hover:bg-rose-100 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete Rental"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RentalModal
        isOpen={isAddOpen}
        onClose={resetRentalModal}
        onSave={handleRentalSaved}
        editingRental={editingRental}
      />

      {preparedForReturn && (
        <ReturnModal
          isOpen={isReturnOpen}
          onClose={() => { setIsReturnOpen(false); setRentalForReturn(null); }}
          onSave={handleReturnSaved}
          fromSale={preparedForReturn.fakeSaleForReturn}
          initialReturnMethod="rental_return"
        />
      )}

      <TablePrintModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="Product Rentals Report"
        subtitle="Rental contracts, customers, periods, and financial status"
        columns={printColumns}
        data={list}
        summaries={printSummaries}
        filters={printFilters}
        orientation="landscape"
      />
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import {
  Search, Plus, Trash2, Download, KeyRound,
  CreditCard, Printer, CalendarRange
} from 'lucide-react';
import { useApp, useFeatureToggles } from '../../context/SupabaseAppContext';
import { useAuth } from '../../context/AuthContext';
import { Rental } from '../../types';
import { swalConfig } from '../../lib/sweetAlert';
import { matchesAnyField, sortBySearchRelevance } from '../../lib/searchUtils';
import { rentalsService } from '../../lib/services';
import { RentalModal } from './RentalModal';
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths, startOfWeek } from 'date-fns';
import { TablePrintModal, PrintColumn, PrintSummary, PrintFilterInfo } from '../ui/TablePrintModal';

export function RentalsManager() {
  const { state, dispatch } = useApp();
  const features = useFeatureToggles();
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const canEdit = features.productRentals && (profile?.role === 'admin' || profile?.role === 'manager');

  const list = useMemo(() => {
    const filtered = state.rentals.filter(rental => {
      const matchesSearch = matchesAnyField(
        [
          rental.rentalNumber,
          rental.customerName,
          rental.notes,
          ...rental.items.map(i => `${i.productName} ${i.sku}`),
        ],
        searchTerm
      );
      let matchesDate = true;
      const targetDate = new Date(rental.rentFrom);
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

      return matchesSearch && matchesDate;
    });
    const sorted = sortBySearchRelevance(
      filtered,
      searchTerm,
      r => `${r.rentalNumber} ${r.customerName || ''} ${r.notes || ''}`
    );
    if (!searchTerm) {
      return sorted.sort((a, b) => new Date(b.rentFrom).getTime() - new Date(a.rentFrom).getTime());
    }
    return sorted;
  }, [state.rentals, searchTerm, datePreset, customFromDate, customToDate]);

  const summary = useMemo(() => {
    const today = new Date();
    const thisMonthStart = startOfMonth(today);
    const thisMonthEnd = endOfMonth(today);
    let thisMonthRent = 0;
    let totalAmount = 0;

    state.rentals.forEach(rental => {
      totalAmount += rental.totalRent;
      if (isWithinInterval(new Date(rental.rentFrom), { start: thisMonthStart, end: thisMonthEnd })) {
        thisMonthRent += rental.totalRent;
      }
    });

    return { thisMonthRent, totalAmount, totalCount: state.rentals.length };
  }, [state.rentals]);

  const handleRentalSaved = async (rental: Rental) => {
    try {
      const savedRental = await rentalsService.create(rental);
      dispatch({ type: 'ADD_RENTAL', payload: savedRental });
      swalConfig.success('Rental amount saved successfully.');
      resetRentalModal();
    } catch (error: any) {
      console.error('Failed to save rental:', error);
      swalConfig.error(error?.message || 'Could not save rental. Please try again.');
    }
  };

  const resetRentalModal = () => {
    setIsAddOpen(false);
  };

  const handleDelete = async (rental: Rental) => {
    if (!canEdit) { swalConfig.error('Permission denied.'); return; }
    const res = await swalConfig.confirm(
      'Delete Rental Record?',
      `Delete the rental amount of ${state.settings.currency} ${rental.totalRent.toFixed(2)}?`,
      'Delete'
    );
    if (res.isConfirmed) {
      try {
        await rentalsService.delete(rental.id);
        dispatch({ type: 'DELETE_RENTAL', payload: rental.id });
        swalConfig.success('Rental removed.');
      } catch (error: any) {
        console.error('Failed to delete rental:', error);
        swalConfig.error(error?.message || 'Could not delete rental. Please try again.');
      }
    }
  };

  const exportData = () => {
    const csvContent = [
      ['Date', 'Amount', 'Notes'].join(','),
      ...list.map(rental => {
        const anyRental = rental as any;
        return [
          format(new Date(rental.rentFrom), 'yyyy-MM-dd'),
          rental.totalRent.toFixed(2),
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

  const printColumns: PrintColumn<any>[] = [
    { key: 'date', header: 'Date', accessor: (r) => format(new Date(r.rentFrom), 'yyyy-MM-dd'), width: '15%' },
    { key: 'total', header: 'Total', accessor: (r) => `${state.settings.currency} ${r.totalRent.toFixed(2)}`, width: '20%', align: 'right' },
  ];

  const filteredSummary = useMemo(() => {
    const totalRent = list.reduce((s, r) => s + r.totalRent, 0);
    return { totalRent, count: list.length };
  }, [list]);

  const printSummaries: PrintSummary[] = [
    { label: 'Total Rentals', value: String(filteredSummary.count), highlight: true },
    { label: 'Total Rent', value: `${state.settings.currency} ${filteredSummary.totalRent.toFixed(2)}` },
  ];

  const getDateFilterLabel = (): string => {
    switch (datePreset) {
      case 'all': return 'All Rentals';
      case 'today': return 'Rental Date Today';
      case 'week': return 'Rental Dates This Week';
      case 'month': return 'Rental Dates This Month';
      case 'last_month': return 'Rental Dates Last Month';
      case 'last_3_months': return 'Last 3 Months';
      case 'year': return 'Rental Dates This Year';
      case 'custom':
        if (customFromDate && customToDate) return `${customFromDate} → ${customToDate}`;
        if (customFromDate) return `From ${customFromDate}`;
        if (customToDate) return `Up to ${customToDate}`;
        return 'Custom Range';
      default: return 'All Rentals';
    }
  };

  const printFilters: PrintFilterInfo[] = [
    { label: 'Date', value: getDateFilterLabel() },
    ...(searchTerm ? [{ label: 'Search', value: searchTerm }] : []),
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center space-x-3">
            <KeyRound className="h-8 w-8 text-violet-600" />
            <span>Daily Product Rentals</span>
          </h1>
          <p className="text-gray-600 mt-1">Save and track the amount collected for each rental date</p>
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
              onClick={() => setIsAddOpen(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-violet-500/30 transition-all font-medium"
            >
              <Plus className="h-4 w-4" />
              <span>New Rental</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <p className="text-violet-50/80 text-xs font-semibold uppercase tracking-wide">Total Amount</p>
              <p className="text-3xl font-black mt-2">{state.settings.currency} {summary.totalAmount.toFixed(2)}</p>
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
              placeholder="Search rental number or notes..."
              className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
            />
          </div>
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
              <option value="today">🗓️ Rental Date Today</option>
              <option value="week">📆 Rental Dates This Week</option>
              <option value="month">📊 Rental Dates This Month</option>
              <option value="last_month">📅 Rental Dates Last Month</option>
              <option value="last_3_months">📈 Last 3 Months</option>
              <option value="year">🗃️ Rental Dates This Year</option>
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
            <thead className="bg-slate-100">
              <tr>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Date</th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Total</th>
                <th className="px-4 md:px-6 py-4 text-right text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {list.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <KeyRound className="h-16 w-16 text-slate-300 mb-4" />
                      <p className="text-slate-500 font-semibold">No rentals found</p>
                      <p className="text-slate-400 text-sm mt-1">
                        {searchTerm || datePreset !== 'all'
                          ? 'Try adjusting search or filters'
                          : 'Click "New Rental" to create your first daily rental record'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                list.map(rental => (
                    <tr key={rental.id} className="hover:bg-violet-50/40 transition-colors">
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900 text-sm">{format(new Date(rental.rentFrom), 'yyyy-MM-dd')}</div>
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        <div className="font-black text-violet-700 text-lg">
                          {state.settings.currency} {rental.totalRent.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center justify-end space-x-1.5">
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
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RentalModal
        isOpen={isAddOpen}
        onClose={resetRentalModal}
        onSave={handleRentalSaved}
      />

      <TablePrintModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="Daily Product Rentals Report"
        subtitle="Daily rental dates and collected amounts"
        columns={printColumns}
        data={list}
        summaries={printSummaries}
        filters={printFilters}
        orientation="landscape"
      />
    </div>
  );
}

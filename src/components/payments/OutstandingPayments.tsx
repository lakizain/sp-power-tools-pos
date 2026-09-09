import React, { useState, useMemo } from 'react';
import {
  Search, Plus, Edit2, Trash2, Download, Filter, X,
  DollarSign, AlertTriangle, CheckCircle2, Clock,
  CalendarDays, CreditCard, Users, AlertCircle
} from 'lucide-react';
import { useApp, useFeatureToggles } from '../../context/SupabaseAppContext';
import { useAuth } from '../../context/AuthContext';
import { OutstandingPayment, PaymentRecord } from '../../types';
import { swalConfig } from '../../lib/sweetAlert';
import { PaymentModal } from './PaymentModal';
import { format, isBefore, isToday, differenceInDays } from 'date-fns';

export function OutstandingPayments() {
  const { state, dispatch } = useApp();
  const features = useFeatureToggles();
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [overdueFilter, setOverdueFilter] = useState('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<OutstandingPayment | null>(null);
  const [paymentFor, setPaymentFor] = useState<OutstandingPayment | null>(null);
  const [addForm, setAddForm] = useState({
    customerId: '',
    customerName: '',
    saleId: '',
    invoiceNumber: '',
    totalAmount: '',
    paidAmount: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
  });

  const canEdit = features.outstandingPayments && (profile?.role === 'admin' || profile?.role === 'manager');

  const list = useMemo(() => {
    const now = new Date();
    return state.outstandingPayments.map(op => {
      const isOverdue = op.status !== 'paid' && isBefore(new Date(op.dueDate), now) && !isToday(new Date(op.dueDate));
      const daysOverdue = isOverdue ? differenceInDays(now, new Date(op.dueDate)) : 0;
      return { ...op, isOverdue, daysOverdue };
    }).filter(op => {
      const matchesSearch =
        op.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.customerName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || op.status === statusFilter;
      const matchesOverdue =
        overdueFilter === 'all' ||
        (overdueFilter === 'overdue' && op.isOverdue) ||
        (overdueFilter === 'due_today' && isToday(new Date(op.dueDate)) && op.status !== 'paid');
      return matchesSearch && matchesStatus && matchesOverdue;
    }).sort((a, b) => {
      // Show overdue first, then by due date
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [state.outstandingPayments, searchTerm, statusFilter, overdueFilter]);

  const summary = useMemo(() => {
    const total = state.outstandingPayments.reduce((s, o) => s + o.totalAmount, 0);
    const paid = state.outstandingPayments.reduce((s, o) => s + o.paidAmount, 0);
    const overdue = state.outstandingPayments.filter(o => {
      const now = new Date();
      return o.status !== 'paid' && isBefore(new Date(o.dueDate), now) && !isToday(new Date(o.dueDate));
    });
    const overdueAmount = overdue.reduce((s, o) => s + o.outstandingAmount, 0);
    const countPaid = state.outstandingPayments.filter(o => o.status === 'paid').length;
    return { total, paid, outstanding: total - paid, overdueCount: overdue.length, overdueAmount, countPaid, count: state.outstandingPayments.length };
  }, [state.outstandingPayments]);

  const handleSubmitNew = (e: React.FormEvent) => {
    e.preventDefault();
    const total = Number(addForm.totalAmount);
    const paid = Number(addForm.paidAmount || 0);
    if (!addForm.customerName || !addForm.invoiceNumber || !total || total <= 0) {
      swalConfig.error('Please fill in Customer Name, Invoice Number, and valid Total Amount.');
      return;
    }
    if (paid > total) {
      swalConfig.error('Paid amount cannot exceed total.');
      return;
    }
    const now = new Date();
    const outstanding = total - paid;
    let status: OutstandingPayment['status'] = 'pending';
    if (paid >= total) status = 'paid';
    else if (paid > 0) status = 'partial';

    const op: OutstandingPayment = {
      id: editing?.id || `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      customerId: addForm.customerId || addForm.customerName,
      customerName: addForm.customerName,
      saleId: addForm.saleId || `manual-${Date.now()}`,
      invoiceNumber: addForm.invoiceNumber,
      totalAmount: total,
      paidAmount: paid,
      outstandingAmount: outstanding,
      dueDate: new Date(addForm.dueDate),
      issueDate: new Date(addForm.issueDate),
      status,
      paymentHistory: paid > 0 ? [{
        id: `init-${Date.now()}`,
        amount: paid,
        date: new Date(),
        method: 'cash',
        receivedBy: profile?.name || profile?.id || 'system',
        notes: 'Initial payment on creation'
      }] : [],
      notes: addForm.notes || undefined,
      createdAt: editing?.createdAt || now,
      updatedAt: now,
    };
    if (editing) {
      dispatch({ type: 'UPDATE_OUTSTANDING_PAYMENT', payload: op });
      swalConfig.success('Outstanding invoice updated.');
    } else {
      dispatch({ type: 'ADD_OUTSTANDING_PAYMENT', payload: op });
      swalConfig.success('Outstanding invoice added.');
    }
    resetAddForm();
  };

  const resetAddForm = () => {
    setAddForm({
      customerId: '', customerName: '', saleId: '', invoiceNumber: '',
      totalAmount: '', paidAmount: '',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: '',
    });
    setIsAddOpen(false);
    setEditing(null);
  };

  const handleEdit = (op: OutstandingPayment) => {
    if (!canEdit) { swalConfig.error('Permission denied.'); return; }
    setEditing(op);
    setAddForm({
      customerId: op.customerId,
      customerName: op.customerName,
      saleId: op.saleId,
      invoiceNumber: op.invoiceNumber,
      totalAmount: op.totalAmount.toString(),
      paidAmount: op.paidAmount.toString(),
      issueDate: new Date(op.issueDate).toISOString().split('T')[0],
      dueDate: new Date(op.dueDate).toISOString().split('T')[0],
      notes: op.notes || '',
    });
    setIsAddOpen(true);
  };

  const handleDelete = async (op: OutstandingPayment) => {
    if (!canEdit) { swalConfig.error('Permission denied.'); return; }
    const res = await swalConfig.confirm(
      'Delete Outstanding Invoice?',
      `Delete ${op.invoiceNumber} for ${op.customerName} (O/S: ${state.settings.currency} ${op.outstandingAmount.toFixed(2)})?`,
      'Delete'
    );
    if (res.isConfirmed) {
      dispatch({ type: 'DELETE_OUTSTANDING_PAYMENT', payload: op.id });
      swalConfig.success('Invoice removed.');
    }
  };

  const handlePaymentSaved = (payment: PaymentRecord, newPaidAmount: number, newStatus: OutstandingPayment['status']) => {
    if (!paymentFor) return;
    const now = new Date();
    const newOutstanding = paymentFor.totalAmount - newPaidAmount;
    const updated: OutstandingPayment = {
      ...paymentFor,
      paidAmount: newPaidAmount,
      outstandingAmount: Math.max(0, newOutstanding),
      status: newStatus,
      paymentHistory: [...paymentFor.paymentHistory, payment],
      updatedAt: now,
    };
    dispatch({ type: 'UPDATE_OUTSTANDING_PAYMENT', payload: updated });
    swalConfig.success(`Payment of ${payment.amount.toFixed(2)} recorded successfully.`);
    setPaymentFor(null);
  };

  const exportData = () => {
    const csvContent = [
      ['Invoice', 'Customer', 'Issue Date', 'Due Date', 'Total', 'Paid', 'Outstanding', 'Status', 'Overdue', 'Last Payment'].join(','),
      ...list.map(op => {
        const lastPay = op.paymentHistory[op.paymentHistory.length - 1];
        return [
          op.invoiceNumber,
          `"${op.customerName.replace(/"/g, '""')}"`,
          format(new Date(op.issueDate), 'yyyy-MM-dd'),
          format(new Date(op.dueDate), 'yyyy-MM-dd'),
          op.totalAmount.toFixed(2),
          op.paidAmount.toFixed(2),
          op.outstandingAmount.toFixed(2),
          op.status,
          (op as any).isOverdue ? 'YES' : 'NO',
          lastPay ? format(new Date(lastPay.date), 'yyyy-MM-dd') + ' / ' + lastPay.amount.toFixed(2) : '',
        ].join(',');
      })
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `outstanding-payments-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const statusBadge = (status: OutstandingPayment['status']) => {
    const map: Record<OutstandingPayment['status'], string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      overdue: 'bg-red-100 text-red-800',
      partial: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
    };
    return (
      <span className={`inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold rounded-full capitalize ${map[status]}`}>
        <span>{status}</span>
      </span>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Outstanding Payments</h1>
          <p className="text-gray-600 mt-1">Track customer credit, due invoices, and payment history</p>
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
            onClick={() => { if (!canEdit) { swalConfig.error('Permission denied.'); return; } setEditing(null); resetAddForm(); setIsAddOpen(true); }}
            disabled={!canEdit}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium shadow-lg transition-all ${
              canEdit
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Plus className="h-4 w-4" />
            <span>Add Invoice</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 md:p-6 rounded-2xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Invoices</p>
              <p className="text-xl md:text-2xl font-bold">{summary.count}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <CreditCard className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-amber-600 p-4 md:p-6 rounded-2xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium">Total O/S</p>
              <p className="text-xl md:text-2xl font-bold">{state.settings.currency} {summary.outstanding.toFixed(2)}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-red-500 to-rose-600 p-4 md:p-6 rounded-2xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm font-medium">Overdue</p>
              <p className="text-xl md:text-2xl font-bold">{summary.overdueCount} invoices</p>
              <p className="text-red-100 text-xs mt-0.5">{state.settings.currency} {summary.overdueAmount.toFixed(2)}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-4 md:p-6 rounded-2xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm font-medium">Settled</p>
              <p className="text-xl md:text-2xl font-bold">{summary.countPaid} / {summary.count}</p>
              <p className="text-emerald-100 text-xs mt-0.5">Paid {state.settings.currency} {summary.paid.toFixed(2)}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search by invoice number or customer name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none text-sm"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="overdue">Overdue</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <select
                value={overdueFilter}
                onChange={(e) => setOverdueFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none text-sm"
              >
                <option value="all">All Due Dates</option>
                <option value="due_today">Due Today</option>
                <option value="overdue">Overdue Only</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {isAddOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{editing ? 'Edit Outstanding Invoice' : 'Add Outstanding Invoice'}</h2>
              <button onClick={resetAddForm} className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmitNew} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Customer Name *</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      list="customers-list"
                      value={addForm.customerName}
                      onChange={(e) => setAddForm(p => ({ ...p, customerName: e.target.value }))}
                      placeholder="Customer name"
                      className="w-full pl-9 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <datalist id="customers-list">
                      {state.customers.map(c => <option key={c.id} value={c.name} />)}
                    </datalist>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Invoice Number *</label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input value={addForm.invoiceNumber} onChange={(e) => setAddForm(p => ({ ...p, invoiceNumber: e.target.value }))}
                      placeholder="INV-XXXXXX" className="w-full pl-9 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Total Amount *</label>
                  <input type="number" step="0.01" min="0" value={addForm.totalAmount} onChange={(e) => setAddForm(p => ({ ...p, totalAmount: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Amount Already Paid</label>
                  <input type="number" step="0.01" min="0" value={addForm.paidAmount} onChange={(e) => setAddForm(p => ({ ...p, paidAmount: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Issue Date</label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input type="date" value={addForm.issueDate} onChange={(e) => setAddForm(p => ({ ...p, issueDate: e.target.value }))}
                      className="w-full pl-9 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Due Date</label>
                  <div className="relative">
                    <AlertCircle className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input type="date" value={addForm.dueDate} onChange={(e) => setAddForm(p => ({ ...p, dueDate: e.target.value }))}
                      className="w-full pl-9 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
                  <textarea rows={2} value={addForm.notes} onChange={(e) => setAddForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Optional notes" className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
              </div>
            </form>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button type="button" onClick={resetAddForm} className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all">Cancel</button>
              <button onClick={handleSubmitNew} className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all">
                <Plus className="h-4 w-4" />
                <span>{editing ? 'Update Invoice' : 'Save Invoice'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Invoice / Customer</th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">Due Date</th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell">Status</th>
                <th className="px-4 md:px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Balances</th>
                <th className="px-4 md:px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {list.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <AlertTriangle className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No outstanding invoices</h3>
                    <p className="text-gray-500 mb-4">{searchTerm || statusFilter !== 'all' || overdueFilter !== 'all' ? 'Try adjusting your filters' : 'Track customer credit by adding your first invoice'}</p>
                    {canEdit && (
                      <button onClick={() => { setEditing(null); resetAddForm(); setIsAddOpen(true); }}
                        className="inline-flex items-center space-x-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all">
                        <Plus className="h-4 w-4" />
                        <span>Add First Invoice</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : list.map((op) => (
                <tr key={op.id} className={`hover:bg-gray-50 transition-colors ${op.isOverdue ? 'bg-red-50/40' : ''}`}>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="flex items-center space-x-2">
                        <div className="text-sm font-semibold text-gray-900">{op.invoiceNumber}</div>
                        {op.isOverdue && (
                          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-700">
                            {op.daysOverdue}d OVERDUE
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{op.customerName}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">Issued {format(new Date(op.issueDate), 'MMM dd, yyyy')}</div>
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                    <div className={`text-sm font-semibold ${op.isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                      {format(new Date(op.dueDate), 'MMM dd, yyyy')}
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-4 hidden lg:table-cell">
                    <div className="flex flex-col space-y-1.5">
                      {statusBadge(op.isOverdue && op.status !== 'paid' ? 'overdue' : op.status)}
                      {op.paymentHistory.length > 0 && (
                        <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gray-100 text-gray-600">
                          {op.paymentHistory.length} payment{op.paymentHistory.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-xs text-gray-500">
                      Total: <span className="font-medium text-gray-700">{state.settings.currency} {op.totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-green-600">
                      Paid: <span className="font-semibold">{op.paidAmount.toFixed(2)}</span>
                    </div>
                    <div className={`text-sm font-bold mt-1 ${op.outstandingAmount > 0 ? (op.isOverdue ? 'text-red-600' : 'text-orange-600') : 'text-green-600'}`}>
                      O/S: {state.settings.currency} {op.outstandingAmount.toFixed(2)}
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-1">
                      {op.status !== 'paid' && (
                        <button
                          onClick={() => setPaymentFor(op)}
                          disabled={!canEdit}
                          title="Record Payment"
                          className={`p-2 rounded-lg transition-colors ${
                            canEdit ? 'text-emerald-600 hover:bg-emerald-50' : 'text-gray-300 cursor-not-allowed'
                          }`}
                        >
                          <DollarSign className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(op)}
                        disabled={!canEdit}
                        title="Edit"
                        className={`p-2 rounded-lg transition-colors ${
                          canEdit ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-300 cursor-not-allowed'
                        }`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(op)}
                        disabled={!canEdit}
                        title="Delete"
                        className={`p-2 rounded-lg transition-colors ${
                          canEdit ? 'text-red-600 hover:bg-red-50' : 'text-gray-300 cursor-not-allowed'
                        }`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <PaymentModal
        isOpen={!!paymentFor}
        onClose={() => setPaymentFor(null)}
        onSave={handlePaymentSaved}
        outstanding={paymentFor}
      />
    </div>
  );
}

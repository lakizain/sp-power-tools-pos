import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { Expense } from '../../types';
import { swalConfig } from '../../lib/sweetAlert';
import { useApp } from '../../context/SupabaseAppContext';
import { useAuth } from '../../context/AuthContext';

const DEFAULT_CATEGORIES = [
  'Rent', 'Utilities', 'Salaries & Wages', 'Inventory Purchases',
  'Marketing & Advertising', 'Office Supplies', 'Transportation',
  'Repairs & Maintenance', 'Insurance', 'Taxes', 'Bank Fees',
  'Software Subscriptions', 'Training & Development', 'Miscellaneous'
];

const PAYMENT_METHODS: Expense['paymentMethod'][] = ['cash', 'card', 'digital', 'bank_transfer'];

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: Expense) => void;
  editingExpense?: Expense | null;
}

export function ExpenseModal({ isOpen, onClose, onSave, editingExpense }: ExpenseModalProps) {
  const { state } = useApp();
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    category: DEFAULT_CATEGORIES[0],
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'cash' as Expense['paymentMethod'],
    receiptNumber: '',
    supplierId: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editingExpense) {
      setFormData({
        category: editingExpense.category,
        description: editingExpense.description,
        amount: editingExpense.amount.toString(),
        date: new Date(editingExpense.date).toISOString().split('T')[0],
        paymentMethod: editingExpense.paymentMethod,
        receiptNumber: editingExpense.receiptNumber || '',
        supplierId: editingExpense.supplierId || '',
        notes: editingExpense.notes || '',
      });
    } else {
      resetForm();
    }
    setErrors({});
  }, [editingExpense, isOpen]);

  const resetForm = () => {
    setFormData({
      category: DEFAULT_CATEGORIES[0],
      description: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'cash',
      receiptNumber: '',
      supplierId: '',
      notes: '',
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    if (!formData.amount || isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      newErrors.amount = 'Please enter a valid amount greater than 0';
    }
    if (!formData.date) newErrors.date = 'Date is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (profile?.role !== 'admin' && profile?.role !== 'manager') {
      swalConfig.error('You do not have permission to record expenses.');
      return;
    }

    const now = new Date();
    const selectedSupplier = state.suppliers.find(s => s.id === formData.supplierId);
    const expense: Expense = {
      id: editingExpense?.id || `expense-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      category: formData.category,
      description: formData.description.trim(),
      amount: Number(formData.amount),
      date: new Date(formData.date),
      paymentMethod: formData.paymentMethod,
      receiptNumber: formData.receiptNumber.trim() || undefined,
      supplierId: formData.supplierId || undefined,
      supplierName: selectedSupplier?.name || editingExpense?.supplierName,
      notes: formData.notes.trim() || undefined,
      createdAt: editingExpense?.createdAt || now,
      updatedAt: now,
      createdBy: editingExpense?.createdBy || profile?.id || 'system',
    };

    onSave(expense);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {editingExpense ? 'Edit Expense' : 'Record New Expense'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description *
              </label>
              <input
                type="text"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Brief description of the expense"
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all ${
                  errors.description ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Category
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
              >
                {DEFAULT_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Amount ({state.settings.currency}) *
              </label>
              <input
                type="number"
                step="0.01"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                placeholder="0.00"
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all ${
                  errors.amount ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Date *
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all ${
                  errors.date ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Payment Method
              </label>
              <select
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
              >
                {PAYMENT_METHODS.map(method => (
                  <option key={method} value={method} className="capitalize">
                    {method.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Receipt / Voucher #
              </label>
              <input
                type="text"
                name="receiptNumber"
                value={formData.receiptNumber}
                onChange={handleChange}
                placeholder="EXP-001 or receipt number"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Related Supplier (Optional)
              </label>
              <select
                name="supplierId"
                value={formData.supplierId}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
              >
                <option value="">-- No supplier --</option>
                {state.suppliers.filter(s => s.active).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Additional details about this expense"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </form>

        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-xl font-semibold hover:from-rose-700 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all"
          >
            <Save className="h-4 w-4" />
            <span>{editingExpense ? 'Update Expense' : 'Save Expense'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export { DEFAULT_CATEGORIES };

import React, { useState, useEffect } from 'react';
import { X, Save, DollarSign } from 'lucide-react';
import { PaymentRecord, OutstandingPayment } from '../../types';
import { swalConfig } from '../../lib/sweetAlert';
import { useAuth } from '../../context/AuthContext';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payment: PaymentRecord, newPaidAmount: number, newStatus: OutstandingPayment['status']) => void;
  outstanding?: OutstandingPayment | null;
}

const PAYMENT_METHODS: PaymentRecord['method'][] = ['cash', 'card', 'digital', 'bank_transfer', 'check'];

export function PaymentModal({ isOpen, onClose, onSave, outstanding }: PaymentModalProps) {
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    amount: '',
    method: 'cash' as PaymentRecord['method'],
    reference: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (outstanding && isOpen) {
      const amount = outstanding.outstandingAmount;
      setFormData({
        amount: amount > 0 ? amount.toFixed(2) : '',
        method: 'cash',
        reference: '',
        date: new Date().toISOString().split('T')[0],
        notes: '',
      });
    }
    setErrors({});
  }, [outstanding, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!outstanding) return;

    const amount = Number(formData.amount);
    const remaining = outstanding.outstandingAmount;

    const newErrors: Record<string, string> = {};
    if (!amount || amount <= 0) newErrors.amount = 'Please enter a valid payment amount';
    if (amount > remaining + 0.001) newErrors.amount = `Payment cannot exceed outstanding balance of ${remaining.toFixed(2)}`;
    if (!formData.date) newErrors.date = 'Date is required';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const payment: PaymentRecord = {
      id: `pay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      amount,
      date: new Date(formData.date),
      method: formData.method,
      reference: formData.reference.trim() || undefined,
      receivedBy: profile?.name || profile?.id || 'system',
      notes: formData.notes.trim() || undefined,
    };

    const newPaidAmount = outstanding.paidAmount + amount;
    const newOutstanding = outstanding.totalAmount - newPaidAmount;

    let newStatus: OutstandingPayment['status'] = outstanding.status;
    if (newOutstanding <= 0.01) {
      newStatus = 'paid';
    } else if (newPaidAmount > 0) {
      newStatus = 'partial';
    }

    onSave(payment, newPaidAmount, newStatus);
  };

  if (!isOpen || !outstanding) return null;

  const newBalance = Math.max(0, outstanding.outstandingAmount - Number(formData.amount || 0));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Record Payment</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Invoice: {outstanding.invoiceNumber} · Customer: {outstanding.customerName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-3 gap-3 mb-2">
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
              <div className="text-[10px] font-bold uppercase text-red-600">Total</div>
              <div className="text-sm font-bold text-red-800 mt-0.5">{outstanding.totalAmount.toFixed(2)}</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
              <div className="text-[10px] font-bold uppercase text-green-600">Paid</div>
              <div className="text-sm font-bold text-green-800 mt-0.5">{outstanding.paidAmount.toFixed(2)}</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
              <div className="text-[10px] font-bold uppercase text-orange-600">O/S</div>
              <div className="text-sm font-bold text-orange-800 mt-0.5">{outstanding.outstandingAmount.toFixed(2)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Payment Amount *
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={outstanding.outstandingAmount}
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  placeholder="0.00"
                  className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                    errors.amount ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              </div>
              {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                {[0.25, 0.5, 0.75, 1].map(frac => {
                  const amt = Number((outstanding.outstandingAmount * frac).toFixed(2));
                  return (
                    <button
                      key={frac}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, amount: amt.toString() }))}
                      className="px-3 py-1 text-[11px] font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                    >
                      {frac === 1 ? 'Full' : `${Math.round(frac * 100)}%`}
                    </button>
                  );
                })}
              </div>
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
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
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
                name="method"
                value={formData.method}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all capitalize"
              >
                {PAYMENT_METHODS.map(m => (
                  <option key={m} value={m}>{m.replace('_', ' ')}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Reference # (Receipt / Cheque #)
              </label>
              <input
                type="text"
                name="reference"
                value={formData.reference}
                onChange={handleChange}
                placeholder="Optional reference"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={2}
                placeholder="Additional notes for this payment"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Current outstanding:</span>
              <span className="font-semibold">{outstanding.outstandingAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-600">This payment:</span>
              <span className="font-semibold text-green-600">- {Number(formData.amount || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-2 mt-2 border-t border-blue-200/60 font-bold">
              <span>New balance after payment:</span>
              <span className={newBalance <= 0.01 ? 'text-green-600' : 'text-orange-600'}>
                {newBalance.toFixed(2)}
              </span>
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
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all"
          >
            <Save className="h-4 w-4" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { Rental } from '../../types';
import { swalConfig } from '../../lib/sweetAlert';
import { useApp } from '../../context/SupabaseAppContext';
import { useAuth } from '../../context/AuthContext';

interface RentalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rental: Rental) => void;
  editingRental?: Rental | null;
}

export function RentalModal({ isOpen, onClose, onSave, editingRental }: RentalModalProps) {
  const { state } = useApp();
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    rentFrom: new Date().toISOString().split('T')[0],
    amount: '',
    notes: '',
  });

  useEffect(() => {
    if (!isOpen) return;
    if (editingRental) {
      setFormData({
        rentFrom: new Date(editingRental.rentFrom).toISOString().split('T')[0],
        amount: editingRental.totalRent.toString(),
        notes: editingRental.notes || '',
      });
    } else {
      setFormData({
        rentFrom: new Date().toISOString().split('T')[0],
        amount: '',
        notes: '',
      });
    }
  }, [isOpen, editingRental]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(formData.amount) <= 0) {
      swalConfig.error('Please enter the rental amount for this date.');
      return;
    }

    const now = new Date();
    const rentalDate = new Date(formData.rentFrom);
    const amount = Number(formData.amount) || 0;
    const rental: Rental = {
      id: editingRental?.id || `rental-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      rentalNumber: editingRental?.rentalNumber || `RNT-${String(Date.now()).slice(-6)}`,
      customerId: undefined,
      customerName: '',
      items: [],
      rentFrom: rentalDate,
      rentTo: rentalDate,
      dailyRate: amount,
      weeklyRate: undefined,
      securityDeposit: 0,
      totalRent: Number(amount.toFixed(2)),
      paidAmount: 0,
      status: 'active',
      notes: formData.notes || undefined,
      createdBy: profile?.id || profile?.name || 'system',
      createdAt: editingRental?.createdAt || now,
      updatedAt: now,
    };
    onSave(rental);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 md:p-4">
      <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 px-5 md:px-7 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight">
              {editingRental ? 'Edit Rental' : 'New Rental'}
            </h2>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 md:p-7 space-y-7 bg-slate-50">
          <div className="space-y-3 rounded-2xl bg-white p-4 md:p-5 border border-slate-200 shadow-sm">
            <label className="block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              Date
            </label>
            <input
              type="date"
              name="rentFrom"
              value={formData.rentFrom}
              onChange={handleFormChange}
              className="w-full border-0 bg-transparent text-lg md:text-xl font-semibold text-slate-900 focus:outline-none focus:ring-0 px-0 py-1"
            />
          </div>

          <div className="space-y-3 rounded-2xl bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 p-4 md:p-5 shadow-sm">
            <label className="block text-xs font-bold uppercase tracking-[0.2em] text-violet-600">
              Rental Amount
            </label>
            <div className="flex items-center gap-3 border border-violet-200 rounded-xl bg-white px-4 py-3 shadow-inner">
              <span className="text-xl font-bold text-violet-700">LKR</span>
              <input
                type="number"
                step="0.01"
                min="0"
                name="amount"
                value={formData.amount}
                onChange={handleFormChange}
                placeholder="0.00"
                className="w-full bg-transparent text-2xl md:text-3xl font-black text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2 sticky bottom-0 bg-slate-50 pb-1">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 bg-white hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-sm transition-all border border-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-xl hover:shadow-violet-500/30 transition-all font-bold text-sm"
            >
              <Save className="h-4 w-4" />
              <span>{editingRental ? 'Update Rental' : 'Create Rental'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

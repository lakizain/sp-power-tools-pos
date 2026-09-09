import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { Supplier } from '../../types';
import { swalConfig } from '../../lib/sweetAlert';
import { useApp } from '../../context/SupabaseAppContext';
import { useAuth } from '../../context/AuthContext';

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (supplier: Supplier) => void;
  editingSupplier?: Supplier | null;
}

export function SupplierModal({ isOpen, onClose, onSave, editingSupplier }: SupplierModalProps) {
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    contactPerson: '',
    paymentTerms: 'Net 30',
    rating: 3,
    bankDetails: '',
    taxId: '',
    active: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editingSupplier) {
      setFormData({
        name: editingSupplier.name,
        email: editingSupplier.email,
        phone: editingSupplier.phone,
        address: editingSupplier.address,
        contactPerson: editingSupplier.contactPerson || '',
        paymentTerms: editingSupplier.paymentTerms || 'Net 30',
        rating: editingSupplier.rating || 3,
        bankDetails: editingSupplier.bankDetails || '',
        taxId: editingSupplier.taxId || '',
        active: editingSupplier.active ?? true,
      });
    } else {
      resetForm();
    }
    setErrors({});
  }, [editingSupplier, isOpen]);

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      contactPerson: '',
      paymentTerms: 'Net 30',
      rating: 3,
      bankDetails: '',
      taxId: '',
      active: true,
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Supplier name is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (profile?.role !== 'admin' && profile?.role !== 'manager') {
      swalConfig.error('You do not have permission to manage suppliers.');
      return;
    }

    const now = new Date();
    const supplier: Supplier = {
      id: editingSupplier?.id || `supplier-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      address: formData.address.trim(),
      contactPerson: formData.contactPerson.trim() || undefined,
      paymentTerms: formData.paymentTerms,
      rating: Number(formData.rating),
      bankDetails: formData.bankDetails.trim() || undefined,
      taxId: formData.taxId.trim() || undefined,
      active: formData.active,
      totalPurchases: editingSupplier?.totalPurchases || 0,
      outstandingBalance: editingSupplier?.outstandingBalance || 0,
      createdAt: editingSupplier?.createdAt || now,
      updatedAt: now,
    };

    onSave(supplier);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
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
                Supplier Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. ABC Trading Co."
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Contact Person
              </label>
              <input
                type="text"
                name="contactPerson"
                value={formData.contactPerson}
                onChange={handleChange}
                placeholder="Primary contact name"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+94 XX XXX XXXX"
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${errors.phone ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="supplier@company.com"
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Payment Terms
              </label>
              <select
                name="paymentTerms"
                value={formData.paymentTerms}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              >
                <option value="Cash on Delivery">Cash on Delivery (COD)</option>
                <option value="Net 7">Net 7</option>
                <option value="Net 14">Net 14</option>
                <option value="Net 30">Net 30</option>
                <option value="Net 45">Net 45</option>
                <option value="Net 60">Net 60</option>
                <option value="Net 90">Net 90</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Supplier Rating
              </label>
              <select
                name="rating"
                value={formData.rating}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>
                    {'⭐'.repeat(n)} {n} Star{n > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tax ID / VAT Number
              </label>
              <input
                type="text"
                name="taxId"
                value={formData.taxId}
                onChange={handleChange}
                placeholder="Tax registration number"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Address
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={2}
                placeholder="Supplier address"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Bank Details
              </label>
              <textarea
                name="bankDetails"
                value={formData.bankDetails}
                onChange={handleChange}
                rows={2}
                placeholder="Account name, account number, bank name, branch"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  name="active"
                  checked={formData.active}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 h-5 w-5"
                />
                <div className="ml-4">
                  <span className="text-sm font-semibold text-gray-900">Supplier is Active</span>
                  <p className="text-xs text-gray-600">Disable if this supplier is no longer in business</p>
                </div>
              </label>
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
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all"
          >
            <Save className="h-4 w-4" />
            <span>{editingSupplier ? 'Update Supplier' : 'Save Supplier'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

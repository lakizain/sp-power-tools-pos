import React, { useState, useMemo } from 'react';
import {
  Search, Plus, Edit2, Trash2, Star, Phone, Mail, MapPin,
  Download, Package, DollarSign, AlertCircle, Filter
} from 'lucide-react';
import { useApp } from '../../context/SupabaseAppContext';
import { useAuth } from '../../context/AuthContext';
import { Supplier } from '../../types';
import { swalConfig } from '../../lib/sweetAlert';
import { matchesAnyField } from '../../lib/searchUtils';
import { SupplierModal } from './SupplierModal';
import { format } from 'date-fns';

export function SupplierManager() {
  const { state, dispatch } = useApp();
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const canEdit = profile?.role === 'admin' || profile?.role === 'manager';

  const filteredSuppliers = useMemo(() => {
    return state.suppliers.filter(supplier => {
      const matchesSearch = matchesAnyField(
        [
          supplier.name,
          supplier.phone,
          supplier.email,
          supplier.contactPerson,
          supplier.address,
          supplier.id,
        ],
        searchTerm
      );

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && supplier.active) ||
        (statusFilter === 'inactive' && !supplier.active);

      const matchesRating =
        ratingFilter === 'all' ||
        supplier.rating === Number(ratingFilter);

      return matchesSearch && matchesStatus && matchesRating;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [state.suppliers, searchTerm, statusFilter, ratingFilter]);

  const summary = useMemo(() => {
    const total = state.suppliers.length;
    const active = state.suppliers.filter(s => s.active).length;
    const totalPurchases = state.suppliers.reduce((sum, s) => sum + (s.totalPurchases || 0), 0);
    const totalOutstanding = state.suppliers.reduce((sum, s) => sum + (s.outstandingBalance || 0), 0);
    return { total, active, totalPurchases, totalOutstanding };
  }, [state.suppliers]);

  const handleAdd = () => {
    if (!canEdit) {
      swalConfig.error('You do not have permission to add suppliers.');
      return;
    }
    setEditingSupplier(null);
    setIsModalOpen(true);
  };

  const handleEdit = (supplier: Supplier) => {
    if (!canEdit) {
      swalConfig.error('You do not have permission to edit suppliers.');
      return;
    }
    setEditingSupplier(supplier);
    setIsModalOpen(true);
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!canEdit) {
      swalConfig.error('You do not have permission to delete suppliers.');
      return;
    }
    const result = await swalConfig.confirm(
      'Delete Supplier?',
      `Are you sure you want to delete "${supplier.name}"? This action cannot be undone.`,
      'Delete'
    );
    if (result.isConfirmed) {
      dispatch({ type: 'DELETE_SUPPLIER', payload: supplier.id });
      swalConfig.success('Supplier deleted successfully.');
    }
  };

  const handleSave = (supplier: Supplier) => {
    if (editingSupplier) {
      dispatch({ type: 'UPDATE_SUPPLIER', payload: supplier });
      swalConfig.success('Supplier updated successfully.');
    } else {
      dispatch({ type: 'ADD_SUPPLIER', payload: supplier });
      swalConfig.success('Supplier added successfully.');
    }
    setIsModalOpen(false);
    setEditingSupplier(null);
  };

  const exportSuppliers = () => {
    const csvContent = [
      ['Name', 'Contact Person', 'Email', 'Phone', 'Address', 'Payment Terms', 'Rating', 'Active', 'Total Purchases', 'Outstanding'].join(','),
      ...filteredSuppliers.map(s => [
        s.name,
        s.contactPerson || '',
        s.email,
        s.phone,
        `"${s.address.replace(/"/g, '""')}"`,
        s.paymentTerms,
        s.rating,
        s.active ? 'Yes' : 'No',
        (s.totalPurchases || 0).toFixed(2),
        (s.outstandingBalance || 0).toFixed(2),
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suppliers-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const renderStars = (rating: number) => {
    return '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Supplier Management</h1>
          <p className="text-gray-600 mt-1">Manage your suppliers, contracts, and purchase history</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={exportSuppliers}
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
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 hover:shadow-xl'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Plus className="h-4 w-4" />
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-4 md:p-6 rounded-2xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Total Suppliers</p>
              <p className="text-xl md:text-2xl font-bold">{summary.total}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <Package className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-4 md:p-6 rounded-2xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm font-medium">Active Suppliers</p>
              <p className="text-xl md:text-2xl font-bold">{summary.active}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <Star className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 md:p-6 rounded-2xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Purchases</p>
              <p className="text-xl md:text-2xl font-bold">{state.settings.currency} {(summary.totalPurchases || 0).toFixed(2)}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-4 md:p-6 rounded-2xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium">Outstanding</p>
              <p className="text-xl md:text-2xl font-bold">{state.settings.currency} {(summary.totalOutstanding || 0).toFixed(2)}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <AlertCircle className="h-6 w-6" />
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
                placeholder="Search suppliers by name, contact, phone, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          <div className="relative">
            <Star className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none"
            >
              <option value="all">All Ratings</option>
              {[5, 4, 3, 2, 1].map(n => (
                <option key={n} value={n}>{'⭐'.repeat(n)} {n} Stars</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Supplier</th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">Contact</th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell">Payment Terms</th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Rating</th>
                <th className="px-4 md:px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell">Purchases</th>
                <th className="px-4 md:px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <Package className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No suppliers found</h3>
                    <p className="text-gray-500 mb-4">
                      {searchTerm || statusFilter !== 'all' || ratingFilter !== 'all'
                        ? 'Try adjusting your search filters'
                        : 'Get started by adding your first supplier'}
                    </p>
                    {canEdit && (
                      <button
                        onClick={handleAdd}
                        className="inline-flex items-center space-x-2 px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-indigo-700 transition-all"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Add First Supplier</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map(supplier => (
                  <tr key={supplier.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-white ${
                          supplier.active ? 'bg-gradient-to-br from-purple-500 to-indigo-500' : 'bg-gray-300'
                        }`}>
                          {supplier.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <div className="text-sm font-semibold text-gray-900">{supplier.name}</div>
                            {!supplier.active && (
                              <span className="inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-200 text-gray-600">INACTIVE</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-1 text-xs text-gray-500 mt-0.5">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate max-w-36">{supplier.address || 'No address'}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-sm text-gray-900">
                          <Phone className="h-3.5 w-3.5 text-gray-400" />
                          <span>{supplier.phone}</span>
                        </div>
                        {supplier.contactPerson && (
                          <div className="text-xs text-gray-500">Attn: {supplier.contactPerson}</div>
                        )}
                        {supplier.email && (
                          <div className="flex items-center space-x-2 text-xs text-gray-500">
                            <Mail className="h-3 w-3" />
                            <span className="truncate max-w-40">{supplier.email}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                      <span className="inline-flex px-3 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700">
                        {supplier.paymentTerms}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                      <span className="text-sm">{renderStars(supplier.rating)}</span>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                      <div className="text-sm">
                        <div className="font-semibold text-gray-900">{state.settings.currency} {(supplier.totalPurchases || 0).toFixed(2)}</div>
                        {(supplier.outstandingBalance || 0) > 0 && (
                          <div className="text-xs text-orange-600 font-medium">
                            O/S: {state.settings.currency} {(supplier.outstandingBalance || 0).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => handleEdit(supplier)}
                          disabled={!canEdit}
                          className={`p-2 rounded-lg transition-colors ${
                            canEdit ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-300 cursor-not-allowed'
                          }`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(supplier)}
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

      <SupplierModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingSupplier(null); }}
        onSave={handleSave}
        editingSupplier={editingSupplier}
      />
    </div>
  );
}

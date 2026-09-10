import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Plus, Minus, Package, Users, CalendarDays, DollarSign, KeyRound } from 'lucide-react';
import { Rental, RentalItem } from '../../types';
import { swalConfig } from '../../lib/sweetAlert';
import { useApp } from '../../context/SupabaseAppContext';
import { useAuth } from '../../context/AuthContext';
import { differenceInDays } from 'date-fns';

interface RentalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rental: Rental) => void;
  editingRental?: Rental | null;
}

const CONDITIONS: RentalItem['condition'][] = ['new', 'unused', 'opened', 'used', 'damaged', 'defective', 'missing_parts'];

export function RentalModal({ isOpen, onClose, onSave, editingRental }: RentalModalProps) {
  const { state } = useApp();
  const { profile } = useAuth();
  const [items, setItems] = useState<RentalItem[]>([]);
  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    rentFrom: new Date().toISOString().split('T')[0],
    rentTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dailyRate: '0',
    weeklyRate: '',
    securityDeposit: '0',
    paidAmount: '0',
    status: 'active' as Rental['status'],
    notes: '',
  });

  useEffect(() => {
    if (!isOpen) return;
    if (editingRental) {
      setItems(editingRental.items.map(i => ({ ...i })));
      setFormData({
        customerId: editingRental.customerId || '',
        customerName: editingRental.customerName || '',
        rentFrom: new Date(editingRental.rentFrom).toISOString().split('T')[0],
        rentTo: new Date(editingRental.rentTo).toISOString().split('T')[0],
        dailyRate: editingRental.dailyRate.toString(),
        weeklyRate: editingRental.weeklyRate?.toString() || '',
        securityDeposit: editingRental.securityDeposit.toString(),
        paidAmount: editingRental.paidAmount.toString(),
        status: editingRental.status,
        notes: editingRental.notes || '',
      });
    } else {
      setItems([]);
      setFormData({
        customerId: '',
        customerName: '',
        rentFrom: new Date().toISOString().split('T')[0],
        rentTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        dailyRate: '0',
        weeklyRate: '',
        securityDeposit: '0',
        paidAmount: '0',
        status: 'active',
        notes: '',
      });
    }
  }, [isOpen, editingRental]);

  const daysRented = useMemo(() => {
    const from = new Date(formData.rentFrom);
    const to = new Date(formData.rentTo);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from) return 0;
    return Math.max(1, differenceInDays(to, from) + 1);
  }, [formData.rentFrom, formData.rentTo]);

  const totals = useMemo(() => {
    const itemsSubtotal = items.reduce((s, i) => s + (Number(i.subtotal) || 0), 0);
    const dailyRate = Number(formData.dailyRate) || 0;
    const weeklyRate = Number(formData.weeklyRate) || 0;
    let rentTotal = 0;

    if (items.length > 0) {
      const itemsPerDayTotal = items.reduce((s, i) => s + (Number(i.dailyRate) || 0) * i.quantity, 0);
      rentTotal = itemsPerDayTotal * daysRented;
    } else {
      if (weeklyRate > 0 && daysRented >= 7) {
        const weeks = Math.floor(daysRented / 7);
        const extraDays = daysRented % 7;
        rentTotal = (weeks * weeklyRate) + (extraDays * dailyRate);
      } else {
        rentTotal = dailyRate * daysRented;
      }
    }

    const securityDeposit = Number(formData.securityDeposit) || 0;
    const paidAmount = Number(formData.paidAmount) || 0;
    const balance = Math.max(0, rentTotal - paidAmount);

    return {
      rentTotal: Number(rentTotal.toFixed(2)),
      itemsSubtotal: Number(itemsSubtotal.toFixed(2)),
      securityDeposit,
      paidAmount,
      balance: Number(balance.toFixed(2)),
    };
  }, [items, formData.dailyRate, formData.weeklyRate, formData.securityDeposit, formData.paidAmount, daysRented]);

  const activeProducts = useMemo(() => state.products.filter(p => p.active), [state.products]);
  const activeCustomers = useMemo(() => state.customers || [], [state.customers]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'customerId' && value) {
      const customer = activeCustomers.find(c => c.id === value);
      if (customer) {
        setFormData(prev => ({
          ...prev,
          customerName: customer.name || customer.businessName || ''
        }));
      }
    }
  };

  const addItem = () => {
    if (activeProducts.length === 0) {
      swalConfig.error('No products available in inventory.');
      return;
    }
    const defaultProduct = activeProducts[0];
    const newItem: RentalItem = {
      productId: defaultProduct.id,
      productName: defaultProduct.name,
      sku: defaultProduct.sku,
      quantity: 1,
      dailyRate: Number((defaultProduct.price * 0.1).toFixed(2)),
      subtotal: 0,
      condition: 'new',
      notes: '',
    };
    setItems([...items, newItem]);
  };

  const updateItem = (index: number, field: keyof RentalItem, value: any) => {
    const updated = [...items];
    (updated[index] as any)[field] = value;
    if (field === 'productId') {
      const product = activeProducts.find(p => p.id === value);
      if (product) {
        updated[index].productName = product.name;
        updated[index].sku = product.sku;
      }
    }
    if (field === 'quantity' || field === 'dailyRate') {
      const qty = Number(updated[index].quantity) || 0;
      const rate = Number(updated[index].dailyRate) || 0;
      updated[index].subtotal = Number((qty * rate * daysRented).toFixed(2));
    }
    setItems(updated);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName) {
      swalConfig.error('Please select or enter a customer name.');
      return;
    }
    if (daysRented <= 0) {
      swalConfig.error('Rent To date must be after Rent From date.');
      return;
    }
    if (items.length === 0 && Number(formData.dailyRate) <= 0 && Number(formData.weeklyRate) <= 0) {
      swalConfig.error('Please add at least one item or specify daily/weekly rate.');
      return;
    }
    if (totals.paidAmount > totals.rentTotal + totals.securityDeposit) {
      swalConfig.error('Paid amount cannot exceed total rent + security deposit.');
      return;
    }

    const now = new Date();
    const normalizedItems: RentalItem[] = items.map(i => {
      const qty = Number(i.quantity) || 0;
      const rate = Number(i.dailyRate) || 0;
      return {
        ...i,
        quantity: qty,
        dailyRate: rate,
        subtotal: Number((qty * rate * daysRented).toFixed(2)),
      };
    });

    const rental: Rental = {
      id: editingRental?.id || `rental-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      rentalNumber: editingRental?.rentalNumber || `RNT-${String(Date.now()).slice(-6)}`,
      customerId: formData.customerId || undefined,
      customerName: formData.customerName,
      items: normalizedItems,
      rentFrom: new Date(formData.rentFrom),
      rentTo: new Date(formData.rentTo),
      dailyRate: Number(formData.dailyRate) || 0,
      weeklyRate: formData.weeklyRate ? Number(formData.weeklyRate) : undefined,
      securityDeposit: totals.securityDeposit,
      totalRent: totals.rentTotal,
      paidAmount: Math.min(totals.paidAmount, totals.rentTotal + totals.securityDeposit),
      status: formData.status,
      notes: formData.notes || undefined,
      createdBy: profile?.id || profile?.name || 'system',
      createdAt: editingRental?.createdAt || now,
      updatedAt: now,
    };
    onSave(rental);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-t-3xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-5 md:px-7 py-5 flex items-center justify-between">
          <div className="flex items-center space-x-3 text-white">
            <div className="bg-white/20 p-2.5 rounded-xl">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black">
                {editingRental ? 'Edit Rental' : 'New Rental'}
              </h2>
              {editingRental && (
                <p className="text-violet-100 text-xs font-semibold mt-0.5">#{editingRental.rentalNumber}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 md:p-7 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-gray-700 mb-2 flex items-center">
                <Users className="h-4 w-4 mr-2 text-violet-600" />
                Customer
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  name="customerId"
                  value={formData.customerId}
                  onChange={handleFormChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
                >
                  <option value="">— Select Customer (optional) —</option>
                  {activeCustomers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.businessName} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
                <input
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleFormChange}
                  placeholder="Or enter customer name"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 mb-2 flex items-center">
                <CalendarDays className="h-4 w-4 mr-2 text-violet-600" />
                Rent From
              </label>
              <input
                type="date"
                name="rentFrom"
                value={formData.rentFrom}
                onChange={handleFormChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 mb-2 flex items-center">
                <CalendarDays className="h-4 w-4 mr-2 text-rose-600" />
                Rent To
              </label>
              <input
                type="date"
                name="rentTo"
                value={formData.rentTo}
                onChange={handleFormChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 mb-2 flex items-center">
                <DollarSign className="h-4 w-4 mr-2 text-amber-600" />
                Daily Rate (LKR)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="dailyRate"
                value={formData.dailyRate}
                onChange={handleFormChange}
                placeholder="0.00 (if no items)"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 mb-2 flex items-center">
                <DollarSign className="h-4 w-4 mr-2 text-indigo-600" />
                Weekly Rate (LKR, optional)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="weeklyRate"
                value={formData.weeklyRate}
                onChange={handleFormChange}
                placeholder="0.00"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 mb-2 flex items-center">
                <KeyRound className="h-4 w-4 mr-2 text-violet-600" />
                Security Deposit (LKR)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="securityDeposit"
                value={formData.securityDeposit}
                onChange={handleFormChange}
                placeholder="0.00"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 mb-2 flex items-center">
                <DollarSign className="h-4 w-4 mr-2 text-emerald-600" />
                Paid Amount (LKR)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="paidAmount"
                value={formData.paidAmount}
                onChange={handleFormChange}
                placeholder="0.00"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 mb-2">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleFormChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
              >
                <option value="active">Active</option>
                <option value="overdue">Overdue</option>
                <option value="returned">Returned</option>
                <option value="lost">Lost</option>
                <option value="damaged">Damaged</option>
              </select>
            </div>
            <div className="flex items-end pb-1">
              <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100 rounded-xl px-4 py-3 w-full">
                <div className="text-xs text-gray-600 font-semibold">Rental Duration</div>
                <div className="text-xl font-black text-violet-700">
                  {daysRented} day{daysRented !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-gray-900 flex items-center">
                <Package className="h-4 w-4 mr-2 text-violet-600" />
                Rental Items
                <span className="ml-2 text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {items.length}
                </span>
              </h3>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center space-x-1.5 px-3 py-2 bg-violet-50 text-violet-700 rounded-xl hover:bg-violet-100 transition-all text-xs font-bold"
              >
                <Plus className="h-4 w-4" />
                <span>Add Item</span>
              </button>
            </div>

            {items.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center bg-gray-50/50">
                <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm font-semibold">No items added yet</p>
                <p className="text-gray-400 text-xs mt-1">Add specific products to rent with individual daily rates</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="bg-gradient-to-r from-violet-50/50 to-purple-50/50 border border-violet-100 rounded-2xl p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                      <div className="md:col-span-4">
                        <label className="text-[10px] font-bold text-gray-600 uppercase mb-1 block">Product</label>
                        <select
                          value={item.productId}
                          onChange={(e) => updateItem(index, 'productId', e.target.value)}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-violet-500 focus:border-transparent text-xs"
                        >
                          {activeProducts.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.sku ? `(${p.sku})` : ''} — Stock: {p.stock}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[10px] font-bold text-gray-600 uppercase mb-1 block">Qty</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-violet-500 focus:border-transparent text-xs"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[10px] font-bold text-gray-600 uppercase mb-1 block">Daily Rate</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.dailyRate}
                          onChange={(e) => updateItem(index, 'dailyRate', Number(e.target.value))}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-violet-500 focus:border-transparent text-xs"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[10px] font-bold text-gray-600 uppercase mb-1 block">Condition</label>
                        <select
                          value={item.condition}
                          onChange={(e) => updateItem(index, 'condition', e.target.value)}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-violet-500 focus:border-transparent text-xs"
                        >
                          {CONDITIONS.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-1 flex flex-col justify-end">
                        <div className="text-[10px] font-bold text-gray-600 uppercase mb-1">Subtotal</div>
                        <div className="text-xs font-black text-violet-700 bg-white px-2 py-2.5 rounded-lg border border-gray-200 text-center">
                          {state.settings.currency} {(item.quantity * item.dailyRate * daysRented).toFixed(2)}
                        </div>
                      </div>
                      <div className="md:col-span-1 flex items-end">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="w-full p-2.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-all bg-white border border-gray-200"
                          title="Remove item"
                        >
                          <Minus className="h-4 w-4 mx-auto" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-600 uppercase mb-1 block">Item Notes</label>
                      <input
                        type="text"
                        value={item.notes || ''}
                        onChange={(e) => updateItem(index, 'notes', e.target.value)}
                        placeholder="Serial number, condition notes..."
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-violet-500 focus:border-transparent text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 mb-2 block">Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleFormChange}
              rows={2}
              placeholder="Additional rental agreement notes..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm resize-none"
            />
          </div>

          <div className="bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-600 rounded-2xl p-5 text-white shadow-xl shadow-violet-500/30">
            <div className="text-xs font-bold text-violet-100 uppercase tracking-wider mb-3 flex items-center">
              <DollarSign className="h-4 w-4 mr-1.5" />
              Rental Summary
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-white/15 rounded-xl p-3 backdrop-blur-sm">
                <div className="text-violet-100 text-xs font-semibold">Total Rent</div>
                <div className="text-2xl font-black mt-1">{state.settings.currency} {totals.rentTotal.toFixed(2)}</div>
              </div>
              <div className="bg-white/15 rounded-xl p-3 backdrop-blur-sm">
                <div className="text-violet-100 text-xs font-semibold">Security Deposit</div>
                <div className="text-2xl font-black mt-1">{state.settings.currency} {totals.securityDeposit.toFixed(2)}</div>
              </div>
              <div className="bg-emerald-400/25 rounded-xl p-3 backdrop-blur-sm border border-emerald-300/30">
                <div className="text-emerald-50 text-xs font-semibold">Paid Amount</div>
                <div className="text-2xl font-black mt-1 text-emerald-50">{state.settings.currency} {totals.paidAmount.toFixed(2)}</div>
              </div>
              <div className="bg-rose-400/25 rounded-xl p-3 backdrop-blur-sm border border-rose-300/30">
                <div className="text-rose-50 text-xs font-semibold">Balance Due</div>
                <div className="text-2xl font-black mt-1 text-rose-50">{state.settings.currency} {totals.balance.toFixed(2)}</div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/20 text-xs text-violet-100 font-semibold flex items-center justify-between">
              <span>Grand Total (Rent + Deposit):</span>
              <span className="text-white text-lg font-black">
                {state.settings.currency} {(totals.rentTotal + totals.securityDeposit).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2 sticky bottom-0 bg-white pb-1">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:shadow-xl hover:shadow-violet-500/30 transition-all font-bold text-sm"
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

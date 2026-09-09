import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Plus, Minus, Package } from 'lucide-react';
import { ProductReturn, ReturnItem, Sale } from '../../types';
import { swalConfig } from '../../lib/sweetAlert';
import { useApp } from '../../context/SupabaseAppContext';
import { useAuth } from '../../context/AuthContext';

interface ReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (returnRecord: ProductReturn) => void;
  editingReturn?: ProductReturn | null;
  fromSale?: Sale | null;
  initialReturnMethod?: ProductReturn['returnMethod'];
}

const RETURN_REASONS = [
  'Defective Product', 'Wrong Item Received', 'Damaged in Transit',
  'Changed Mind', 'Product Not as Described', 'Size / Fit Issue',
  'Expired / Spoiled', 'Other'
];

const CONDITIONS: ReturnItem['condition'][] = ['new', 'used', 'damaged', 'defective'];

export function ReturnModal({ isOpen, onClose, onSave, editingReturn, fromSale, initialReturnMethod }: ReturnModalProps) {
  const { state } = useApp();
  const { profile } = useAuth();
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [formData, setFormData] = useState({
    saleId: '',
    invoiceNumber: '',
    customerId: '',
    customerName: '',
    reason: RETURN_REASONS[0],
    returnMethod: 'refund' as ProductReturn['returnMethod'],
    status: 'pending' as ProductReturn['status'],
    paymentMethod: 'cash',
    notes: '',
  });

  useEffect(() => {
    if (editingReturn) {
      setItems(editingReturn.items);
      setFormData({
        saleId: editingReturn.saleId,
        invoiceNumber: editingReturn.invoiceNumber,
        customerId: editingReturn.customerId || '',
        customerName: editingReturn.customerName || '',
        reason: editingReturn.reason,
        returnMethod: editingReturn.returnMethod,
        status: editingReturn.status,
        paymentMethod: editingReturn.paymentMethod || 'cash',
        notes: editingReturn.notes || '',
      });
    } else if (fromSale) {
      const isSingleItem = fromSale.items.length === 1;
      const returnItems: ReturnItem[] = fromSale.items.map(si => {
        const anySi = si as any;
        const product = anySi.product;
        const productId = product?.id ?? anySi.productId ?? anySi.id ?? `item-${Date.now()}`;
        const productName = product?.name ?? anySi.productName ?? anySi.name ?? 'Unknown Item';
        const sku = product?.sku ?? anySi.sku;
        const soldQty = Number(si.quantity || 0);
        const soldSubtotal = Number(si.subtotal || 0);
        let unitPrice = product?.price ?? anySi.unitPrice ?? anySi.price ?? 0;
        if (product?.isWeightBased) {
          unitPrice = product.pricePerUnit || product.price;
        } else if (soldQty > 0 && soldSubtotal > 0) {
          unitPrice = soldSubtotal / soldQty;
        }
        unitPrice = Number(unitPrice.toFixed(2));
        const defaultQty = isSingleItem ? soldQty : 1;
        return {
          productId,
          productName,
          sku,
          quantity: defaultQty,
          unitPrice,
          subtotal: Number((defaultQty * unitPrice).toFixed(2)),
          condition: 'used' as ReturnItem['condition'],
          reason: initialReturnMethod === 'rental_return' ? 'Rental Item Returned' : '',
        };
      });
      setItems(returnItems);
      setFormData({
        saleId: fromSale.id,
        invoiceNumber: fromSale.invoiceNumber,
        customerId: fromSale.customerId || '',
        customerName: fromSale.customerName || '',
        reason: initialReturnMethod === 'rental_return' ? 'Other' : RETURN_REASONS[0],
        returnMethod: initialReturnMethod || 'refund',
        status: initialReturnMethod === 'rental_return' ? 'completed' : 'pending',
        paymentMethod: fromSale.paymentMethod === 'split' ? (fromSale.payments?.[0]?.method || 'cash') : fromSale.paymentMethod,
        notes: initialReturnMethod === 'rental_return' ? 'Rental item return - no refund, items restocked.' : '',
      });
    } else {
      setItems([]);
      setFormData({
        saleId: '',
        invoiceNumber: '',
        customerId: '',
        customerName: '',
        reason: RETURN_REASONS[0],
        returnMethod: initialReturnMethod || 'refund',
        status: 'pending',
        paymentMethod: 'cash',
        notes: '',
      });
    }
  }, [editingReturn, fromSale, isOpen, initialReturnMethod]);

  const updateItem = (index: number, patch: Partial<ReturnItem>) => {
    setItems(prev => {
      const next = [...prev];
      const updated = { ...next[index], ...patch };
      updated.quantity = Math.max(0, updated.quantity || 0);
      updated.subtotal = Number((updated.quantity * updated.unitPrice).toFixed(2));
      next[index] = updated;
      return next;
    });
  };

  const addCustomItem = () => {
    setItems(prev => [...prev, {
      productId: `custom-${Date.now()}`,
      productName: '',
      quantity: 1,
      unitPrice: 0,
      subtotal: 0,
      condition: 'new',
    }]);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const isRentalReturn = formData.returnMethod === 'rental_return';

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, it) => sum + it.subtotal, 0);
    const taxAmount = Number((subtotal * (state.settings.taxRate || 0) / 100).toFixed(2));
    const computedTotal = Number((subtotal + taxAmount).toFixed(2));
    return {
      subtotal: isRentalReturn ? 0 : subtotal,
      taxAmount: isRentalReturn ? 0 : taxAmount,
      totalRefund: isRentalReturn ? 0 : computedTotal,
      rawSubtotal: subtotal,
    };
  }, [items, state.settings.taxRate, isRentalReturn]);

  const handleSubmit = async () => {
    const itemsWithQty = items.filter(i => i.quantity > 0 && i.productName.trim());
    if (itemsWithQty.length === 0) {
      swalConfig.error('Please add at least one item with quantity greater than 0.');
      return;
    }
    if (!formData.reason) {
      swalConfig.error('Please select a return reason.');
      return;
    }
    if (profile?.role !== 'admin' && profile?.role !== 'manager') {
      swalConfig.error('You do not have permission to process returns.');
      return;
    }

    const now = new Date();
    const record: ProductReturn = {
      id: editingReturn?.id || `return-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      saleId: formData.saleId,
      invoiceNumber: formData.invoiceNumber || `RET-${Date.now()}`,
      customerId: formData.customerId || undefined,
      customerName: formData.customerName || undefined,
      items: itemsWithQty,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      totalRefund: totals.totalRefund,
      reason: formData.reason,
      returnMethod: formData.returnMethod,
      status: isRentalReturn ? 'completed' : formData.status,
      processedBy: editingReturn?.processedBy || profile?.name || profile?.id || 'system',
      timestamp: editingReturn?.timestamp || now,
      processedAt: isRentalReturn ? now : editingReturn?.processedAt,
      paymentMethod: formData.paymentMethod,
      restocked: isRentalReturn ? true : (editingReturn?.restocked ?? false),
      notes: formData.notes || undefined,
    };
    onSave(record);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {editingReturn
                ? 'Edit Return'
                : fromSale
                  ? fromSale.items.length === 1
                    ? `Return Item: ${fromSale.items[0]?.product?.name ?? (fromSale.items[0] as any)?.productName ?? fromSale.invoiceNumber}`
                    : `Return for ${fromSale.invoiceNumber}`
                  : 'New Product Return'}
            </h2>
            {formData.customerName && (
              <p className="text-sm text-gray-500 mt-0.5">Customer: {formData.customerName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Invoice # (Optional)
              </label>
              <input
                type="text"
                name="invoiceNumber"
                value={formData.invoiceNumber}
                onChange={handleChange}
                placeholder="INV-XXXXXX"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Return Method
              </label>
              <select
                name="returnMethod"
                value={formData.returnMethod}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              >
                <option value="refund">Cash / Card Refund</option>
                <option value="exchange">Product Exchange</option>
                <option value="store_credit">Store Credit</option>
                <option value="rental_return">Rental Item Return (Restock, No Refund)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
                <option value="exchanged">Exchanged</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Return Reason *
              </label>
              <select
                name="reason"
                value={formData.reason}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              >
                {RETURN_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {isRentalReturn ? 'Note (No Refund)' : 'Refund Payment Method'}
              </label>
              <select
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleChange}
                disabled={isRentalReturn}
                className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all capitalize ${isRentalReturn ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="digital">Digital Wallet</option>
                <option value="credit">Credit on Account</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
              {isRentalReturn && (
                <p className="text-xs text-violet-600 mt-2 font-medium">
                  💡 Items will be restocked to inventory — No refund is issued for rental returns.
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900">Return Items</h3>
              <button
                type="button"
                onClick={addCustomItem}
                className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Custom Item</span>
              </button>
            </div>

            {items.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
                <Package className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">
                  No items added. Click "Add Custom Item" to start.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-xl bg-gray-50/60 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                          Product
                        </label>
                        <input
                          type="text"
                          value={item.productName}
                          onChange={e => updateItem(index, { productName: e.target.value })}
                          placeholder="Product name"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        />
                      </div>
                      <button
                        onClick={() => removeItem(index)}
                        className="mt-6 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Qty</label>
                        <input
                          type="number"
                          min="0"
                          value={item.quantity}
                          onChange={e => updateItem(index, { quantity: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Unit Price</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitPrice}
                          onChange={e => updateItem(index, { unitPrice: Number(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Condition</label>
                        <select
                          value={item.condition}
                          onChange={e => updateItem(index, { condition: e.target.value as ReturnItem['condition'] })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent capitalize"
                        >
                          {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-1">Subtotal</label>
                        <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-900">
                          {state.settings.currency} {item.subtotal.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`${isRentalReturn
            ? 'bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200'
            : 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200'} rounded-xl p-5 space-y-2`}>
            {isRentalReturn && (
              <div className="flex items-start gap-2 pb-2 mb-2 border-b border-violet-200/60">
                <span className="text-lg">🔁</span>
                <div>
                  <p className="text-sm font-bold text-violet-800">Rental Item Return</p>
                  <p className="text-xs text-violet-600">All items below will be added back to inventory. No refund.</p>
                </div>
              </div>
            )}
            {!isRentalReturn ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Items Subtotal:</span>
                  <span className="font-medium">{state.settings.currency} {totals.subtotal.toFixed(2)}</span>
                </div>
                {state.settings.taxRate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax ({state.settings.taxRate}%):</span>
                    <span className="font-medium">{state.settings.currency} {totals.taxAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-amber-200/60">
                  <span>Total Refund:</span>
                  <span className="text-amber-700">{state.settings.currency} {totals.totalRefund.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Items Returning:</span>
                  <span className="font-medium">{items.filter(i => i.quantity > 0).length} items</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Qty to Restock:</span>
                  <span className="font-medium">{items.reduce((s, i) => s + i.quantity, 0)} units</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-violet-200/60">
                  <span>Total Refund:</span>
                  <span className="text-violet-600">— {state.settings.currency} 0.00 (None)</span>
                </div>
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
              placeholder="Additional details about this return"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

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
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-orange-700 shadow-lg hover:shadow-xl transition-all"
          >
            <Save className="h-4 w-4" />
            <span>{editingReturn ? 'Update Return' : 'Process Return'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

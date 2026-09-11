import React, { useState, useEffect, useMemo } from 'react';
import { X, PlusCircle, MinusCircle, Hash, AlertTriangle, Package, TrendingUp, TrendingDown, Equal } from 'lucide-react';
import { Product } from '../../types';
import Swal from 'sweetalert2';

type AdjustmentMode = 'add' | 'remove' | 'set';
type AdjustmentReason = 'purchase' | 'return' | 'damaged' | 'stock_count' | 'theft' | 'other';

const REASON_OPTIONS: { value: AdjustmentReason; label: string; icon: React.ReactNode }[] = [
  { value: 'purchase', label: 'Purchase (Goods Received)', icon: <Package className="h-4 w-4" /> },
  { value: 'return', label: 'Customer Return', icon: <TrendingUp className="h-4 w-4" /> },
  { value: 'stock_count', label: 'Physical Stock Count', icon: <Hash className="h-4 w-4" /> },
  { value: 'damaged', label: 'Damaged / Write-off', icon: <AlertTriangle className="h-4 w-4" /> },
  { value: 'theft', label: 'Loss / Theft', icon: <TrendingDown className="h-4 w-4" /> },
  { value: 'other', label: 'Other Adjustment', icon: <Equal className="h-4 w-4" /> },
];

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onAdjustmentComplete?: () => void;
}

export function StockAdjustmentModal({ isOpen, onClose, products, onAdjustmentComplete }: StockAdjustmentModalProps) {
  const [mode, setMode] = useState<AdjustmentMode>('add');
  const [quantity, setQuantity] = useState<string>('');
  const [reason, setReason] = useState<AdjustmentReason>('purchase');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [individualQuantities, setIndividualQuantities] = useState<Record<string, string>>({});

  const isMulti = products.length > 1;

  useEffect(() => {
    if (isOpen) {
      setMode('add');
      setQuantity('');
      setReason('purchase');
      setNotes('');
      setSubmitting(false);
      const init: Record<string, string> = {};
      products.forEach(p => { init[p.id] = ''; });
      setIndividualQuantities(init);
    }
  }, [isOpen, products]);

  const calculateNewStock = (product: Product): number => {
    let qty: number;
    if (isMulti) {
      qty = parseFloat(quantity) || 0;
    } else {
      const iq = individualQuantities[product.id];
      qty = (iq !== undefined && iq !== '') ? (parseFloat(iq) || 0) : (parseFloat(quantity) || 0);
    }
    switch (mode) {
      case 'add': return product.stock + qty;
      case 'remove': return Math.max(0, product.stock - qty);
      case 'set': return Math.max(0, qty);
    }
  };

  const getStockChange = (product: Product): number => {
    const newStock = calculateNewStock(product);
    return newStock - product.stock;
  };

  const allQuantitiesValid = useMemo(() => {
    if (products.length === 0) return false;
    if (isMulti) {
      const q = parseFloat(quantity);
      return !isNaN(q) && q >= 0;
    }
    return products.every(p => {
      const iq = individualQuantities[p.id];
      const qtyStr = (iq !== undefined && iq !== '') ? iq : quantity;
      const q = parseFloat(qtyStr);
      return !isNaN(q) && q >= 0;
    });
  }, [products, isMulti, quantity, individualQuantities]);

  const previewRows = useMemo(() => {
    return products.map(p => {
      const newStock = calculateNewStock(p);
      const change = getStockChange(p);
      const isLow = p.trackInventory !== false && newStock <= (p.minStock || 0);
      const isOut = p.trackInventory !== false && newStock === 0;
      return { product: p, newStock, change, isLow, isOut };
    });
  }, [products, individualQuantities, quantity, mode]);

  const handleSubmit = async () => {
    if (!allQuantitiesValid) {
      await Swal.fire({
        title: 'Invalid Quantity',
        text: 'Please enter valid non-negative quantity values.',
        icon: 'error',
        confirmButtonText: 'OK',
      });
      return;
    }

    const hasNegativeAfterRemove = previewRows.some(r => r.product.stock - (parseFloat(
      isMulti ? quantity : (individualQuantities[r.product.id] || quantity)
    ) || 0) < 0 && mode === 'remove');

    if (hasNegativeAfterRemove && mode === 'remove') {
      const result = await Swal.fire({
        title: 'Stock Will Go Negative?',
        text: 'Removing this quantity will cause some products to go below zero. They will be set to 0 instead. Continue?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Continue (Cap at 0)',
        cancelButtonText: 'Cancel',
      });
      if (!result.isConfirmed) return;
    }

    setSubmitting(true);
    try {
      const { productsService } = await import('../../lib/services');
      const updates = previewRows.map(r => ({
        id: r.product.id,
        stockChange: r.change,
        newStock: r.newStock,
      }));
      await productsService.batchStockUpdate(updates);

      const totalChange = previewRows.reduce((s, r) => s + r.change, 0);
      await Swal.fire({
        title: 'Stock Adjusted!',
        text: `${products.length} product(s) updated. Net change: ${totalChange >= 0 ? '+' : ''}${totalChange} units.`,
        icon: 'success',
        confirmButtonText: 'OK',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2500,
      });

      onAdjustmentComplete?.();
      onClose();
    } catch (error) {
      console.error('Stock adjustment error:', error);
      await Swal.fire({
        title: 'Error!',
        text: error instanceof Error ? error.message : 'Failed to adjust stock. Please try again.',
        icon: 'error',
        confirmButtonText: 'OK',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || products.length === 0) return null;

  const modeBtnClass = (m: AdjustmentMode) =>
    `flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold transition-all ${
      mode === m
        ? (m === 'add' ? 'bg-green-500 text-white shadow-lg shadow-green-200'
          : m === 'remove' ? 'bg-orange-500 text-white shadow-lg shadow-orange-200'
          : 'bg-blue-500 text-white shadow-lg shadow-blue-200')
        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    }`;

  return (
    <div className="modal-overlay z-50">
      <div className="modal max-w-3xl max-h-[90vh] flex flex-col">
        <div className="modal-header shrink-0">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            {mode === 'add' && <PlusCircle className="h-6 w-6 text-green-600" />}
            {mode === 'remove' && <MinusCircle className="h-6 w-6 text-orange-600" />}
            {mode === 'set' && <Hash className="h-6 w-6 text-blue-600" />}
            Quick Stock Adjustment
            {isMulti && (
              <span className="ml-2 px-2.5 py-0.5 text-sm bg-indigo-100 text-indigo-700 rounded-full font-medium">
                {products.length} Products
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="modal-body space-y-5 overflow-y-auto">
          {isMulti && (
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-700 flex items-start gap-2">
              <Package className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Batch Mode</span> — Same adjustment applies to all {products.length} selected products.
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <button className={modeBtnClass('add')} onClick={() => setMode('add')}>
              <PlusCircle className="h-5 w-5" />
              <span>Add Stock</span>
            </button>
            <button className={modeBtnClass('remove')} onClick={() => setMode('remove')}>
              <MinusCircle className="h-5 w-5" />
              <span>Remove Stock</span>
            </button>
            <button className={modeBtnClass('set')} onClick={() => setMode('set')}>
              <Hash className="h-5 w-5" />
              <span>Set Exact</span>
            </button>
          </div>

          {isMulti ? (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Quantity ({mode === 'add' ? 'Units to Add' : mode === 'remove' ? 'Units to Remove' : 'Exact New Stock'})
              </label>
              <input
                type="number"
                min={0}
                step={mode === 'set' ? 1 : 1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="input text-xl font-semibold text-center"
                placeholder="e.g. 50"
                autoFocus
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Quantity ({mode === 'add' ? 'Units to Add' : mode === 'remove' ? 'Units to Remove' : 'Exact New Stock'})
              </label>
              {products.map(p => {
                const iq = individualQuantities[p.id];
                const qtyVal = (iq !== undefined && iq !== '') ? iq : quantity;
                return (
                  <div key={p.id} className="mb-2">
                    <div className="flex items-center justify-between mb-1 text-sm">
                      <span className="font-medium text-gray-800 truncate">{p.name}</span>
                      <span className="text-gray-500 font-mono">Current: {p.stock}</span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={qtyVal}
                      onChange={(e) => {
                        if (p.id) {
                          setIndividualQuantities(prev => ({ ...prev, [p.id]: e.target.value }));
                        } else {
                          setQuantity(e.target.value);
                        }
                      }}
                      className="input text-lg font-semibold"
                      placeholder="Enter quantity"
                      autoFocus
                    />
                  </div>
                );
              })}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Reason for Adjustment *</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {REASON_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setReason(opt.value)}
                  className={`flex items-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                    reason === opt.value
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {opt.icon}
                  <span className="truncate">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="textarea text-sm"
              placeholder="Any additional details about this adjustment..."
            />
          </div>

          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Preview of Changes
            </h3>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-100">
              <table className="table min-w-full">
                <thead className="table-header sticky top-0">
                  <tr>
                    <th className="table-header-cell text-left">Product</th>
                    <th className="table-header-cell text-right">Current</th>
                    <th className="table-header-cell text-right">Change</th>
                    <th className="table-header-cell text-right">New Stock</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {previewRows.map(({ product, newStock, change, isLow, isOut }) => (
                    <tr key={product.id} className="table-row">
                      <td className="table-cell">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">{product.name}</div>
                          <div className="text-xs text-gray-500 font-mono truncate">{product.sku}</div>
                        </div>
                      </td>
                      <td className="table-cell text-right font-mono text-sm">{product.stock}</td>
                      <td className={`table-cell text-right font-mono text-sm font-semibold ${
                        change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-400'
                      }`}>
                        {change > 0 ? '+' : ''}{change}
                      </td>
                      <td className={`table-cell text-right font-mono text-sm font-bold ${
                        isOut ? 'text-red-600' : isLow ? 'text-orange-600' : 'text-gray-900'
                      }`}>
                        {newStock}
                        {isOut && <span className="ml-1 text-xs">(Out)</span>}
                        {!isOut && isLow && <span className="ml-1 text-xs">(Low)</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>
                Reason: <span className="font-semibold text-gray-700">{REASON_OPTIONS.find(r => r.value === reason)?.label}</span>
              </span>
              <span>
                Net change:{' '}
                <span className={`font-mono font-bold ${
                  previewRows.reduce((s, r) => s + r.change, 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {previewRows.reduce((s, r) => s + r.change, 0) >= 0 ? '+' : ''}
                  {previewRows.reduce((s, r) => s + r.change, 0)}
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="modal-footer justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-md"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!allQuantitiesValid || submitting}
            className={`btn btn-md font-semibold ${
              mode === 'add' ? 'btn-green'
                : mode === 'remove' ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'btn-primary'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {submitting
              ? 'Processing...'
              : mode === 'add' ? `Add to ${products.length} Product${isMulti ? 's' : ''}`
                : mode === 'remove' ? `Remove from ${products.length} Product${isMulti ? 's' : ''}`
                : `Set Stock for ${products.length} Product${isMulti ? 's' : ''}`
            }
          </button>
        </div>
      </div>
    </div>
  );
}

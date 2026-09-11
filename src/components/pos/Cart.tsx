import { useState, useEffect } from 'react';
import { Trash2, Plus, Minus, User, Percent, FileText, ShoppingCart } from 'lucide-react';
import { CartItem, Customer } from '../../types';
import { useApp } from '../../context/SupabaseAppContext';
import { matchesAnyField } from '../../lib/searchUtils';

interface CartProps {
  onCheckout: () => void;
  onSaveDraft: () => void;
}

export function Cart({ onCheckout, onSaveDraft }: CartProps) {
  const { state, dispatch } = useApp();
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  const isTouchMode = state.settings.interfaceMode === 'touch';

  const updateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      dispatch({ type: 'REMOVE_FROM_CART', payload: index });
    } else {
      const item = state.cart[index];
      const price = item.product.isWeightBased 
        ? (item.product.pricePerUnit || 0) * (item.weight || 1)
        : item.product.price;
      const updatedItem = {
        ...item,
        quantity: newQuantity,
        subtotal: (price * newQuantity) - (item.discount || 0)
      };
      dispatch({ type: 'UPDATE_CART_ITEM', payload: { index, item: updatedItem } });
    }
  };

  const removeFromCart = (index: number) => {
    dispatch({ type: 'REMOVE_FROM_CART', payload: index });
  };

  const applyDiscount = (index: number, discount: number, discountType: 'percentage' | 'fixed') => {
    const item = state.cart[index];
    const price = item.product.isWeightBased 
      ? (item.product.pricePerUnit || 0) * (item.weight || 1)
      : item.product.price;
    let discountAmount = 0;
    
    if (discountType === 'percentage') {
      discountAmount = (price * item.quantity * discount) / 100;
    } else {
      discountAmount = discount;
    }

    const updatedItem = {
      ...item,
      discount: discountAmount,
      discountType,
      subtotal: (price * item.quantity) - discountAmount
    };
    
    dispatch({ type: 'UPDATE_CART_ITEM', payload: { index, item: updatedItem } });
  };

  const selectCustomer = (customer: Customer) => {
    dispatch({ type: 'SET_SELECTED_CUSTOMER', payload: customer });
    setShowCustomerSearch(false);
    setCustomerSearch('');
  };

  const filteredCustomers = state.customers.filter(customer =>
    matchesAnyField(
      [customer.name, customer.email, customer.phone, customer.id],
      customerSearch
    )
  );

  const subtotal = state.cart.reduce((sum, item) => {
    const price = item.product.isWeightBased 
      ? (item.product.pricePerUnit || 0) * (item.weight || 1)
      : item.product.price;
    return sum + (price * item.quantity);
  }, 0);
  const totalDiscount = state.cart.reduce((sum, item) => sum + (item.discount || 0), 0);
  const taxAmount = 0;
  const total = subtotal - totalDiscount;

  return (
    <div className={`bg-white border-l border-gray-100 flex flex-col h-screen ${
      isTouchMode ? 'w-96' : 'w-80'
    } max-w-full`}>
      {/* Cart Header */}
      <div className="p-4 lg:p-6 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-6">
          <h2 className={`font-bold text-gray-900 ${isTouchMode ? 'text-xl' : 'text-lg'}`}>
            Shopping Cart
          </h2>
          <div className="flex items-center space-x-2">
            <ShoppingCart className="h-5 w-5 text-gray-400" />
            <span className="badge badge-info">
              {state.cart.length} items
            </span>
          </div>
        </div>

        {/* Customer Selection */}
        <div className="relative">
          {state.selectedCustomer ? (
            <div className="card p-4 border-green-200 bg-green-50">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className={`font-medium text-green-800 truncate ${isTouchMode ? 'text-base' : 'text-sm'}`}>
                    {state.selectedCustomer.name}
                  </p>
                  <p className={`text-green-600 truncate ${isTouchMode ? 'text-sm' : 'text-xs'}`}>
                    {state.selectedCustomer.email}
                  </p>
                </div>
                <button
                  onClick={() => dispatch({ type: 'SET_SELECTED_CUSTOMER', payload: null })}
                  className="text-green-600 hover:text-green-800 p-1 rounded-lg hover:bg-green-100 transition-colors flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCustomerSearch(true)}
              className={`btn btn-secondary w-full ${
                isTouchMode ? 'btn-lg touch-friendly' : 'btn-md'
              }`}
            >
              <User className="h-4 w-4" />
              <span>Select Customer</span>
            </button>
          )}

          {/* Customer Search Dropdown */}
          {showCustomerSearch && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-lg z-50 max-h-64 overflow-hidden animate-slide-up">
              <div className="p-4">
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="input input-sm"
                  autoFocus
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => selectCustomer(customer)}
                    className="w-full text-left p-4 hover:bg-gray-50 border-t border-gray-100 transition-colors"
                  >
                    <p className="font-medium text-sm truncate">{customer.name}</p>
                    <p className="text-xs text-gray-600 truncate">{customer.email}</p>
                  </button>
                ))}
                {filteredCustomers.length === 0 && (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No customers found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cart Items */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 lg:p-3 space-y-0" style={{
        scrollbarWidth: 'thin',
        scrollbarColor: '#d1d5db #f3f4f6'
      }}>
        {state.cart.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-gray-100 p-6 rounded-3xl inline-block mb-4">
              <ShoppingCart className="h-12 w-12 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">Cart is empty</p>
            <p className="text-gray-400 text-sm mt-1">Add products to get started</p>
          </div>
        ) : (
          state.cart.map((item, index) => (
            <CartItemCard
              key={`${item.product.id}-${index}`}
              item={item}
              index={index}
              onUpdateQuantity={updateQuantity}
              onRemove={removeFromCart}
              onApplyDiscount={applyDiscount}
              isTouchMode={isTouchMode}
              currency={state.settings.currency}
            />
          ))
        )}
      </div>

      {/* Cart Summary */}
      {state.cart.length > 0 && (
        <div className="border-t border-gray-100 p-4 lg:p-6 space-y-6 bg-gray-50 flex-shrink-0">
          <div className="space-y-3">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span className="font-medium">{state.settings.currency} {subtotal.toFixed(2)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount:</span>
                <span className="font-medium">-{state.settings.currency} {totalDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold text-gray-900 pt-3 border-t border-gray-200">
              <span>Total:</span>
              <span>{state.settings.currency} {total.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={onCheckout}
              disabled={state.cart.length === 0}
              className={`btn btn-success w-full ${
                isTouchMode ? 'btn-lg touch-friendly' : 'btn-lg'
              }`}
            >
              Checkout
            </button>
            
            <button
              onClick={onSaveDraft}
              disabled={state.cart.length === 0}
              className={`btn btn-secondary w-full ${
                isTouchMode ? 'btn-md touch-friendly' : 'btn-md'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Save Draft</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface CartItemCardProps {
  item: CartItem;
  index: number;
  onUpdateQuantity: (index: number, quantity: number) => void;
  onRemove: (index: number) => void;
  onApplyDiscount: (index: number, discount: number, type: 'percentage' | 'fixed') => void;
  isTouchMode: boolean;
  currency: string;
}

function CartItemCard({ item, index, onUpdateQuantity, onRemove, onApplyDiscount, isTouchMode, currency }: CartItemCardProps) {
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [discountValue, setDiscountValue] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [quantityInput, setQuantityInput] = useState(item.quantity.toString());
  const [isEditingQuantity, setIsEditingQuantity] = useState(false);

  const handleDiscountSubmit = () => {
    const value = parseFloat(discountValue);
    if (!isNaN(value) && value > 0) {
      onApplyDiscount(index, value, discountType);
      setShowDiscountInput(false);
      setDiscountValue('');
    }
  };

  const handleQuantityInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuantityInput(e.target.value);
  };

  const handleQuantityInputBlur = () => {
    const parsed = parseInt(quantityInput);
    if (!isNaN(parsed) && parsed >= 0) {
      if (parsed === 0) {
        onRemove(index);
      } else {
        const maxStock = item.product.trackInventory ? item.product.stock : Infinity;
        const clamped = Math.min(parsed, maxStock);
        if (clamped !== item.quantity) {
          onUpdateQuantity(index, clamped);
        }
        setQuantityInput(clamped.toString());
      }
    } else {
      setQuantityInput(item.quantity.toString());
    }
    setIsEditingQuantity(false);
  };

  const handleQuantityInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setQuantityInput(item.quantity.toString());
      setIsEditingQuantity(false);
      (e.target as HTMLInputElement).blur();
    }
  };

  useEffect(() => {
    if (!isEditingQuantity) {
      setQuantityInput(item.quantity.toString());
    }
  }, [item.quantity, isEditingQuantity]);

  const unitPrice = item.product.isWeightBased
    ? (item.product.pricePerUnit || 0)
    : item.product.price;

  return (
    <div className="bg-white border-b border-gray-100 py-1.5 px-1.5">
      <div className="flex items-start gap-1.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-1">
            <h4 className="font-semibold text-gray-900 truncate text-[13px] leading-none">
              {item.product.name}
            </h4>
            <span className="font-bold text-gray-900 text-[13px] whitespace-nowrap shrink-0">
              {currency}{item.subtotal.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            <span className="text-gray-500 text-[11px] leading-none whitespace-nowrap">
              {currency}{unitPrice.toFixed(2)}
              {item.weight
                ? `×${item.weight}${item.product.unit || ''}`
                : item.product.isWeightBased
                  ? ''
                  : `×${item.quantity}`}
            </span>
            {item.discount > 0 && (
              <span className="text-green-600 text-[11px] font-medium leading-none whitespace-nowrap">
                - {item.discountType === 'percentage' ? `${item.discount}%` : `${currency}${item.discount.toFixed(2)}`}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-1 mt-1">
        <div className="flex items-center space-x-0.5">
          <button
            onClick={() => onUpdateQuantity(index, item.quantity - 1)}
            className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors flex-shrink-0"
          >
            <Minus className="h-2.5 w-2.5" />
          </button>
          <input
            type="number"
            min="1"
            value={quantityInput}
            onChange={handleQuantityInputChange}
            onBlur={handleQuantityInputBlur}
            onKeyDown={handleQuantityInputKeyDown}
            onFocus={() => setIsEditingQuantity(true)}
            className="w-8 h-5 text-center text-[11px] font-semibold text-gray-900 bg-gray-50 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={() => onUpdateQuantity(index, item.quantity + 1)}
            className="w-5 h-5 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors flex-shrink-0"
          >
            <Plus className="h-2.5 w-2.5" />
          </button>
          <button
            onClick={() => setShowDiscountInput(!showDiscountInput)}
            className={`ml-1 w-5 h-5 flex items-center justify-center rounded transition-colors flex-shrink-0 ${
              showDiscountInput
                ? 'bg-blue-100 text-blue-700'
                : 'bg-blue-50 text-blue-500 hover:bg-blue-100 hover:text-blue-700'
            }`}
            title="Discount"
          >
            <Percent className="h-2.5 w-2.5" />
          </button>
        </div>

        <button
          onClick={() => onRemove(index)}
          className="text-red-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50 transition-colors flex-shrink-0"
          title="Remove"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {showDiscountInput && (
        <div className="flex items-center space-x-1 pt-1 mt-1 border-t border-gray-100 animate-slide-up">
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
            className="h-6 px-1 text-[10px] rounded border border-gray-300 bg-white w-10"
          >
            <option value="percentage">%</option>
            <option value="fixed">{currency}</option>
          </select>
          <input
            type="number"
            placeholder="Discount"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            className="h-6 px-1.5 text-[11px] rounded border border-gray-300 flex-1"
          />
          <button
            onClick={handleDiscountSubmit}
            className="h-6 px-1.5 text-[11px] rounded bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}
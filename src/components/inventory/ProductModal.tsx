import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Scale, ScanLine, Wand2, Printer, FolderPlus, RefreshCw } from 'lucide-react';
import { Product, ProductBatch, ProductCategory } from '../../types';
import { useApp } from '../../context/SupabaseAppContext';
import Swal from 'sweetalert2';
import {
  generateCode128Value,
  normalizeCode128Value,
  renderBarcodeToCanvas,
} from '../../lib/barcodeUtils';
import { BarcodeStickerPrint } from './BarcodeStickerPrint';
import { CategoryModal } from './CategoryModal';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
}

export function ProductModal({ isOpen, onClose, product }: ProductModalProps) {
  const { dispatch, state } = useApp();
  
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    price: '',
    cost: '',
    stock: '',
    minStock: '',
    category: '',
    description: '',
    taxable: true,
    active: true,
    isWeightBased: false,
    pricePerUnit: '',
    unit: 'kg',
    image: '',
    trackInventory: true,
  });
  
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);
  const [showStickerPrint, setShowStickerPrint] = useState(false);
  const [savedProductForSticker, setSavedProductForSticker] = useState<Product | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const scanBufferRef = useRef<string>('');
  const lastScanKeyTimeRef = useRef<number>(0);
  const barcodePreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const stickerCountRef = useRef<number>(1);

  const loadCategories = async () => {
    try {
      const { categoriesService } = await import('../../lib/services');
      const cats = await categoriesService.getAll();
      setCategories(cats);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  const activeDbCategoryNames = categories.filter(c => c.active).map(c => c.name);
  const productCategoryNames = Array.from(new Set(state.products.map((p: Product) => p.category)));
  const mergedCategoryOptions = Array.from(new Set([...activeDbCategoryNames, ...productCategoryNames])).sort();

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        sku: product.sku,
        barcode: product.barcode || '',
        price: product.price.toString(),
        cost: product.cost.toString(),
        stock: product.stock.toString(),
        minStock: product.minStock.toString(),
        category: product.category,
        description: product.description,
        taxable: product.taxable,
        active: product.active,
        isWeightBased: product.isWeightBased || false,
        pricePerUnit: product.pricePerUnit?.toString() || '',
        unit: product.unit || 'kg',
        image: product.image || '',
        trackInventory: product.trackInventory ?? true,
      });
      setBatches(product.batches || []);
      setIsCustomCategory(!product.category || !mergedCategoryOptions.includes(product.category));
    } else {
      setFormData({
        name: '',
        sku: '',
        barcode: '',
        price: '',
        cost: '',
        stock: '',
        minStock: '',
        category: '',
        description: '',
        taxable: true,
        active: true,
        isWeightBased: false,
        pricePerUnit: '',
        unit: 'kg',
        image: '',
        trackInventory: true,
      });
      setBatches([]);
      setIsCustomCategory(false);
    }
  }, [product]);

  const handleBarcodeScanKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isBarcodeInputFocused = barcodeInputRef.current && target === barcodeInputRef.current;
    const isScanModeActive = isScanningBarcode;
    const now = Date.now();

    if (now - lastScanKeyTimeRef.current > 100) {
      scanBufferRef.current = '';
    }
    lastScanKeyTimeRef.current = now;

    if (e.key === 'Enter') {
      if (scanBufferRef.current.length >= 3) {
        e.preventDefault();
        e.stopPropagation();
        const scannedBarcode = normalizeCode128Value(scanBufferRef.current.trim());
        setFormData(prev => ({ ...prev, barcode: scannedBarcode }));
        setIsScanningBarcode(false);
        scanBufferRef.current = '';
        Swal.fire({
          title: 'Code 128 Barcode Scanned!',
          icon: 'success',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 1500,
          timerProgressBar: true,
        });
      } else if (isScanModeActive) {
        scanBufferRef.current = '';
      }
      return;
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const isFastInput = scanBufferRef.current.length > 0;
      if ((isScanModeActive || isFastInput) && !isBarcodeInputFocused) {
        e.preventDefault();
        e.stopPropagation();
      }
      scanBufferRef.current += e.key;
      if (scanBufferRef.current.length >= 2 && !isScanningBarcode && !isBarcodeInputFocused) {
        setIsScanningBarcode(true);
      }
    }
  }, [isScanningBarcode]);

  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener('keydown', handleBarcodeScanKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleBarcodeScanKeyDown, true);
    };
  }, [isOpen, handleBarcodeScanKeyDown]);

  useEffect(() => {
    if (isScanningBarcode) {
      barcodeInputRef.current?.focus();
      const timeout = setTimeout(() => {
        setIsScanningBarcode(false);
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [isScanningBarcode]);

  const startBarcodeScan = () => {
    setIsScanningBarcode(true);
    scanBufferRef.current = '';
    lastScanKeyTimeRef.current = Date.now();
  };

  const handleGenerateBarcode = () => {
    const newBarcode = generateCode128Value(formData.sku);
    setFormData(prev => ({ ...prev, barcode: newBarcode }));
    Swal.fire({
      title: 'Code 128 Barcode Generated!',
      icon: 'success',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 1500,
      timerProgressBar: true,
    });
  };

  useEffect(() => {
    if (barcodePreviewCanvasRef.current && formData.barcode) {
      const code128Barcode = normalizeCode128Value(formData.barcode);
      renderBarcodeToCanvas(barcodePreviewCanvasRef.current, code128Barcode, {
        format: 'CODE128',
        height: 54,
        fontSize: 12,
        margin: 6,
      });
    }
  }, [formData.barcode]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.name.trim()) {
      await Swal.fire({
        title: 'Error!',
        text: 'Please enter a product name',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      return;
    }

    if (!formData.category.trim()) {
      await Swal.fire({
        title: 'Error!',
        text: 'Please enter a category',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      return;
    }

    if (!formData.sku.trim()) {
      await Swal.fire({
        title: 'Error!',
        text: 'Please enter a SKU',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      return;
    }

    if (formData.isWeightBased) {
      if (!formData.pricePerUnit || parseFloat(formData.pricePerUnit) <= 0) {
        await Swal.fire({
          title: 'Error!',
          text: 'Please enter a valid price per unit for weight-based product',
          icon: 'error',
          confirmButtonText: 'OK'
        });
        return;
      }
    } else {
      if (!formData.price || parseFloat(formData.price) <= 0) {
        await Swal.fire({
          title: 'Error!',
          text: 'Please enter a valid price',
          icon: 'error',
          confirmButtonText: 'OK'
        });
        return;
      }
    }

    if (!formData.cost || parseFloat(formData.cost) < 0) {
      await Swal.fire({
        title: 'Error!',
        text: 'Please enter a valid cost price (or 0 if no cost)',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      return;
    }

    // Only validate stock fields if inventory tracking is enabled
    if (formData.trackInventory) {
      if (!formData.stock || parseInt(formData.stock) < 0) {
        await Swal.fire({
          title: 'Error!',
          text: 'Please enter a valid stock quantity',
          icon: 'error',
          confirmButtonText: 'OK'
        });
        return;
      }

      if (!formData.minStock || parseInt(formData.minStock) < 0) {
        await Swal.fire({
          title: 'Error!',
          text: 'Please enter a valid minimum stock level',
          icon: 'error',
          confirmButtonText: 'OK'
        });
        return;
      }
    }

    const normalizedBarcode = formData.barcode
      ? normalizeCode128Value(formData.barcode)
      : undefined;

    const productData: Product = {
      id: product?.id || Date.now().toString(),
      name: formData.name,
      sku: formData.sku,
      barcode: normalizedBarcode,
      price: formData.isWeightBased ? 0 : parseFloat(formData.price),
      cost: parseFloat(formData.cost),
      stock: formData.trackInventory ? parseInt(formData.stock) : 999999,
      minStock: formData.trackInventory ? parseInt(formData.minStock) : 0,
      category: formData.category,
      description: formData.description,
      taxable: formData.taxable,
      active: formData.active,
      isWeightBased: formData.isWeightBased,
      pricePerUnit: formData.isWeightBased ? parseFloat(formData.pricePerUnit) : undefined,
      unit: formData.isWeightBased ? formData.unit : undefined,
      image: formData.image || undefined,
      trackInventory: formData.trackInventory,
      batches,
      createdAt: product?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    try {
      const { productsService } = await import('../../lib/services');
      
      let finalProduct: Product;
      if (product) {
        await productsService.update(productData.id, productData);
        dispatch({ type: 'UPDATE_PRODUCT', payload: productData });
        finalProduct = productData;
        await Swal.fire({
          title: 'Success!',
          text: 'Product updated successfully',
          icon: 'success',
          confirmButtonText: 'OK'
        });
      } else {
        const newProduct = await productsService.create(productData);
        dispatch({ type: 'ADD_PRODUCT', payload: newProduct });
        finalProduct = newProduct;
        resetAddProductForm();
        const result = await Swal.fire({
          title: 'Product Added Successfully!',
          text: 'Fields cleared. Add another product, print stickers, or close.',
          icon: 'success',
          showDenyButton: true,
          showCancelButton: true,
          confirmButtonText: 'Print Stickers',
          denyButtonText: 'Add Another',
          cancelButtonText: 'Close',
        });
        if (result.isConfirmed && finalProduct.barcode) {
          setSavedProductForSticker(finalProduct);
          setShowStickerPrint(true);
          return;
        }
        if (result.isDismissed) {
          onClose();
          return;
        }
      }
      if (product) {
        onClose();
      }
    } catch (error) {
      console.error('Error saving product:', error);
      await Swal.fire({
        title: 'Error!',
        text: 'Failed to save product. Please try again.',
        icon: 'error',
        confirmButtonText: 'OK'
      });
    }
  };

  const calculateSuggestedSalePrice = (cost: number): number | null => {
    if (cost <= 0) return null;
    let multiplier: number | null = null;
    if (cost < 1000) multiplier = 1.50;
    else if (cost < 5000) multiplier = 1.45;
    else if (cost < 25000) multiplier = 1.40;
    else if (cost < 50000) multiplier = 1.35;
    else if (cost < 100000) multiplier = 1.30;
    else if (cost <= 250000) multiplier = 1.25;
    if (multiplier === null) return null;
    return Math.round((cost * multiplier) * 100) / 100;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : false;
    setFormData(prev => {
      const next: typeof prev = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };
      if (name === 'cost' && !formData.isWeightBased) {
        const costNum = parseFloat(value);
        const suggested = calculateSuggestedSalePrice(costNum);
        if (suggested !== null) {
          next.price = suggested.toString();
        }
      }
      return next;
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData(prev => ({
          ...prev,
          image: event.target?.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const resetAddProductForm = () => {
    setFormData({
      name: '',
      sku: '',
      barcode: '',
      price: '',
      cost: '',
      stock: '',
      minStock: '',
      category: '',
      description: '',
      taxable: true,
      active: true,
      isWeightBased: false,
      pricePerUnit: '',
      unit: 'kg',
      image: '',
      trackInventory: true,
    });
    setBatches([]);
    setIsCustomCategory(false);
    setSavedProductForSticker(null);
  };

  const addBatch = () => {
    const newBatch: ProductBatch = {
      id: Date.now().toString(),
      batchNumber: `BATCH-${Date.now().toString().slice(-6)}`,
      manufacturingDate: new Date(),
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      quantity: 0,
      costPrice: parseFloat(formData.cost) || 0,
      supplierInfo: '',
    };
    setBatches(prev => [...prev, newBatch]);
  };

  const updateBatch = (index: number, field: keyof ProductBatch, value: any) => {
    setBatches(prev => prev.map((batch, i) => 
      i === index ? { ...batch, [field]: value } : batch
    ));
  };

  const removeBatch = (index: number) => {
    setBatches(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="modal-overlay">
      <div className="modal max-w-4xl">
        <div className="modal-header">
          <h2 className="text-xl font-bold text-gray-900">
            {product ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="modal-body space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="input"
                  placeholder="Enter product name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category *
                </label>
                <div className="space-y-2">
                  {!isCustomCategory ? (
                    <div className="flex gap-2">
                      <select
                        name="category"
                        value={mergedCategoryOptions.includes(formData.category) ? formData.category : ''}
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            setIsCustomCategory(true);
                            setFormData(prev => ({ ...prev, category: '' }));
                          } else {
                            setFormData(prev => ({ ...prev, category: e.target.value }));
                          }
                        }}
                        className="select flex-1"
                        required
                      >
                        <option value="">Select category...</option>
                        {mergedCategoryOptions.map(catName => (
                          <option key={catName} value={catName}>{catName}</option>
                        ))}
                        <option value="__custom__">✏️ Type custom category...</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowCategoryModal(true)}
                        className="btn btn-secondary px-3 flex items-center gap-1"
                        title="Manage categories"
                      >
                        <FolderPlus className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={loadCategories}
                        className="btn btn-secondary px-3"
                        title="Refresh categories"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                        required
                        className="input flex-1"
                        placeholder="Enter custom category name..."
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomCategory(false);
                        }}
                        className="btn btn-secondary whitespace-nowrap"
                      >
                        ← Pick from list
                      </button>
                    </div>
                  )}
                  {formData.category && !mergedCategoryOptions.includes(formData.category) && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      ⚠️ This is a new custom category. It will be saved with the product but won't appear in category management until added explicitly.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SKU *
                </label>
                <input
                  type="text"
                  name="sku"
                  value={formData.sku}
                  onChange={handleChange}
                  required
                  className="input"
                  placeholder="Enter SKU"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Barcode
                </label>
                <div className="flex space-x-2 mb-2">
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    name="barcode"
                    value={formData.barcode}
                    onChange={handleChange}
                    className={`input flex-1 ${isScanningBarcode ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
                    placeholder={isScanningBarcode ? 'Scan barcode now...' : 'Enter or generate barcode'}
                  />
                  <button
                    type="button"
                    onClick={handleGenerateBarcode}
                    className="btn btn-secondary whitespace-nowrap flex items-center space-x-2"
                    title="Generate auto barcode"
                  >
                    <Wand2 className="h-4 w-4" />
                    <span>Generate</span>
                  </button>
                  <button
                    type="button"
                    onClick={startBarcodeScan}
                    className={`btn ${isScanningBarcode ? 'btn-primary animate-pulse' : 'btn-secondary'} whitespace-nowrap flex items-center space-x-2`}
                  >
                    <ScanLine className="h-4 w-4" />
                    <span>{isScanningBarcode ? 'Scanning...' : 'Scan'}</span>
                  </button>
                </div>
                {formData.barcode && (
                  <div className="p-3 bg-white border border-gray-200 rounded-xl flex flex-col items-center">
                    <canvas ref={barcodePreviewCanvasRef} className="max-w-full" />
                  </div>
                )}
                {isScanningBarcode && (
                  <p className="text-xs text-blue-600 mt-1 flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                    Waiting for barcode scanner input (10s timeout)
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="textarea"
                  placeholder="Enter product description"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing & Stock</h3>
            
            <div className="mb-4">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  name="isWeightBased"
                  checked={formData.isWeightBased}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-5 w-5"
                />
                <div className="flex items-center space-x-2">
                  <Scale className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Weight-based pricing</span>
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cost Price *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="cost"
                  value={formData.cost}
                  onChange={handleChange}
                  required
                  className="input"
                  placeholder="0.00"
                />
              </div>

              {formData.isWeightBased ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Price per Unit *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="pricePerUnit"
                      value={formData.pricePerUnit}
                      onChange={handleChange}
                      required
                      className="input"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="md:col-start-2 md:row-start-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Unit *
                    </label>
                    <select
                      name="unit"
                      value={formData.unit}
                      onChange={handleChange}
                      className="select"
                    >
                      <option value="kg">Kilogram (kg)</option>
                      <option value="g">Gram (g)</option>
                      <option value="lb">Pound (lb)</option>
                      <option value="oz">Ounce (oz)</option>
                      <option value="l">Liter (l)</option>
                      <option value="ml">Milliliter (ml)</option>
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sale Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    required
                    className="input"
                    placeholder="0.00"
                  />
                  {formData.cost && parseFloat(formData.cost) > 250000 && (
                    <p className="text-xs text-amber-600 mt-1">
                      ℹ️ Cost exceeds Rs 250,000 — please enter sale price manually
                    </p>
                  )}
                  {formData.cost && parseFloat(formData.cost) <= 250000 && parseFloat(formData.cost) > 0 && (
                    <p className="text-xs text-emerald-600 mt-1">
                      ✓ Auto-calculated from cost. You can adjust manually.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 mb-4">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  name="trackInventory"
                  checked={formData.trackInventory}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-5 w-5"
                />
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">Track inventory for this product</span>
                </div>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-8">
                When disabled, stock levels won't be managed and inventory won't be deducted during sales
              </p>
            </div>

            {formData.trackInventory && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Stock *
                  </label>
                  <input
                    type="number"
                    min="0"
                    name="stock"
                    value={formData.stock}
                    onChange={handleChange}
                    required
                    className="input"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Stock Level *
                  </label>
                  <input
                    type="number"
                    min="0"
                    name="minStock"
                    value={formData.minStock}
                    onChange={handleChange}
                    required
                    className="input"
                    placeholder="0"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Image</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="input"
                />
              </div>
              
              {formData.image && (
                <div className="flex items-center space-x-4">
                  <img
                    src={formData.image}
                    alt="Product preview"
                    className="h-20 w-20 object-cover rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                    className="btn btn-secondary btn-sm"
                  >
                    Remove Image
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Batch Management</h3>
                <p className="text-sm text-gray-600">Track manufacturing and expiry dates for better inventory control</p>
              </div>
              <button
                type="button"
                onClick={addBatch}
                className="btn btn-primary btn-sm"
              >
                Add Batch
              </button>
            </div>
            
            {batches.length > 0 && (
              <div className="space-y-4 max-h-64 overflow-y-auto">
                {batches.map((batch, index) => (
                  <div key={batch.id} className="card p-4 border border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Batch Number
                        </label>
                        <input
                          type="text"
                          value={batch.batchNumber}
                          onChange={(e) => updateBatch(index, 'batchNumber', e.target.value)}
                          className="input input-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Manufacturing Date
                        </label>
                        <input
                          type="date"
                          value={batch.manufacturingDate.toISOString().split('T')[0]}
                          onChange={(e) => updateBatch(index, 'manufacturingDate', new Date(e.target.value))}
                          className="input input-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Expiry Date
                        </label>
                        <input
                          type="date"
                          value={batch.expiryDate.toISOString().split('T')[0]}
                          onChange={(e) => updateBatch(index, 'expiryDate', new Date(e.target.value))}
                          className="input input-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={batch.quantity}
                          onChange={(e) => updateBatch(index, 'quantity', parseInt(e.target.value))}
                          className="input input-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Cost Price
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={batch.costPrice}
                          onChange={(e) => updateBatch(index, 'costPrice', parseFloat(e.target.value))}
                          className="input input-sm"
                        />
                      </div>
                      
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => removeBatch(index)}
                          className="btn btn-danger btn-sm w-full"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-6">
            <div className="flex space-x-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="taxable"
                  checked={formData.taxable}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-5 w-5"
                />
                <span className="ml-2 text-sm text-gray-700">Taxable</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="active"
                  checked={formData.active}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-5 w-5"
                />
                <span className="ml-2 text-sm text-gray-700">Active</span>
              </label>
            </div>
          </div>
        </div>

        <div className="modal-footer justify-between">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-md"
          >
            Cancel
          </button>
          <div className="flex items-center space-x-2">
            {product?.barcode && (
              <button
                type="button"
                onClick={() => {
                  setSavedProductForSticker(product);
                  setShowStickerPrint(true);
                }}
                className="btn btn-secondary btn-md flex items-center space-x-2"
              >
                <Printer className="h-4 w-4" />
                <span>Print Sticker</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              className="btn btn-primary btn-md"
            >
              {product ? 'Update Product' : 'Add Product'}
            </button>
          </div>
        </div>
      </div>

      <BarcodeStickerPrint
        isOpen={showStickerPrint}
        onClose={() => {
          setShowStickerPrint(false);
          setSavedProductForSticker(null);
        }}
        product={savedProductForSticker || (product as Product)}
      />

      <CategoryModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onCategoriesChanged={() => {
          loadCategories();
        }}
      />
    </div>
  );
}

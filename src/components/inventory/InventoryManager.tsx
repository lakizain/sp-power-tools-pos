import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Edit, Trash2, Package, AlertTriangle, TrendingUp, TrendingDown, Printer, FolderPlus, CalendarRange, Download, SlidersHorizontal, Tag, ArrowUpDown } from 'lucide-react';
import { Product, ProductCategory } from '../../types';
import { useApp } from '../../context/SupabaseAppContext';
import { ProductModal } from './ProductModal';
import { BarcodeStickerPrint } from './BarcodeStickerPrint';
import { CategoryModal } from './CategoryModal';
import { StockAdjustmentModal } from './StockAdjustmentModal';
import { swalConfig } from '../../lib/sweetAlert';
import { matchesAnyField, sortBySearchRelevance } from '../../lib/searchUtils';
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek } from 'date-fns';
import { TablePrintModal, PrintColumn, PrintSummary, PrintFilterInfo } from '../ui/TablePrintModal';

export function InventoryManager() {
  const { state } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showStickerPrint, setShowStickerPrint] = useState(false);
  const [stickerPrintProduct, setStickerPrintProduct] = useState<Product | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'price'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [dbCategories, setDbCategories] = useState<ProductCategory[]>([]);
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [datePreset, setDatePreset] = useState('all');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [showStockAdjustModal, setShowStockAdjustModal] = useState(false);
  const [stockAdjustProducts, setStockAdjustProducts] = useState<Product[]>([]);

  const loadDbCategories = async () => {
    try {
      const { categoriesService } = await import('../../lib/services');
      const cats = await categoriesService.getAll();
      setDbCategories(cats);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  useEffect(() => {
    loadDbCategories();
  }, []);

  const activeDbCategoryNames = dbCategories.filter(c => c.active).map(c => c.name);
  const productCategoryNames = Array.from(new Set(state.products.map((p: Product) => p.category)));
  const allCategoryNames = Array.from(new Set([...activeDbCategoryNames, ...productCategoryNames])).sort();
  const categories = ['All', ...allCategoryNames];

  const filteredProducts = useMemo(() => {
    const filtered = state.products
      .filter(product => {
        const matchesSearch = matchesAnyField(
          [
            product.name,
            product.sku,
            product.barcode,
            product.description,
            product.category,
          ],
          searchTerm
        );
        const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;

        let matchesStock = true;
        if (stockFilter !== 'all') {
          const trackInv = product.trackInventory !== false;
          const isLow = trackInv && product.stock <= (product.minStock || 0);
          const isOut = trackInv && product.stock === 0;
          switch (stockFilter) {
            case 'in_stock': matchesStock = !isOut; break;
            case 'low_stock': matchesStock = isLow && !isOut; break;
            case 'out_of_stock': matchesStock = isOut; break;
          }
        }

        let matchesDate = true;
        const createdDate = new Date(product.createdAt);
        if (datePreset === 'custom') {
          if (customFromDate) {
            const from = new Date(customFromDate);
            from.setHours(0, 0, 0, 0);
            matchesDate = matchesDate && createdDate >= from;
          }
          if (customToDate) {
            const to = new Date(customToDate);
            to.setHours(23, 59, 59, 999);
            matchesDate = matchesDate && createdDate <= to;
          }
        } else if (datePreset !== 'all') {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          switch (datePreset) {
            case 'today': {
              const tStart = new Date(today);
              const tEnd = new Date(today);
              tEnd.setHours(23, 59, 59, 999);
              matchesDate = createdDate >= tStart && createdDate <= tEnd;
              break;
            }
            case 'week': {
              const ws = startOfWeek(today, { weekStartsOn: 1 });
              const we = new Date();
              we.setHours(23, 59, 59, 999);
              matchesDate = createdDate >= ws && createdDate <= we;
              break;
            }
            case 'month': {
              const ms = startOfMonth(today);
              const me = endOfMonth(today);
              matchesDate = createdDate >= ms && createdDate <= me;
              break;
            }
            case 'last_month': {
              const last = subMonths(today, 1);
              matchesDate = createdDate >= startOfMonth(last) && createdDate <= endOfMonth(last);
              break;
            }
            case 'last_3_months': {
              const threeAgo = subMonths(today, 3);
              const nowEnd = new Date();
              nowEnd.setHours(23, 59, 59, 999);
              matchesDate = createdDate >= startOfMonth(threeAgo) && createdDate <= nowEnd;
              break;
            }
            case 'year': {
              const ys = new Date(today.getFullYear(), 0, 1);
              const ye = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
              matchesDate = createdDate >= ys && createdDate <= ye;
              break;
            }
          }
        }

        return matchesSearch && matchesCategory && matchesStock && matchesDate;
      });
    const sortedByRelevance = sortBySearchRelevance(
      filtered,
      searchTerm,
      p => `${p.name} ${p.sku} ${p.barcode || ''}`
    );
    return sortedByRelevance.sort((a, b) => {
      if (searchTerm) {
        const scoreA = Number(searchTerm.toLowerCase() === a.name.toLowerCase()) * 100 +
          Number(a.name.toLowerCase().startsWith(searchTerm.toLowerCase())) * 50 +
          Number(a.sku.toLowerCase().startsWith(searchTerm.toLowerCase())) * 50;
        const scoreB = Number(searchTerm.toLowerCase() === b.name.toLowerCase()) * 100 +
          Number(b.name.toLowerCase().startsWith(searchTerm.toLowerCase())) * 50 +
          Number(b.sku.toLowerCase().startsWith(searchTerm.toLowerCase())) * 50;
        if (scoreA !== scoreB) return scoreB - scoreA;
      }
      let aValue: string | number;
      let bValue: string | number;
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'stock':
          aValue = a.stock;
          bValue = b.stock;
          break;
        case 'price':
          aValue = a.price;
          bValue = b.price;
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }, [state.products, searchTerm, selectedCategory, sortBy, sortOrder, stockFilter, datePreset, customFromDate, customToDate]);

  const exportProducts = () => {
    const csvContent = [
      ['SKU', 'Product Name', 'Category', 'Price', 'Cost', 'Stock', 'Min Stock', 'Barcode', 'Track Inventory', 'Created'].join(','),
      ...filteredProducts.map(p => [
        p.sku,
        `"${p.name.replace(/"/g, '""')}"`,
        p.category,
        p.price.toFixed(2),
        p.cost.toFixed(2),
        p.stock,
        p.minStock,
        p.barcode || '',
        p.trackInventory ? 'Yes' : 'No',
        format(new Date(p.createdAt), 'yyyy-MM-dd'),
      ].join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const printColumns: PrintColumn<Product>[] = [
    { key: 'sku', header: 'SKU', accessor: (p) => p.sku, width: '10%', align: 'left' },
    { key: 'name', header: 'Product Name', accessor: (p) => p.name, width: '22%' },
    { key: 'category', header: 'Category', accessor: (p) => p.category, width: '12%' },
    { key: 'price', header: 'Price', accessor: (p) => `$ ${p.price.toFixed(2)}`, width: '9%', align: 'right' },
    { key: 'cost', header: 'Cost', accessor: (p) => `$ ${p.cost.toFixed(2)}`, width: '9%', align: 'right' },
    { key: 'stock', header: 'Stock', accessor: (p) => p.stock, width: '7%', align: 'right' },
    { key: 'minStock', header: 'Min', accessor: (p) => p.minStock, width: '6%', align: 'right' },
    { key: 'value', header: 'Stock Value', accessor: (p) => `$ ${(p.stock * p.cost).toFixed(2)}`, width: '11%', align: 'right' },
    { key: 'barcode', header: 'Barcode', accessor: (p) => p.barcode || '-', width: '10%' },
    { key: 'created', header: 'Created', accessor: (p) => format(new Date(p.createdAt), 'yyyy-MM-dd'), width: '4%' },
  ];

  const filterStats = useMemo(() => {
    const totalCount = filteredProducts.length;
    const low = filteredProducts.filter(p => p.trackInventory && p.stock <= p.minStock && p.stock > 0).length;
    const out = filteredProducts.filter(p => p.trackInventory && p.stock === 0).length;
    const invVal = filteredProducts.reduce((s, p) => s + (p.stock * p.cost), 0);
    const totalValue = state.products.reduce((s: number, p: Product) => s + (p.stock * p.cost), 0);
    return { totalCount, low, out, invVal, totalValue };
  }, [filteredProducts, state.products]);

  const printSummaries: PrintSummary[] = [
    { label: 'Products (Filtered)', value: String(filterStats.totalCount), highlight: true },
    { label: 'Low Stock', value: String(filterStats.low) },
    { label: 'Out of Stock', value: String(filterStats.out) },
    { label: 'Inventory Value', value: `$ ${filterStats.invVal.toFixed(2)}` },
  ];

  const getDateFilterLabel = (): string => {
    switch (datePreset) {
      case 'all': return 'All Time';
      case 'today': return 'Created Today';
      case 'week': return 'Created This Week';
      case 'month': return 'Created This Month';
      case 'last_month': return 'Created Last Month';
      case 'last_3_months': return 'Created Last 3 Months';
      case 'year': return 'Created This Year';
      case 'custom':
        if (customFromDate && customToDate) return `${customFromDate} → ${customToDate}`;
        if (customFromDate) return `From ${customFromDate}`;
        if (customToDate) return `Up to ${customToDate}`;
        return 'Custom';
      default: return 'All Time';
    }
  };

  const stockFilterLabel = stockFilter === 'all' ? 'All' : stockFilter === 'in_stock' ? 'In Stock Only' : stockFilter === 'low_stock' ? 'Low Stock Only' : 'Out of Stock Only';

  const printFilters: PrintFilterInfo[] = [
    { label: 'Date Created', value: getDateFilterLabel() },
    ...(selectedCategory !== 'All' ? [{ label: 'Category', value: selectedCategory }] : []),
    ...(stockFilter !== 'all' ? [{ label: 'Stock Status', value: stockFilterLabel }] : []),
    ...(searchTerm ? [{ label: 'Search', value: searchTerm }] : []),
  ];

  const lowStockProducts = state.products.filter((p: Product) => p.trackInventory && p.stock <= p.minStock);
  const totalValue = state.products.reduce((sum: number, p: Product) => sum + (p.stock * p.cost), 0);
  const outOfStockProducts = state.products.filter((p: Product) => p.trackInventory && p.stock === 0);

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setShowProductModal(true);
  };

  const handleDeleteProduct = async (productId: string) => {
    const result = await swalConfig.deleteConfirm('product');
    if (result.isConfirmed) {
      try {
        swalConfig.loading('Deleting product...');
        const { productsService } = await import('../../lib/services');
        await productsService.delete(productId);
        // Re-fetch products or update state
        window.location.reload(); // Simple approach for now
        swalConfig.success('Product deleted successfully!');
      } catch (error) {
        console.error('Error deleting product:', error);
        swalConfig.error('Failed to delete product. Please try again.');
      }
    }
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setShowProductModal(true);
  };

  const handlePrintSticker = (product: Product) => {
    if (!product.barcode) {
      swalConfig.error('This product does not have a barcode. Edit the product and generate a barcode first.');
      return;
    }
    setStickerPrintProduct(product);
    setShowStickerPrint(true);
  };

  const handleToggleSelect = (productId: string) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedProductIds.size === filteredProducts.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const handleSingleStockAdjust = (product: Product) => {
    setStockAdjustProducts([product]);
    setShowStockAdjustModal(true);
  };

  const handleBulkStockAdjust = () => {
    const selected = filteredProducts.filter(p => selectedProductIds.has(p.id));
    if (selected.length === 0) {
      swalConfig.error('Please select at least one product to adjust stock.');
      return;
    }
    setStockAdjustProducts(selected);
    setShowStockAdjustModal(true);
  };

  const handleOpenStockAdjustment = (existingProduct: Product) => {
    setShowProductModal(false);
    setEditingProduct(null);
    setStockAdjustProducts([existingProduct]);
    setShowStockAdjustModal(true);
  };

  const handleStockAdjustmentComplete = () => {
    setSelectedProductIds(new Set());
    window.location.reload();
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 bg-gray-50 min-h-full">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-600 mt-1">Manage your products and stock levels</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          {selectedProductIds.size > 0 && (
            <button
              onClick={handleBulkStockAdjust}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-all font-medium shadow-md shadow-indigo-200"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Adjust Stock ({selectedProductIds.size})</span>
            </button>
          )}
          <button
            onClick={() => setShowPrintModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium"
          >
            <Printer className="h-4 w-4" />
            <span>Print PDF</span>
          </button>
          <button
            onClick={exportProducts}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setShowCategoryModal(true)}
            className="btn btn-secondary btn-lg"
          >
            <FolderPlus className="h-5 w-5" />
            <span>Manage Categories</span>
          </button>
          <button
            onClick={handleAddProduct}
            className="btn btn-primary btn-lg"
          >
            <Plus className="h-5 w-5" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="stat-card bg-gradient-to-br from-blue-500 to-blue-600">
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Products</p>
              <p className="text-2xl lg:text-3xl font-bold">{state.products.length}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-2xl">
              <Package className="h-6 w-6 lg:h-8 lg:w-8" />
            </div>
          </div>
        </div>

        <div className="stat-card bg-gradient-to-br from-orange-500 to-orange-600">
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-orange-100 text-sm font-medium">Low Stock Items</p>
              <p className="text-2xl lg:text-3xl font-bold">{lowStockProducts.length}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-2xl">
              <AlertTriangle className="h-6 w-6 lg:h-8 lg:w-8" />
            </div>
          </div>
        </div>

        <div className="stat-card bg-gradient-to-br from-green-500 to-green-600">
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-green-100 text-sm font-medium">Inventory Value</p>
              <p className="text-xl lg:text-2xl font-bold">$ {totalValue.toFixed(2)}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-2xl">
              <TrendingUp className="h-6 w-6 lg:h-8 lg:w-8" />
            </div>
          </div>
        </div>

        <div className="stat-card bg-gradient-to-br from-red-500 to-red-600">
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-red-100 text-sm font-medium">Out of Stock</p>
              <p className="text-2xl lg:text-3xl font-bold">{outOfStockProducts.length}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-2xl">
              <TrendingDown className="h-6 w-6 lg:h-8 lg:w-8" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white p-4 md:p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search products by name, SKU, or barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="relative">
            <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
            >
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as 'all' | 'in_stock' | 'low_stock' | 'out_of_stock')}
              className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
            >
              <option value="all">All Stock Status</option>
              <option value="in_stock">📦 In Stock</option>
              <option value="low_stock">⚠️ Low Stock</option>
              <option value="out_of_stock">🔴 Out of Stock</option>
            </select>
          </div>

          <div className="relative">
            <ArrowUpDown className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field as 'name' | 'stock' | 'price');
                setSortOrder(order as 'asc' | 'desc');
              }}
              className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
            >
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="stock-asc">Stock Low-High</option>
              <option value="stock-desc">Stock High-Low</option>
              <option value="price-asc">Price Low-High</option>
              <option value="price-desc">Price High-Low</option>
            </select>
          </div>

          <div className="relative">
            <CalendarRange className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value)}
              className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
            >
              <option value="all">📅 All Products (No Date Filter)</option>
              <option value="today">🗓️ Created Today</option>
              <option value="week">📆 Created This Week</option>
              <option value="month">📊 Created This Month</option>
              <option value="last_month">📅 Created Last Month</option>
              <option value="last_3_months">📈 Last 3 Months</option>
              <option value="year">🗃️ Created This Year</option>
              <option value="custom">🎯 Custom Date Range...</option>
            </select>
          </div>

          {datePreset === 'custom' && (
            <>
              <div>
                <input
                  type="date"
                  value={customFromDate}
                  onChange={(e) => setCustomFromDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="From (Created)"
                />
              </div>
              <div>
                <input
                  type="date"
                  value={customToDate}
                  onChange={(e) => setCustomToDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="To (Created)"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Products Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell w-12">
                  <input
                    type="checkbox"
                    checked={filteredProducts.length > 0 && selectedProductIds.size === filteredProducts.length}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                  />
                </th>
                <th className="table-header-cell">Product</th>
                <th className="table-header-cell">SKU</th>
                <th className="table-header-cell">Category</th>
                <th className="table-header-cell">Price</th>
                <th className="table-header-cell">Cost</th>
                <th className="table-header-cell">Stock</th>
                <th className="table-header-cell">Status</th>
                <th className="table-header-cell text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map((product) => {
                const isLowStock = product.trackInventory && product.stock <= product.minStock;
                const isOutOfStock = product.trackInventory && product.stock === 0;
                const isSelected = selectedProductIds.has(product.id);
                
                return (
                  <tr key={product.id} className={`table-row ${isSelected ? 'bg-indigo-50/50' : ''}`}>
                    <td className="table-cell w-12">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(product.id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                      />
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center">
                        <div className="h-10 w-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Package className="h-5 w-5 text-gray-400" />
                        </div>
                        <div className="ml-4 min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate">{product.name}</div>
                          <div className="text-xs text-gray-500 truncate">{product.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell font-mono text-sm">{product.sku}</td>
                    <td className="table-cell">
                      <span className="badge badge-info">{product.category}</span>
                    </td>
                    <td className="table-cell font-semibold">
                      $ {product.price.toFixed(2)}
                    </td>
                    <td className="table-cell text-gray-600">
                      $ {product.cost.toFixed(2)}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center space-x-2">
                        <span className={`font-medium ${
                          isOutOfStock ? 'text-red-600' : isLowStock ? 'text-orange-600' : 'text-gray-900'
                        }`}>
                          {product.stock}
                        </span>
                        {isLowStock && (
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                        )}
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${
                        isOutOfStock
                          ? 'badge-danger'
                          : isLowStock
                          ? 'badge-warning'
                          : 'badge-success'
                      }`}>
                        {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
                      </span>
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => handleSingleStockAdjust(product)}
                          className="text-indigo-600 hover:text-indigo-900 p-2 rounded-lg hover:bg-indigo-50 transition-colors"
                          title="Adjust stock level"
                        >
                          <SlidersHorizontal className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handlePrintSticker(product)}
                          className={`p-2 rounded-lg transition-colors ${product.barcode ? 'text-green-600 hover:text-green-900 hover:bg-green-50' : 'text-gray-300 cursor-not-allowed'}`}
                          title={product.barcode ? 'Print barcode sticker' : 'No barcode - generate one first'}
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEditProduct(product)}
                          className="text-blue-600 hover:text-blue-900 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ProductModal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        product={editingProduct}
        onOpenStockAdjustment={handleOpenStockAdjustment}
      />

      <BarcodeStickerPrint
        isOpen={showStickerPrint}
        onClose={() => {
          setShowStickerPrint(false);
          setStickerPrintProduct(null);
        }}
        product={stickerPrintProduct as Product}
      />

      <CategoryModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onCategoriesChanged={() => {
          loadDbCategories();
        }}
      />

      <StockAdjustmentModal
        isOpen={showStockAdjustModal}
        onClose={() => {
          setShowStockAdjustModal(false);
          setStockAdjustProducts([]);
        }}
        products={stockAdjustProducts}
        onAdjustmentComplete={handleStockAdjustmentComplete}
      />

      <TablePrintModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="Inventory Product List"
        subtitle="Products with applied filters and stock information"
        columns={printColumns}
        data={filteredProducts}
        summaries={printSummaries}
        filters={printFilters}
        orientation="landscape"
      />
    </div>
  );
}
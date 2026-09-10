import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, FolderPlus } from 'lucide-react';
import { ProductCategory } from '../../types';
import Swal from 'sweetalert2';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesChanged?: () => void;
}

export function CategoryModal({ isOpen, onClose, onCategoriesChanged }: CategoryModalProps) {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [showAddEdit, setShowAddEdit] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    active: true,
  });

  const loadCategories = async () => {
    setLoading(true);
    try {
      const { categoriesService } = await import('../../lib/services');
      const cats = await categoriesService.getAll();
      setCategories(cats);
    } catch (error) {
      console.error('Error loading categories:', error);
      Swal.fire({
        title: 'Error!',
        text: 'Failed to load categories',
        icon: 'error',
        confirmButtonText: 'OK',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  useEffect(() => {
    if (editingCategory) {
      setFormData({
        name: editingCategory.name,
        description: editingCategory.description || '',
        active: editingCategory.active,
      });
      setShowAddEdit(true);
    } else {
      setFormData({
        name: '',
        description: '',
        active: true,
      });
    }
  }, [editingCategory]);

  if (!isOpen) return null;

  const handleAddNew = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      active: true,
    });
    setShowAddEdit(true);
  };

  const handleCancelEdit = () => {
    setShowAddEdit(false);
    setEditingCategory(null);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      await Swal.fire({
        title: 'Error!',
        text: 'Please enter a category name',
        icon: 'error',
        confirmButtonText: 'OK',
      });
      return;
    }

    try {
      const { categoriesService } = await import('../../lib/services');
      const categoryData = {
        name: formData.name.trim(),
        description: formData.description.trim() || '',
        active: formData.active,
      };

      if (editingCategory) {
        await categoriesService.update(editingCategory.id, categoryData);
        await Swal.fire({
          title: 'Success!',
          text: 'Category updated successfully',
          icon: 'success',
          confirmButtonText: 'OK',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000,
        });
      } else {
        await categoriesService.create(categoryData);
        await Swal.fire({
          title: 'Success!',
          text: 'Category added successfully',
          icon: 'success',
          confirmButtonText: 'OK',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000,
        });
      }

      setShowAddEdit(false);
      setEditingCategory(null);
      await loadCategories();
      onCategoriesChanged?.();
    } catch (error: any) {
      console.error('Error saving category:', error);
      let errorMsg = 'Failed to save category. Please try again.';
      if (error?.message?.includes('duplicate') || error?.message?.includes('unique')) {
        errorMsg = 'A category with this name already exists.';
      }
      await Swal.fire({
        title: 'Error!',
        text: errorMsg,
        icon: 'error',
        confirmButtonText: 'OK',
      });
    }
  };

  const handleDelete = async (category: ProductCategory) => {
    const result = await Swal.fire({
      title: 'Delete Category?',
      text: `Are you sure you want to delete "${category.name}"? Products in this category will NOT be deleted but their category field will remain unchanged.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
    });

    if (!result.isConfirmed) return;

    try {
      const { categoriesService } = await import('../../lib/services');
      await categoriesService.delete(category.id);
      await Swal.fire({
        title: 'Deleted!',
        text: 'Category deleted successfully',
        icon: 'success',
        confirmButtonText: 'OK',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
      });
      await loadCategories();
      onCategoriesChanged?.();
    } catch (error) {
      console.error('Error deleting category:', error);
      await Swal.fire({
        title: 'Error!',
        text: 'Failed to delete category. Please try again.',
        icon: 'error',
        confirmButtonText: 'OK',
      });
    }
  };

  const handleToggleActive = async (category: ProductCategory) => {
    try {
      const { categoriesService } = await import('../../lib/services');
      await categoriesService.update(category.id, { active: !category.active });
      await loadCategories();
      onCategoriesChanged?.();
    } catch (error) {
      console.error('Error toggling category:', error);
    }
  };

  return (
    <div className="modal-overlay z-50">
      <div className="modal max-w-5xl">
        <div className="modal-header">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FolderPlus className="h-6 w-6 text-blue-600" />
            Category Management
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="modal-body space-y-6">
          {!showAddEdit ? (
            <>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-gray-600">
                    Manage product categories. Add, edit, or delete categories used for organizing products.
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Total categories: <span className="font-semibold">{categories.length}</span>
                  </p>
                </div>
                <button
                  onClick={handleAddNew}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  Add Category
                </button>
              </div>

              {loading ? (
                <div className="text-center py-12 text-gray-500">Loading categories...</div>
              ) : categories.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl">
                  <FolderPlus className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 font-medium">No categories yet</p>
                  <p className="text-sm text-gray-400 mt-1">Click "Add Category" to get started</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead className="table-header">
                      <tr>
                        <th className="table-header-cell">Name</th>
                        <th className="table-header-cell">Description</th>
                        <th className="table-header-cell">Status</th>
                        <th className="table-header-cell">Products</th>
                        <th className="table-header-cell text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {categories.map((category) => (
                        <tr key={category.id} className="table-row">
                          <td className="table-cell font-semibold text-gray-900">
                            {category.name}
                          </td>
                          <td className="table-cell text-gray-600 text-sm max-w-xs truncate">
                            {category.description || <span className="text-gray-400 italic">No description</span>}
                          </td>
                          <td className="table-cell">
                            <button
                              onClick={() => handleToggleActive(category)}
                              className={`badge cursor-pointer transition-colors ${
                                category.active
                                  ? 'badge-success hover:bg-green-100'
                                  : 'badge-gray hover:bg-gray-200'
                              }`}
                            >
                              {category.active ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="table-cell text-gray-500">
                            <span className="text-sm">—</span>
                          </td>
                          <td className="table-cell text-right">
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                onClick={() => setEditingCategory(category)}
                                className="text-blue-600 hover:text-blue-900 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                                title="Edit category"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(category)}
                                className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                title="Delete category"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingCategory ? 'Edit Category' : 'Add New Category'}
                </h3>
                <button
                  onClick={handleCancelEdit}
                  className="text-gray-500 hover:text-gray-700 text-sm underline"
                >
                  ← Back to list
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    className="input"
                    placeholder="e.g. Power Tools, Electronics, Accessories..."
                    autoFocus
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="textarea"
                    placeholder="Optional description for this category..."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData((prev) => ({ ...prev, active: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-5 w-5"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-700">Active</span>
                      <p className="text-xs text-gray-500">
                        Inactive categories won't appear in product dropdowns
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer justify-between">
          <button
            type="button"
            onClick={showAddEdit ? handleCancelEdit : onClose}
            className="btn btn-secondary btn-md"
          >
            {showAddEdit ? 'Cancel' : 'Close'}
          </button>
          {showAddEdit && (
            <button
              type="button"
              onClick={handleSubmit}
              className="btn btn-primary btn-md"
            >
              {editingCategory ? 'Update Category' : 'Save Category'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

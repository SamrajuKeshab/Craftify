import {
  Edit3,
  FolderTree,
  Image as ImageIcon,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import {
  createAdminCategory,
  deleteAdminCategory,
  updateAdminCategory,
} from '../services/catalogService';
import { extractServiceError } from '../services/sellerService';

const INITIAL_FORM = {
  name: '',
  parent: '',
  description: '',
  commission_rate: '12.00',
  is_active: true,
};

export default function AdminCategoriesTab({
  categories,
  loading,
  onRefresh,
  onFeedback,
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [coverFile, setCoverFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const openCreateForm = () => {
    setEditingCategory(null);
    setForm(INITIAL_FORM);
    setCoverFile(null);
    setShowForm(true);
  };

  const openEditForm = (cat) => {
    setEditingCategory(cat);
    setForm({
      name: cat.name || '',
      parent: cat.parent || '',
      description: cat.description || '',
      commission_rate: String(cat.commission_rate ?? '12.00'),
      is_active: Boolean(cat.is_active),
    });
    setCoverFile(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingCategory(null);
    setForm(INITIAL_FORM);
    setCoverFile(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    onFeedback(null);

    try {
      const formData = new FormData();
      formData.append('name', form.name.trim());
      formData.append('description', form.description.trim());
      formData.append('commission_rate', String(form.commission_rate));
      formData.append('is_active', String(form.is_active));
      if (form.parent) {
        formData.append('parent', form.parent);
      }
      if (coverFile) {
        formData.append('cover_image', coverFile);
      }

      const res = editingCategory
        ? await updateAdminCategory(editingCategory.id, formData)
        : await createAdminCategory(formData);

      onFeedback({ type: 'success', text: res.detail });
      closeForm();
      await onRefresh();
    } catch (err) {
      onFeedback({
        type: 'error',
        text: extractServiceError(err, 'Could not save category.'),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (cat) => {
    setBusyId(cat.id);
    onFeedback(null);
    try {
      const formData = new FormData();
      formData.append('is_active', String(!cat.is_active));
      const res = await updateAdminCategory(cat.id, formData);
      onFeedback({ type: 'success', text: res.detail });
      await onRefresh();
    } catch (err) {
      onFeedback({
        type: 'error',
        text: extractServiceError(err, 'Could not update category status.'),
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (catId) => {
    setBusyId(catId);
    onFeedback(null);
    try {
      const res = await deleteAdminCategory(catId);
      onFeedback({ type: 'success', text: res.detail });
      setConfirmDeleteId(null);
      await onRefresh();
    } catch (err) {
      onFeedback({
        type: 'error',
        text: extractServiceError(err, 'Could not delete category.'),
      });
    } finally {
      setBusyId(null);
    }
  };

  const parentCandidates = categories.filter(
    (c) => !editingCategory || c.id !== editingCategory.id
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Craft Categories &amp; Commission Schedule ({categories.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Each category controls the platform commission % applied to approved artisan sales.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2E9A90] px-4 py-2 text-xs font-semibold text-white hover:bg-[#247D75] transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add Category</span>
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl bg-white border border-slate-200/80 p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              {editingCategory
                ? `Edit Category: ${editingCategory.name}`
                : 'Create Craft Category'}
            </h3>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category Name *
              </label>
              <input
                required
                minLength={2}
                maxLength={120}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Handmade Pottery & Ceramics"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#2E9A90]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Commission Rate (%) *
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                max="50"
                value={form.commission_rate}
                onChange={(e) =>
                  setForm({ ...form, commission_rate: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:border-[#2E9A90]"
              />
              <p className="mt-1 text-[11px] text-slate-400">Range: 0.00% – 50.00%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Parent Category (Optional)
              </label>
              <select
                value={form.parent}
                onChange={(e) => setForm({ ...form, parent: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#2E9A90]"
              >
                <option value="">None (Top-Level Category)</option>
                {parentCandidates.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cover Image (Cloudinary — Optional JPG/PNG/WEBP, max 5 MB)
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Short summary displayed to artisans and shoppers..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#2E9A90]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="h-4 w-4 rounded accent-[#2E9A90]"
              />
              <span>Active (visible to Sellers and on the Storefront)</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#2E9A90] px-5 py-2 text-xs font-semibold text-white hover:bg-[#247D75] disabled:opacity-60"
              >
                {saving
                  ? 'Saving...'
                  : editingCategory
                  ? 'Update Category'
                  : 'Create Category'}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="rounded-xl bg-white border border-slate-200/80 overflow-hidden">
        {loading && categories.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading craft categories from PostgreSQL...
          </div>
        ) : categories.length === 0 ? (
          <div className="p-12 text-center">
            <FolderTree className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-900">
              No craft categories created yet
            </p>
            <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
              Start by adding your first Craftify category and setting its platform
              commission percentage. Approved sellers will then be able to list products
              under it.
            </p>
            <button
              type="button"
              onClick={openCreateForm}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#2E9A90] px-4 py-2 text-xs font-semibold text-white hover:bg-[#247D75]"
            >
              <Plus className="h-4 w-4" />
              <span>Create First Category</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Parent</th>
                  <th className="px-4 py-3 font-semibold">Commission</th>
                  <th className="px-4 py-3 font-semibold">Live Products</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((cat) => (
                  <tr key={cat.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                          {cat.cover_image_url ? (
                            <img
                              src={cat.cover_image_url}
                              alt={cat.name}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">{cat.name}</p>
                          <p className="font-mono text-[11px] text-slate-400">
                            /{cat.slug}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {cat.parent_name || '—'}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900 tabular-nums">
                      {Number(cat.commission_rate).toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700 tabular-nums">
                      {cat.approved_product_count ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                          cat.is_active
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {cat.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditForm(cat)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#2E9A90] hover:text-[#2E9A90]"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          disabled={busyId === cat.id}
                          onClick={() => handleToggleActive(cat)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                        >
                          {cat.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        {confirmDeleteId === cat.id ? (
                          <button
                            type="button"
                            disabled={busyId === cat.id}
                            onClick={() => handleDelete(cat.id)}
                            className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                          >
                            Confirm Delete
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(cat.id)}
                            title="Delete category"
                            className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Image as ImageIcon,
  Package,
  Plus,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useState } from 'react';
import {
  createSellerProduct,
  deleteSellerProduct,
  deleteSellerProductImage,
  setPrimarySellerProductImage,
  updateSellerProduct,
  uploadSellerProductImages,
} from '../services/catalogService';
import { extractServiceError } from '../services/sellerService';
import { formatINR } from '../utils/formatters';

const createEmptyVariant = () => ({
  label: 'Standard',
  sku: '',
  size: '',
  color: '',
  material: '',
  dimensions_cm: '',
  price_override: '',
  quantity_available: 10,
});

const INITIAL_PRODUCT_FORM = {
  title: '',
  category: '',
  description: '',
  base_price: '',
  discount_price: '',
  processing_days: 3,
  is_customizable: false,
  is_made_to_order: false,
  is_one_of_a_kind: false,
};

export default function SellerProductsTab({
  products,
  categories,
  statusFilter,
  onStatusFilterChange,
  loading,
  shopSuspended,
  openComposerInitially = false,
  onCloseInitialComposer,
  onRefresh,
}) {
  const [showForm, setShowForm] = useState(openComposerInitially);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(() => ({
    ...INITIAL_PRODUCT_FORM,
    category: categories[0]?.id || '',
  }));
  const [variants, setVariants] = useState([createEmptyVariant()]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const openCreateForm = () => {
    setEditingProduct(null);
    setForm({
      ...INITIAL_PRODUCT_FORM,
      category: categories[0]?.id || '',
    });
    setVariants([createEmptyVariant()]);
    setSelectedFiles([]);
    setFeedback(null);
    setShowForm(true);
  };

  const openEditForm = (product) => {
    setEditingProduct(product);
    setForm({
      title: product.title || '',
      category: product.category_id || categories[0]?.id || '',
      description: product.description || '',
      base_price: String(product.base_price ?? ''),
      discount_price: product.discount_price ? String(product.discount_price) : '',
      processing_days: product.processing_days || 3,
      is_customizable: Boolean(product.is_customizable),
      is_made_to_order: Boolean(product.is_made_to_order),
      is_one_of_a_kind: Boolean(product.is_one_of_a_kind),
    });
    const mappedVariants =
      product.variants?.length > 0
        ? product.variants.map((v) => ({
            id: v.id,
            label: v.label || 'Standard',
            sku: v.sku || '',
            size: v.size || '',
            color: v.color || '',
            material: v.material || '',
            dimensions_cm: v.dimensions_cm || '',
            price_override: v.price_override ? String(v.price_override) : '',
            quantity_available: v.quantity_available ?? 0,
          }))
        : [createEmptyVariant()];
    setVariants(mappedVariants);
    setSelectedFiles([]);
    setFeedback(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingProduct(null);
    setSelectedFiles([]);
    if (onCloseInitialComposer) onCloseInitialComposer();
  };

  const handleVariantChange = (idx, field, value) => {
    setVariants((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    );
  };

  const addVariantRow = () => {
    setVariants((prev) => [
      ...prev,
      { ...createEmptyVariant(), label: `Option ${prev.length + 1}` },
    ]);
  };

  const removeVariantRow = (idx) => {
    setVariants((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  };

  const handleFilePick = (e) => {
    const picked = Array.from(e.target.files || []);
    const existingCount = editingProduct?.images?.length || 0;
    const maxNew = Math.max(0, 6 - existingCount);
    setSelectedFiles(picked.slice(0, maxNew));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category) {
      setFeedback({
        type: 'error',
        text: 'Please select a craft category before submitting your product.',
      });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.append('category', form.category);
      formData.append('title', form.title.trim());
      formData.append('description', form.description.trim());
      formData.append('base_price', String(form.base_price));
      if (form.discount_price !== '' && form.discount_price !== null) {
        formData.append('discount_price', String(form.discount_price));
      }
      formData.append('processing_days', String(form.processing_days || 3));
      formData.append('is_customizable', String(form.is_customizable));
      formData.append('is_made_to_order', String(form.is_made_to_order));
      formData.append('is_one_of_a_kind', String(form.is_one_of_a_kind));

      const normalizedVariants = variants.map((v) => ({
        ...(v.id ? { id: v.id } : {}),
        label: v.label.trim() || 'Standard',
        sku: v.sku.trim(),
        size: v.size.trim(),
        color: v.color.trim(),
        material: v.material.trim(),
        dimensions_cm: v.dimensions_cm.trim(),
        price_override: v.price_override === '' ? null : String(v.price_override),
        quantity_available: Math.max(0, parseInt(v.quantity_available, 10) || 0),
      }));
      formData.append('variants', JSON.stringify(normalizedVariants));

      for (const file of selectedFiles) {
        formData.append('images', file);
      }

      const res = editingProduct
        ? await updateSellerProduct(editingProduct.id, formData)
        : await createSellerProduct(formData);

      setFeedback({ type: 'success', text: res.detail });
      closeForm();
      await onRefresh();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractServiceError(err, 'Could not save product listing.'),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleQuickImageUpload = async (productId, filesList) => {
    const files = Array.from(filesList || []);
    if (!files.length) return;
    setBusyId(productId);
    setFeedback(null);
    try {
      const res = await uploadSellerProductImages(productId, files);
      setFeedback({ type: 'success', text: res.detail });
      const refreshed = await onRefresh();
      if (editingProduct && editingProduct.id === productId && refreshed) {
        const updated = refreshed.find((p) => p.id === productId);
        if (updated) setEditingProduct(updated);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractServiceError(err, 'Could not upload product image to Cloudinary.'),
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleSetPrimaryImage = async (productId, imageId) => {
    setBusyId(imageId);
    setFeedback(null);
    try {
      await setPrimarySellerProductImage(productId, imageId);
      const refreshed = await onRefresh();
      if (editingProduct && editingProduct.id === productId && refreshed) {
        const updated = refreshed.find((p) => p.id === productId);
        if (updated) setEditingProduct(updated);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractServiceError(err, 'Could not set primary image.'),
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteImage = async (productId, imageId) => {
    setBusyId(imageId);
    setFeedback(null);
    try {
      await deleteSellerProductImage(productId, imageId);
      const refreshed = await onRefresh();
      if (editingProduct && editingProduct.id === productId && refreshed) {
        const updated = refreshed.find((p) => p.id === productId);
        if (updated) setEditingProduct(updated);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractServiceError(err, 'Could not delete image.'),
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteProduct = async (productId) => {
    setBusyId(productId);
    setFeedback(null);
    try {
      const res = await deleteSellerProduct(productId);
      setFeedback({ type: 'success', text: res.detail });
      setConfirmDeleteId(null);
      await onRefresh();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: extractServiceError(err, 'Could not delete product.'),
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      {feedback && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs underline opacity-75 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            My Handmade Products ({products.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Upload photos to Cloudinary, manage variants &amp; stock, and track Admin approval.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => onStatusFilterChange(st)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition-colors ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={shopSuspended || categories.length === 0}
            onClick={openCreateForm}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2E9A90] px-4 py-2 text-xs font-semibold text-white hover:bg-[#247D75] disabled:opacity-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {categories.length === 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900">
          <strong>No active craft categories exist yet.</strong> A Craftify Admin needs to
          create at least one category under <strong>Admin Dashboard → Categories</strong>{' '}
          before sellers can publish new products.
        </div>
      )}

      {/* Product Composer / Editor */}
      {showForm && categories.length > 0 && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl bg-white border border-slate-200/80 p-5 sm:p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {editingProduct
                  ? `Edit Product: ${editingProduct.title}`
                  : 'Create New Handmade Product'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {editingProduct?.approval_status === 'REJECTED'
                  ? 'Saving updates will automatically re-submit this product for Admin review.'
                  : 'New listings start in PENDING moderation until approved by Craftify Admin.'}
              </p>
            </div>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Product Title *
              </label>
              <input
                required
                minLength={3}
                maxLength={200}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g., Hand-Painted Jaipur Blue Pottery Vase"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#2E9A90]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Craft Category *
              </label>
              <select
                required
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#2E9A90]"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({Number(cat.commission_rate).toFixed(2)}% commission)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Craft Story &amp; Description * (min 15 chars)
            </label>
            <textarea
              required
              minLength={15}
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the materials, handmade process, finish, and care instructions..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#2E9A90]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Base Price (₹ INR) *
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="1"
                value={form.base_price}
                onChange={(e) => setForm({ ...form, base_price: e.target.value })}
                placeholder="1499.00"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:border-[#2E9A90]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sale / Discount Price (₹ INR — Optional)
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={form.discount_price}
                onChange={(e) => setForm({ ...form, discount_price: e.target.value })}
                placeholder="1249.00"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:border-[#2E9A90]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Processing Time (Days) *
              </label>
              <input
                required
                type="number"
                min="1"
                max="60"
                value={form.processing_days}
                onChange={(e) => setForm({ ...form, processing_days: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:border-[#2E9A90]"
              />
            </div>
          </div>

          {/* Craft Attribute Toggles */}
          <div className="flex flex-wrap gap-5 pt-1 text-xs font-medium text-slate-700">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_customizable}
                onChange={(e) =>
                  setForm({ ...form, is_customizable: e.target.checked })
                }
                className="h-4 w-4 rounded accent-[#2E9A90]"
              />
              <span>Customizable by Buyer</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_made_to_order}
                onChange={(e) =>
                  setForm({ ...form, is_made_to_order: e.target.checked })
                }
                className="h-4 w-4 rounded accent-[#2E9A90]"
              />
              <span>Made to Order</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_one_of_a_kind}
                onChange={(e) =>
                  setForm({ ...form, is_one_of_a_kind: e.target.checked })
                }
                className="h-4 w-4 rounded accent-[#2E9A90]"
              />
              <span>One-of-a-Kind Piece</span>
            </label>
          </div>

          {/* Dynamic Variants & Inventory Section */}
          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  Variants &amp; Stock Inventory
                </h4>
                <p className="text-[11px] text-slate-500">
                  Define at least one variant (e.g., Standard, 8-inch, Terracotta Red) and
                  available stock quantity.
                </p>
              </div>
              <button
                type="button"
                onClick={addVariantRow}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#2E9A90] hover:text-[#2E9A90]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Option</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {variants.map((v, idx) => (
                <div
                  key={v.id || idx}
                  className="grid grid-cols-2 sm:grid-cols-12 gap-2.5 rounded-lg bg-white border border-slate-200 p-3 items-end"
                >
                  <div className="col-span-2 sm:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Option Label *
                    </label>
                    <input
                      required
                      value={v.label}
                      onChange={(e) => handleVariantChange(idx, 'label', e.target.value)}
                      placeholder="e.g., 10-inch Cobalt"
                      className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#2E9A90]"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Stock Qty *
                    </label>
                    <input
                      required
                      type="number"
                      min="0"
                      value={v.quantity_available}
                      onChange={(e) =>
                        handleVariantChange(idx, 'quantity_available', e.target.value)
                      }
                      className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-mono tabular-nums focus:outline-none focus:border-[#2E9A90]"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Price Override ₹
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={v.price_override}
                      onChange={(e) =>
                        handleVariantChange(idx, 'price_override', e.target.value)
                      }
                      placeholder="Base"
                      className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-mono tabular-nums focus:outline-none focus:border-[#2E9A90]"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Dimensions
                    </label>
                    <input
                      value={v.dimensions_cm}
                      onChange={(e) =>
                        handleVariantChange(idx, 'dimensions_cm', e.target.value)
                      }
                      placeholder="20 x 12 cm"
                      className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#2E9A90]"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      SKU (Auto if blank)
                    </label>
                    <input
                      value={v.sku}
                      onChange={(e) => handleVariantChange(idx, 'sku', e.target.value)}
                      placeholder="AUTO"
                      className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-[#2E9A90]"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      disabled={variants.length <= 1}
                      onClick={() => removeVariantRow(idx)}
                      title="Remove variant"
                      className="rounded-md border border-slate-200 p-1.5 text-slate-400 hover:border-red-200 hover:text-red-600 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Existing Cloudinary Images (when editing) */}
          {editingProduct && (
            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900">
                  Uploaded Cloudinary Photos ({editingProduct.images?.length || 0}/6)
                </h4>
              </div>
              {editingProduct.images?.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {editingProduct.images.map((img) => (
                    <div
                      key={img.id}
                      className="rounded-lg bg-white border border-slate-200 p-1.5 w-32 space-y-1.5"
                    >
                      <img
                        src={img.image_url}
                        alt={img.alt_text || editingProduct.title}
                        referrerPolicy="no-referrer"
                        className="h-20 w-full rounded object-cover"
                      />
                      <div className="flex items-center justify-between gap-1">
                        {img.is_primary ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#2E9A90]">
                            <Star className="h-3 w-3 fill-[#2E9A90]" />
                            Primary
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === img.id}
                            onClick={() =>
                              handleSetPrimaryImage(editingProduct.id, img.id)
                            }
                            className="text-[10px] font-semibold text-slate-600 hover:text-[#2E9A90]"
                          >
                            Set Primary
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busyId === img.id}
                          onClick={() => handleDeleteImage(editingProduct.id, img.id)}
                          className="text-[10px] font-semibold text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  No photos uploaded yet for this listing.
                </p>
              )}
            </div>
          )}

          {/* Cloudinary Multi-Photo Picker */}
          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <Upload className="h-4 w-4 text-[#2E9A90]" />
              <span>
                Upload Product Photos to Cloudinary (JPG, PNG, WEBP · max 5 MB each · up
                to 6 total)
              </span>
            </div>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFilePick}
              className="w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#2E9A90] file:px-3.5 py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-[#247D75]"
            />
            {selectedFiles.length > 0 && (
              <p className="text-[11px] text-slate-600">
                Selected for upload:{' '}
                <strong>{selectedFiles.map((f) => f.name).join(', ')}</strong>
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
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
                ? 'Uploading & Saving...'
                : editingProduct
                ? 'Save Changes'
                : 'Submit for Admin Approval'}
            </button>
          </div>
        </form>
      )}

      {/* Seller Listings Table */}
      <div className="rounded-xl bg-white border border-slate-200/80 overflow-hidden">
        {loading && products.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading your studio products...
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-900">
              No products in your catalog yet
            </p>
            <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
              Add your first handmade creation with Cloudinary photos and variant stock.
              Once approved by Craftify Admin, it publishes live to the Storefront.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {products.map((product) => (
              <div
                key={product.id}
                className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4 min-w-0">
                  <div className="h-16 w-20 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                    {product.primary_image_url ? (
                      <img
                        src={product.primary_image_url}
                        alt={product.title}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-slate-400" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {product.title}
                      </h3>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                          product.approval_status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-700'
                            : product.approval_status === 'PENDING'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {product.approval_status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {product.category_name} ·{' '}
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {formatINR(Number(product.effective_price))}
                      </span>{' '}
                      ·{' '}
                      <span className="font-mono tabular-nums">
                        {product.total_stock} in stock
                      </span>{' '}
                      · {product.images?.length || 0} photo
                      {(product.images?.length || 0) === 1 ? '' : 's'}
                    </p>
                    {product.approval_status === 'REJECTED' && product.review_notes && (
                      <p className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-2.5 py-1 text-[11px] text-red-800">
                        <strong>Admin Review Note:</strong> {product.review_notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {(product.images?.length || 0) < 6 && !shopSuspended && (
                    <label className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#2E9A90] hover:text-[#2E9A90]">
                      <Upload className="h-3.5 w-3.5" />
                      <span>{busyId === product.id ? 'Uploading...' : '+ Photo'}</span>
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={busyId === product.id}
                        onChange={(e) => {
                          handleQuickImageUpload(product.id, e.target.files);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}

                  <button
                    type="button"
                    disabled={shopSuspended}
                    onClick={() => openEditForm(product)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-[#2E9A90] hover:text-[#2E9A90] disabled:opacity-50"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </button>

                  {confirmDeleteId === product.id ? (
                    <button
                      type="button"
                      disabled={busyId === product.id}
                      onClick={() => handleDeleteProduct(product.id)}
                      className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      Confirm Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(product.id)}
                      className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                      title="Delete product"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

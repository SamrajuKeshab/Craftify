import {
  CheckCircle2,
  Image as ImageIcon,
  Package,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { moderateAdminProduct } from '../services/catalogService';
import { extractServiceError } from '../services/sellerService';
import { formatINR } from '../utils/formatters';

export default function AdminProductsTab({
  products,
  statusFilter,
  onStatusFilterChange,
  loading,
  onRefresh,
  onFeedback,
}) {
  const [notesMap, setNotesMap] = useState({});
  const [busyId, setBusyId] = useState(null);

  const handleModerate = async (productId, action) => {
    const notes = (notesMap[productId] || '').trim();
    if (action === 'REJECT' && !notes) {
      onFeedback({
        type: 'error',
        text: 'Please provide short review notes explaining why this product listing is rejected.',
      });
      return;
    }

    setBusyId(productId);
    onFeedback(null);
    try {
      const res = await moderateAdminProduct(productId, {
        action,
        reviewNotes: notes,
      });
      onFeedback({ type: 'success', text: res.detail });
      await onRefresh();
    } catch (err) {
      onFeedback({
        type: 'error',
        text: extractServiceError(err, 'Could not moderate product listing.'),
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Product Moderation Queue ({products.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Every seller listing stays hidden from buyers until explicitly approved here.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => onStatusFilterChange(st)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                statusFilter === st
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {loading && products.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-200/80 p-10 text-center text-sm text-slate-500">
          Loading seller products from PostgreSQL...
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl bg-white border border-slate-200/80 p-12 text-center">
          <Package className="mx-auto h-9 w-9 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-900">
            No {statusFilter === 'ALL' ? '' : statusFilter.toLowerCase()} products found
          </p>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
            Products submitted by approved Sellers appear here immediately for craft
            authenticity checks before going live on the Storefront.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((product) => {
            const images = product.images || [];
            const variants = product.variants || [];
            return (
              <div
                key={product.id}
                className="rounded-xl bg-white border border-slate-200/80 p-5 sm:p-6 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">
                        {product.title}
                      </h3>
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                          product.approval_status === 'PENDING'
                            ? 'bg-amber-100 text-amber-800'
                            : product.approval_status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {product.approval_status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Studio: <strong>{product.seller_shop_name}</strong> (
                      {product.seller_city}, {product.seller_state}) · Category:{' '}
                      <strong>{product.category_name}</strong> (
                      <span className="font-mono">
                        {Number(product.category_commission_rate).toFixed(2)}%
                      </span>{' '}
                      commission)
                    </p>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {new Date(product.created_at).toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Cloudinary Photo Gallery Preview */}
                {images.length > 0 ? (
                  <div className="flex flex-wrap gap-2.5">
                    {images.map((img) => (
                      <div
                        key={img.id}
                        className={`relative h-20 w-24 rounded-lg overflow-hidden border ${
                          img.is_primary ? 'border-[#2E9A90] ring-1 ring-[#2E9A90]' : 'border-slate-200'
                        } bg-slate-100`}
                      >
                        <img
                          src={img.image_url}
                          alt={img.alt_text || product.title}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                        {img.is_primary && (
                          <span className="absolute bottom-1 left-1 rounded bg-slate-900/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            Primary
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-500">
                    <ImageIcon className="h-4 w-4 text-slate-400" />
                    <span>No product photos uploaded yet</span>
                  </div>
                )}

                {/* Key Pricing & Inventory Metadata */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg bg-slate-50 border border-slate-100 p-3.5 text-xs">
                  <div>
                    <span className="text-slate-400 block">Price (INR)</span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {formatINR(Number(product.effective_price))}
                    </span>
                    {product.discount_price && (
                      <span className="ml-1.5 font-mono text-[11px] text-slate-400 line-through">
                        {formatINR(Number(product.base_price))}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400 block">Total Stock</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {product.total_stock} units ({variants.length} variant
                      {variants.length === 1 ? '' : 's'})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Processing Time</span>
                    <span className="font-semibold text-slate-800">
                      {product.processing_days} day
                      {product.processing_days === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Craft Flags</span>
                    <span className="font-medium text-slate-700">
                      {[
                        product.is_customizable && 'Customizable',
                        product.is_made_to_order && 'Made-to-Order',
                        product.is_one_of_a_kind && 'One-of-a-Kind',
                      ]
                        .filter(Boolean)
                        .join(', ') || 'Standard Handmade'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">
                  {product.description}
                </p>

                {variants.length > 0 && (
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
                    {variants.map((v) => (
                      <div
                        key={v.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono"
                      >
                        <span className="font-sans font-semibold text-slate-800">
                          {v.label}
                        </span>{' '}
                        · SKU {v.sku} · {formatINR(Number(v.effective_price))} ·{' '}
                        {v.quantity_available} in stock
                      </div>
                    ))}
                  </div>
                )}

                {/* Moderation Controls */}
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={notesMap[product.id] ?? ''}
                    onChange={(e) =>
                      setNotesMap((prev) => ({
                        ...prev,
                        [product.id]: e.target.value,
                      }))
                    }
                    placeholder="Moderation notes (required for rejection, optional for approval)..."
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:border-[#2E9A90]"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    {product.approval_status !== 'APPROVED' && (
                      <button
                        type="button"
                        disabled={busyId === product.id}
                        onClick={() => handleModerate(product.id, 'APPROVE')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#2E9A90] px-4 py-2 text-xs font-semibold text-white hover:bg-[#247D75] disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Approve &amp; Publish</span>
                      </button>
                    )}
                    {product.approval_status !== 'REJECTED' && (
                      <button
                        type="button"
                        disabled={busyId === product.id}
                        onClick={() => handleModerate(product.id, 'REJECT')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Reject</span>
                      </button>
                    )}
                  </div>
                </div>

                {product.review_notes && (
                  <p className="text-xs text-slate-500">
                    Last reviewed by{' '}
                    <strong>@{product.reviewed_by_username || 'admin'}</strong> — &ldquo;
                    {product.review_notes}&rdquo;
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

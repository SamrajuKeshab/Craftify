import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// Public Storefront Catalog Normalization & APIs (/api/v1/categories/, /products/)
// ---------------------------------------------------------------------------

/**
 * Converts a live Django ProductDetailSerializer payload into the unified storefront
 * shape used by StorefrontPage, ProductDetailModal, CartContext, and CartPage.
 */
export function normalizeStorefrontProduct(apiProduct) {
  if (!apiProduct) return null;

  const basePrice = Number(apiProduct.base_price || 0);
  const effectivePrice = Number(
    apiProduct.effective_price ?? apiProduct.discount_price ?? basePrice
  );
  const originalPrice =
    apiProduct.discount_price && basePrice > effectivePrice ? basePrice : 0;

  const rawVariants = Array.isArray(apiProduct.variants) ? apiProduct.variants : [];
  const activeVariants = rawVariants.filter((v) => v.is_active !== false);
  const variantLabels = activeVariants.map(
    (v) =>
      v.label ||
      [v.size, v.color, v.material].filter(Boolean).join(' · ') ||
      v.sku ||
      'Standard'
  );

  const firstVariant = activeVariants[0] || null;
  const images = Array.isArray(apiProduct.images) ? apiProduct.images : [];
  const primaryImage =
    apiProduct.primary_image_url ||
    images.find((img) => img.is_primary)?.image_url ||
    images[0]?.image_url ||
    '';

  const cityState = [apiProduct.seller_city, apiProduct.seller_state]
    .filter(Boolean)
    .join(', ');

  return {
    id: apiProduct.id,
    slug: apiProduct.slug,
    name: apiProduct.title,
    categoryId: apiProduct.category_slug || apiProduct.category_id,
    categoryUuid: apiProduct.category_id,
    categoryName: apiProduct.category_name || 'Handmade Craft',
    categoryCommissionRate: Number(apiProduct.category_commission_rate || 0),
    sellerId: apiProduct.seller_id,
    sellerSlug: apiProduct.seller_slug || '',
    sellerName: apiProduct.seller_shop_name || 'Craftify Studio',
    sellerCity: cityState || 'India',
    price: effectivePrice,
    originalPrice,
    rating: Number(apiProduct.rating || 0),
    reviewCount: Number(apiProduct.review_count || 0),
    stock: Number(apiProduct.total_stock ?? 0),
    image: primaryImage,
    images,
    description: apiProduct.description || '',
    variants: variantLabels.length > 0 ? variantLabels : ['Standard'],
    variantObjects: activeVariants,
    processingDays: `${apiProduct.processing_days || 3} day${
      Number(apiProduct.processing_days || 3) === 1 ? '' : 's'
    }`,
    dimensions: firstVariant?.dimensions_cm || 'Handmade craft dimensions',
    customizable: Boolean(apiProduct.is_customizable),
    isMadeToOrder: Boolean(apiProduct.is_made_to_order),
    isOneOfAKind: Boolean(apiProduct.is_one_of_a_kind),
    approvalStatus: apiProduct.approval_status,
  };
}

export async function fetchPublicCategories() {
  const { data } = await apiClient.get('/categories/');
  return data;
}

export async function fetchPublicProducts({
  category = '',
  seller = '',
  search = '',
  ordering = 'newest',
  minPrice = '',
  maxPrice = '',
  inStock = false,
  customizable = false,
  madeToOrder = false,
  oneOfAKind = false,
  page = 1,
  pageSize = 12,
} = {}) {
  const params = {};
  if (category && category !== 'all') params.category = category;
  if (seller && seller.trim()) params.seller = seller.trim();
  if (search && search.trim()) params.search = search.trim();
  if (ordering) params.ordering = ordering;
  if (minPrice !== '' && minPrice !== null) params.min_price = String(minPrice).trim();
  if (maxPrice !== '' && maxPrice !== null) params.max_price = String(maxPrice).trim();
  if (inStock) params.in_stock = 'true';
  if (customizable) params.customizable = 'true';
  if (madeToOrder) params.made_to_order = 'true';
  if (oneOfAKind) params.one_of_a_kind = 'true';
  if (page && page > 1) params.page = page;
  if (pageSize) params.page_size = pageSize;

  const { data } = await apiClient.get('/products/', { params });
  return data;
}

export async function fetchPublicProductBySlug(slug) {
  const { data } = await apiClient.get(`/products/${encodeURIComponent(slug)}/`);
  return data;
}

export async function fetchPublicShops(search = '') {
  const params = search && search.trim() ? { search: search.trim() } : {};
  const { data } = await apiClient.get('/shops/', { params });
  return data;
}

export async function fetchPublicShopBySlug(
  slug,
  { search = '', ordering = 'newest', inStock = false } = {}
) {
  const params = {};
  if (search && search.trim()) params.search = search.trim();
  if (ordering) params.ordering = ordering;
  if (inStock) params.in_stock = 'true';
  const { data } = await apiClient.get(`/shops/${encodeURIComponent(slug)}/`, {
    params,
  });
  return data;
}

// ---------------------------------------------------------------------------
// Seller Product Management APIs (/api/v1/seller/products/*)
// ---------------------------------------------------------------------------

export async function fetchSellerProducts(statusFilter = '') {
  const params = statusFilter && statusFilter !== 'ALL' ? { status: statusFilter } : {};
  const { data } = await apiClient.get('/seller/products/', { params });
  return data;
}

export async function createSellerProduct(formData) {
  const { data } = await apiClient.post('/seller/products/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 45000,
  });
  return data;
}

export async function updateSellerProduct(productId, formData) {
  const { data } = await apiClient.patch(`/seller/products/${productId}/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 45000,
  });
  return data;
}

export async function deleteSellerProduct(productId) {
  const { data } = await apiClient.delete(`/seller/products/${productId}/`);
  return data;
}

export async function uploadSellerProductImages(productId, files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('images', file);
  }
  const { data } = await apiClient.post(`/seller/products/${productId}/images/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 45000,
  });
  return data;
}

export async function setPrimarySellerProductImage(productId, imageId) {
  const { data } = await apiClient.patch(
    `/seller/products/${productId}/images/${imageId}/`,
    {}
  );
  return data;
}

export async function deleteSellerProductImage(productId, imageId) {
  const { data } = await apiClient.delete(
    `/seller/products/${productId}/images/${imageId}/`
  );
  return data;
}

// ---------------------------------------------------------------------------
// Admin Categories & Product Moderation APIs (/api/v1/admin/*)
// ---------------------------------------------------------------------------

export async function fetchAdminCategories(search = '') {
  const params = search && search.trim() ? { search: search.trim() } : {};
  const { data } = await apiClient.get('/admin/categories/', { params });
  return data;
}

export async function createAdminCategory(formData) {
  const { data } = await apiClient.post('/admin/categories/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });
  return data;
}

export async function updateAdminCategory(categoryId, formData) {
  const { data } = await apiClient.patch(`/admin/categories/${categoryId}/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });
  return data;
}

export async function deleteAdminCategory(categoryId) {
  const { data } = await apiClient.delete(`/admin/categories/${categoryId}/`);
  return data;
}

export async function fetchAdminProducts({ status = '', search = '' } = {}) {
  const params = {};
  if (status && status !== 'ALL') params.status = status;
  if (search && search.trim()) params.search = search.trim();
  const { data } = await apiClient.get('/admin/products/', { params });
  return data;
}

export async function moderateAdminProduct(productId, { action, reviewNotes = '' }) {
  const { data } = await apiClient.post(`/admin/products/${productId}/moderate/`, {
    action,
    review_notes: reviewNotes,
  });
  return data;
}

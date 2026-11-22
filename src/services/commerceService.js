import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// 1. Buyer Indian Delivery Address Book (/api/v1/buyer/addresses/*)
// ---------------------------------------------------------------------------

export async function fetchBuyerAddresses() {
  const { data } = await apiClient.get('/buyer/addresses/');
  return data;
}

export async function createBuyerAddress(payload) {
  const { data } = await apiClient.post('/buyer/addresses/', payload);
  return data;
}

export async function updateBuyerAddress(addressId, payload) {
  const { data } = await apiClient.patch(`/buyer/addresses/${addressId}/`, payload);
  return data;
}

export async function deleteBuyerAddress(addressId) {
  const { data } = await apiClient.delete(`/buyer/addresses/${addressId}/`);
  return data;
}

export async function setDefaultBuyerAddress(addressId) {
  const { data } = await apiClient.post(`/buyer/addresses/${addressId}/set-default/`);
  return data;
}

// ---------------------------------------------------------------------------
// 2. Persistent Shopping Cart & Coupon Application (/api/v1/cart/*)
// ---------------------------------------------------------------------------

export async function fetchCart() {
  const { data } = await apiClient.get('/cart/');
  return data;
}

export async function addCartItem({
  variantId = null,
  productId = null,
  quantity = 1,
  customizationNote = '',
}) {
  const body = { quantity, customization_note: customizationNote };
  if (variantId) body.variant_id = variantId;
  if (productId) body.product_id = productId;
  const { data } = await apiClient.post('/cart/items/', body);
  return data;
}

export async function updateCartItem(itemId, { quantity, customizationNote } = {}) {
  const body = {};
  if (typeof quantity === 'number') body.quantity = quantity;
  if (typeof customizationNote === 'string') body.customization_note = customizationNote;
  const { data } = await apiClient.patch(`/cart/items/${itemId}/`, body);
  return data;
}

export async function removeCartItem(itemId) {
  const { data } = await apiClient.delete(`/cart/items/${itemId}/`);
  return data;
}

export async function clearCart() {
  const { data } = await apiClient.delete('/cart/');
  return data;
}

export async function applyCartCoupon(code) {
  const { data } = await apiClient.post('/cart/apply-coupon/', { code });
  return data;
}

export async function removeCartCoupon() {
  const { data } = await apiClient.delete('/cart/coupon/');
  return data;
}

export async function validateCouponCode(code) {
  const { data } = await apiClient.post('/coupons/validate/', { code });
  return data;
}

// ---------------------------------------------------------------------------
// 3. Persistent Wishlist (/api/v1/wishlist/*)
// ---------------------------------------------------------------------------

export async function fetchWishlist() {
  const { data } = await apiClient.get('/wishlist/');
  return data;
}

export async function toggleWishlistProduct(productId) {
  const { data } = await apiClient.post('/wishlist/toggle/', {
    product_id: productId,
  });
  return data;
}

export async function removeWishlistProduct(productId) {
  const { data } = await apiClient.delete(`/wishlist/${productId}/`);
  return data;
}

export async function moveWishlistProductToCart(
  productId,
  { variantId = null, quantity = 1, customizationNote = '' } = {}
) {
  const body = { quantity, customization_note: customizationNote };
  if (variantId) body.variant_id = variantId;
  const { data } = await apiClient.post(`/wishlist/${productId}/move-to-cart/`, body);
  return data;
}

// ---------------------------------------------------------------------------
// 4. Admin Platform Coupons CRUD (/api/v1/admin/coupons/*)
// ---------------------------------------------------------------------------

export async function fetchAdminCoupons({ status = '', search = '' } = {}) {
  const params = {};
  if (status && status !== 'ALL') params.status = status;
  if (search && search.trim()) params.search = search.trim();
  const { data } = await apiClient.get('/admin/coupons/', { params });
  return data;
}

export async function createAdminCoupon(payload) {
  const { data } = await apiClient.post('/admin/coupons/', payload);
  return data;
}

export async function updateAdminCoupon(couponId, payload) {
  const { data } = await apiClient.patch(`/admin/coupons/${couponId}/`, payload);
  return data;
}

export async function deleteAdminCoupon(couponId) {
  const { data } = await apiClient.delete(`/admin/coupons/${couponId}/`);
  return data;
}

export const INDIAN_STATES_AND_UTS = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

import api from './apiClient';

let razorpayScriptPromise = null;

/**
 * Dynamically load Razorpay's official Checkout.js only when a buyer initiates
 * prepaid Razorpay checkout (keeps initial storefront bundle fast and clean).
 */
export function loadRazorpayCheckoutScript() {
  if (typeof window === 'undefined') {
    return Promise.resolve(false);
  }
  if (window.Razorpay) {
    return Promise.resolve(true);
  }
  if (razorpayScriptPromise) {
    return razorpayScriptPromise;
  }

  razorpayScriptPromise = new Promise((resolve) => {
    const existing = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(Boolean(window.Razorpay)));
      existing.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => {
      razorpayScriptPromise = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return razorpayScriptPromise;
}

export async function fetchCheckoutConfig() {
  const { data } = await api.get('/checkout/config/');
  return data;
}

export async function placeCheckoutOrder({
  addressId,
  paymentMethod,
  idempotencyKey = '',
}) {
  const { data } = await api.post('/checkout/', {
    address_id: addressId,
    payment_method: paymentMethod,
    idempotency_key: idempotencyKey,
  });
  return data;
}

export async function verifyRazorpayPayment({
  orderId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) {
  const { data } = await api.post('/payments/razorpay/verify/', {
    order_id: orderId,
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: razorpaySignature,
  });
  return data;
}

export async function reportRazorpayFailure({ orderId, reason }) {
  const { data } = await api.post('/payments/razorpay/fail/', {
    order_id: orderId,
    reason: reason || 'Payment cancelled by buyer',
  });
  return data;
}

// Buyer Orders
export async function fetchBuyerOrders() {
  const { data } = await api.get('/buyer/orders/');
  return data;
}

export async function cancelBuyerOrder(orderId) {
  const { data } = await api.post(`/buyer/orders/${orderId}/cancel/`);
  return data;
}

// Seller Studio Suborders
export async function fetchSellerSuborders(statusFilter = 'ALL') {
  const params = {};
  if (statusFilter && statusFilter !== 'ALL') {
    params.status = statusFilter;
  }
  const { data } = await api.get('/seller/suborders/', { params });
  return data;
}

export async function updateSellerSuborderStatus(
  suborderId,
  { status, sellerNotes = '' }
) {
  const { data } = await api.patch(`/seller/suborders/${suborderId}/status/`, {
    status,
    seller_notes: sellerNotes,
  });
  return data;
}

// Admin Orders & Payments Oversight
export async function fetchAdminOrders({ status = '', search = '' } = {}) {
  const params = {};
  if (status && status !== 'ALL') params.status = status;
  if (search) params.search = search;
  const { data } = await api.get('/admin/orders/', { params });
  return data;
}

export async function fetchAdminPayments({ provider = '', search = '' } = {}) {
  const params = {};
  if (provider && provider !== 'ALL') params.provider = provider;
  if (search) params.search = search;
  const { data } = await api.get('/admin/payments/', { params });
  return data;
}

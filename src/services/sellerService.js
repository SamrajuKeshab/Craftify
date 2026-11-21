import apiClient from './apiClient';

const BACKEND_OFFLINE_MSG =
  'Cannot reach the Craftify Django server. Make sure Django is running (`python manage.py runserver`) and try again.';

export function extractServiceError(err, fallback = 'Request failed. Please try again.') {
  if (!err?.response || err.response.status === 502 || err.response.status === 504) {
    return BACKEND_OFFLINE_MSG;
  }
  const data = err.response.data;
  if (!data || typeof data === 'string') return fallback;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.non_field_errors) && data.non_field_errors[0]) {
    return data.non_field_errors[0];
  }
  const firstEntry = Object.entries(data)[0];
  if (firstEntry) {
    const [field, val] = firstEntry;
    const msg = Array.isArray(val) ? val[0] : val;
    if (typeof msg === 'string') {
      return field === 'detail' ? msg : `${field.replace(/_/g, ' ')}: ${msg}`;
    }
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Buyer / Seller Onboarding & Shop Profile APIs
// ---------------------------------------------------------------------------

export async function fetchMySellerApplicationStatus() {
  const { data } = await apiClient.get('/sellers/application-status/');
  return data;
}

export async function submitSellerApplication(formData) {
  const { data } = await apiClient.post('/sellers/apply/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 15000,
  });
  return data;
}

export async function fetchMySellerShop() {
  const { data } = await apiClient.get('/sellers/shop/');
  return data;
}

export async function updateMySellerShop(payload) {
  const { data } = await apiClient.patch('/sellers/shop/', payload);
  return data;
}

/**
 * Download a protected verification document using the in-memory Bearer token
 * without placing credentials in the URL.
 */
export async function downloadVerificationDocument(docId, fallbackFilename = 'document') {
  const response = await apiClient.get(`/sellers/documents/${docId}/`, {
    responseType: 'blob',
    timeout: 15000,
  });
  const blobUrl = window.URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fallbackFilename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

// ---------------------------------------------------------------------------
// Admin Panel Governance APIs (/api/v1/admin/*)
// ---------------------------------------------------------------------------

export async function fetchAdminDashboard() {
  const { data } = await apiClient.get('/admin/dashboard/');
  return data;
}

export async function fetchAdminSellerApplications({ status = '', search = '' } = {}) {
  const params = {};
  if (status) params.status = status;
  if (search) params.search = search;
  const { data } = await apiClient.get('/admin/seller-applications/', { params });
  return data;
}

export async function reviewSellerApplication(applicationId, { action, reviewNotes = '' }) {
  const { data } = await apiClient.post(
    `/admin/seller-applications/${applicationId}/review/`,
    { action, review_notes: reviewNotes }
  );
  return data;
}

export async function fetchAdminSellers(search = '') {
  const params = search ? { search } : {};
  const { data } = await apiClient.get('/admin/sellers/', { params });
  return data;
}

export async function toggleSellerSuspend(sellerProfileId, reason = '') {
  const { data } = await apiClient.post(
    `/admin/sellers/${sellerProfileId}/toggle-suspend/`,
    { reason }
  );
  return data;
}

export async function fetchAdminBuyers(search = '') {
  const params = search ? { search } : {};
  const { data } = await apiClient.get('/admin/buyers/', { params });
  return data;
}

export async function toggleUserActive(userId, reason = '') {
  const { data } = await apiClient.post(`/admin/users/${userId}/toggle-active/`, {
    reason,
  });
  return data;
}

export async function fetchAdminAuditLogs() {
  const { data } = await apiClient.get('/admin/audit-logs/');
  return data;
}

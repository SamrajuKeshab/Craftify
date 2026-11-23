import api from './apiClient';

export async function fetchSellerFinance(entryType = 'ALL') {
  const params = {};
  if (entryType && entryType !== 'ALL') {
    params.entry_type = entryType;
  }
  const { data } = await api.get('/seller/finance/', { params });
  return data;
}

export async function requestSellerPayout({ amount, sellerNotes = '' }) {
  const { data } = await api.post('/seller/finance/payouts/', {
    amount: String(amount),
    seller_notes: sellerNotes,
  });
  return data;
}

export async function fetchBuyerRefunds() {
  const { data } = await api.get('/buyer/refunds/');
  return data;
}

export async function fetchAdminFinance({
  payoutStatus = 'ALL',
  refundStatus = 'ALL',
  entryType = 'ALL',
  search = '',
} = {}) {
  const params = {};
  if (payoutStatus && payoutStatus !== 'ALL') params.payout_status = payoutStatus;
  if (refundStatus && refundStatus !== 'ALL') params.refund_status = refundStatus;
  if (entryType && entryType !== 'ALL') params.entry_type = entryType;
  if (search.trim()) params.search = search.trim();
  const { data } = await api.get('/admin/finance/', { params });
  return data;
}

export async function actOnAdminPayout(
  payoutId,
  { status, utrReference = '', adminNotes = '' }
) {
  const { data } = await api.post(`/admin/finance/payouts/${payoutId}/action/`, {
    status,
    utr_reference: utrReference,
    admin_notes: adminNotes,
  });
  return data;
}

export async function actOnAdminRefund(
  refundId,
  { status, gatewayRefundId = '', adminNotes = '' }
) {
  const { data } = await api.post(`/admin/finance/refunds/${refundId}/action/`, {
    status,
    gateway_refund_id: gatewayRefundId,
    admin_notes: adminNotes,
  });
  return data;
}

export async function releaseLedgerHold(entryId, reason = '') {
  const { data } = await api.post(
    `/admin/finance/ledger/${entryId}/release-hold/`,
    { reason }
  );
  return data;
}

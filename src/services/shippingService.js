import api from './apiClient';

export const INDIAN_COURIERS = [
  'Delhivery',
  'India Post',
  'Blue Dart',
  'DTDC',
  'Xpressbees',
  'Shadowfax',
  'Ecom Express',
  'Ekart Logistics',
];

export async function dispatchSellerSuborder(
  suborderId,
  {
    courierName,
    trackingNumber,
    trackingUrl = '',
    estimatedDeliveryDate = null,
    dispatchNotes = '',
  }
) {
  const payload = {
    courier_name: courierName,
    tracking_number: trackingNumber,
    tracking_url: trackingUrl,
    dispatch_notes: dispatchNotes,
  };
  if (estimatedDeliveryDate) {
    payload.estimated_delivery_date = estimatedDeliveryDate;
  }
  const { data } = await api.post(`/seller/suborders/${suborderId}/ship/`, payload);
  return data;
}

export async function addShipmentEvent(
  suborderId,
  { status, location = '', notes = '' }
) {
  const { data } = await api.post(`/seller/suborders/${suborderId}/events/`, {
    status,
    location,
    notes,
  });
  return data;
}

export async function markSuborderDelivered(suborderId, { deliveryNotes = '' } = {}) {
  const { data } = await api.post(`/seller/suborders/${suborderId}/deliver/`, {
    delivery_notes: deliveryNotes,
  });
  return data;
}

export async function fetchBuyerReturns() {
  const { data } = await api.get('/buyer/returns/');
  return data;
}

export async function createBuyerReturnRequest({
  orderItemId,
  reason,
  description,
  quantity = 1,
  files = [],
}) {
  const formData = new FormData();
  formData.append('order_item_id', orderItemId);
  formData.append('reason', reason);
  formData.append('description', description);
  formData.append('quantity', String(quantity));
  (files || []).forEach((file) => {
    formData.append('evidence_images', file);
  });

  const { data } = await api.post('/buyer/returns/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function fetchSellerReturns(statusFilter = 'ALL') {
  const params = {};
  if (statusFilter && statusFilter !== 'ALL') {
    params.status = statusFilter;
  }
  const { data } = await api.get('/seller/returns/', { params });
  return data;
}

export async function resolveSellerReturn(
  returnId,
  { status, sellerResponseNote = '', restockInventory = false }
) {
  const { data } = await api.patch(`/seller/returns/${returnId}/resolve/`, {
    status,
    seller_response_note: sellerResponseNote,
    restock_inventory: restockInventory,
  });
  return data;
}

export async function fetchAdminReturns({ status = '', search = '' } = {}) {
  const params = {};
  if (status && status !== 'ALL') params.status = status;
  if (search) params.search = search;
  const { data } = await api.get('/admin/returns/', { params });
  return data;
}

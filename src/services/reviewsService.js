import api from './apiClient';

export async function fetchPublicProductReviews(slug) {
  const { data } = await api.get(`/products/${slug}/reviews/`);
  return data;
}

export async function fetchBuyerReviews() {
  const { data } = await api.get('/buyer/reviews/');
  return data;
}

export async function submitBuyerReview({
  orderItemId,
  rating,
  title = '',
  comment,
}) {
  const { data } = await api.post('/buyer/reviews/', {
    order_item_id: orderItemId,
    rating,
    title,
    comment,
  });
  return data;
}

export async function fetchSellerReviews(ratingFilter = 'ALL') {
  const params = {};
  if (ratingFilter && ratingFilter !== 'ALL') {
    params.rating = ratingFilter;
  }
  const { data } = await api.get('/seller/reviews/', { params });
  return data;
}

export async function replyToSellerReview(reviewId, sellerReply) {
  const { data } = await api.post(`/seller/reviews/${reviewId}/reply/`, {
    seller_reply: sellerReply,
  });
  return data;
}

export async function fetchAdminReviews({ status = 'ALL', search = '' } = {}) {
  const params = {};
  if (status && status !== 'ALL') params.status = status;
  if (search.trim()) params.search = search.trim();
  const { data } = await api.get('/admin/reviews/', { params });
  return data;
}

export async function moderateAdminReview(
  reviewId,
  { status, moderationNotes = '' }
) {
  const { data } = await api.post(`/admin/reviews/${reviewId}/moderate/`, {
    status,
    moderation_notes: moderationNotes,
  });
  return data;
}

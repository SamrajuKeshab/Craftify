import api from './apiClient';

export async function fetchNotifications(unreadOnly = false) {
  const params = unreadOnly ? { unread: 'true' } : {};
  const { data } = await api.get('/notifications/', { params });
  return data;
}

export async function markNotificationRead(notificationId) {
  const { data } = await api.post(`/notifications/${notificationId}/read/`);
  return data;
}

export async function markAllNotificationsRead() {
  const { data } = await api.post('/notifications/read-all/');
  return data;
}

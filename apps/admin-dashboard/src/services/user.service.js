import { apiRequest, isMock } from './api.service.js';
import { mockUsers } from './mock.data.js';

export const userService = {
  async list(params = {}) {
    if (isMock) {
      const items = mockUsers.filter((user) => {
        if (params.status && user.status !== params.status) return false;
        if (params.role && user.role !== params.role) return false;
        if (params.search && !user.email.includes(params.search)) return false;
        return true;
      });
      return { items, total: items.length };
    }

    const queryParams = {};
    if (params.status) {
      queryParams.status = String(params.status).toUpperCase();
    }
    if (params.role) {
      queryParams.role = String(params.role).toLowerCase();
    }
    if (params.search) {
      queryParams.email = String(params.search).trim();
    }
    const query = new URLSearchParams(queryParams).toString();
    const payload = await apiRequest(`/v1/users${query ? `?${query}` : ''}`);
    return { items: payload?.data || [], total: payload?.data?.length || 0 };
  },

  async updateStatus(id, status) {
    if (isMock) {
      return { id, status };
    }

    return apiRequest(`/v1/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  }
};

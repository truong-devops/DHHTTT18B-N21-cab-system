import { apiRequest, isMock } from './api.service.js';
import { mockDrivers } from './mock.data.js';

export const driverService = {
  async list(params = {}) {
    if (isMock) {
      const items = mockDrivers.filter((driver) => {
        if (params.status && driver.status !== params.status) return false;
        if (params.onlineStatus && driver.onlineStatus !== params.onlineStatus) return false;
        if (params.vehicleType && driver.vehicleType !== params.vehicleType) return false;
        return true;
      });
      return { items, total: items.length };
    }

    const queryParams = {};
    if (params.status) {
      queryParams.status = String(params.status).toUpperCase();
    }
    if (params.onlineStatus) {
      queryParams.online = String(params.onlineStatus).toUpperCase();
    }
    const query = new URLSearchParams(queryParams).toString();
    const payload = await apiRequest(`/v1/admin/drivers${query ? `?${query}` : ''}`);
    const items = payload?.data?.items || payload?.data || [];
    const filtered = params.vehicleType && items.length ? items.filter((driver) => driver.vehicleType === params.vehicleType) : items;
    return {
      items: filtered,
      total: filtered.length
    };
  },

  async approve(id) {
    if (isMock) {
      return { id, status: 'APPROVED' };
    }

    return apiRequest(`/v1/admin/drivers/${id}/approve`, { method: 'PATCH' });
  },

  async suspend(id) {
    if (isMock) {
      return { id, status: 'SUSPENDED' };
    }

    return apiRequest(`/v1/admin/drivers/${id}/suspend`, { method: 'PATCH' });
  },

  async create(payload) {
    if (isMock) {
      const now = Date.now();
      return {
        driver: {
          id: `d-${now}`,
          userId: payload?.userId || `u-${now}`,
          fullName: payload?.fullName || 'Tai xe moi',
          phone: payload?.phone || null,
          status: 'PENDING',
          onlineStatus: 'OFFLINE',
          vehicleType: null,
          plateNumber: null
        },
        created: true
      };
    }

    const response = await apiRequest('/v1/admin/drivers', {
      method: 'POST',
      body: JSON.stringify(payload || {})
    });
    return response?.data || response;
  }
};

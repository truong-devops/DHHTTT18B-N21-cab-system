import { apiRequest, isMock } from './api.service.js';
import { mockRides } from './mock.data.js';

export const rideService = {
  async list(params = {}) {
    if (isMock) {
      const items = mockRides.filter((ride) => {
        if (params.status && ride.status !== params.status) return false;
        return true;
      });
      return { items, total: items.length };
    }

    const query = new URLSearchParams(params).toString();
    const payload = await apiRequest(`/v1/rides${query ? `?${query}` : ''}`);
    const items = (payload?.data || []).map((ride) => {
      const createdAt = ride.createdAt || ride.created_at || ride.requestedAt || ride.requested_at || ride.created || null;
      const statusUpdatedAt = ride.statusUpdatedAt || ride.status_updated_at || ride.updatedAt || ride.updated_at || null;
      return {
        ...ride,
        rider: ride.rider || ride.riderId || ride.rider_id || ride.riderId,
        driver: ride.driver || ride.driverId || ride.driver_id || ride.driverId,
        fare: ride.fare ?? ride.estimatedFare ?? null,
        paymentStatus: ride.paymentStatus || null,
        createdAt,
        statusUpdatedAt
      };
    });
    return { items, total: items.length };
  }
};

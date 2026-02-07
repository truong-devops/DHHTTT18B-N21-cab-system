import type { ApiError } from '@/lib/api';
import * as rideService from '@/lib/services/ride';

function isNetworkError(err: any) {
  if (!err) return false;
  if (typeof err.status !== 'number') return true;
  return err.status === 0;
}

async function retryOnce<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    return fn();
  }
}

export type Ride = rideService.Ride;

export async function acceptRide(rideId: string, driverId?: string) {
  if (!driverId) {
    const error: ApiError = {
      status: 400,
      message: 'Thiếu driverId để nhận chuyến.',
    };
    throw error;
  }
  return retryOnce(() => rideService.assignRide(rideId, driverId));
}

export async function rejectRide(rideId: string, reason = 'DRIVER_REJECTED') {
  return retryOnce(() => rideService.rejectRide(rideId, reason));
}

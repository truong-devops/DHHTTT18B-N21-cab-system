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
      message: 'Thiếu driverId để nhận chuyến.'
    };
    throw error;
  }
  try {
    return await retryOnce(() => rideService.assignRide(rideId, driverId));
  } catch (err: any) {
    if (err?.status === 409) {
      try {
        const detail = await rideService.getRide(rideId);
        const assignedDriver = detail.data?.driverId ?? null;
        if (assignedDriver && assignedDriver === driverId) {
          return detail;
        }
        const conflict: ApiError = {
          status: 409,
          message: 'Chuyến đã được tài xế khác nhận.',
          code: err?.code,
          details: err?.details
        };
        throw conflict;
      } catch (fetchErr) {
        throw err;
      }
    }
    throw err;
  }
}

export async function rejectRide(rideId: string, reason = 'DRIVER_REJECTED') {
  return retryOnce(() => rideService.rejectRide(rideId, reason));
}

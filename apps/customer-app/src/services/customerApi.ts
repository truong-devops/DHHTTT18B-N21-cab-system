import type { ApiError } from '../lib/api'
import type { DriverInfo, LocationPoint, RideHistoryItem, RideOption } from '../mock/data'
import { destinationPoints, mockDriver, pickupPoint, rideOptions as fallbackRideOptions } from '../mock/data'
import * as authApi from './authApi'
import * as paymentApi from './paymentApi'
import * as pricingApi from './pricingApi'
import * as reviewApi from './reviewApi'
import * as rideApi from './rideApi'

type StartRidePayload = {
  pickupLabel: string
  destinationLabel: string
  option: RideOption
}

type LivePickup = {
  latitude: number
  longitude: number
}

let livePickupCoordinate: LivePickup | null = null

function isApiError(error: unknown): error is ApiError {
  return Boolean(error && typeof error === 'object' && 'status' in error)
}

function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase()
}

function resolveLocation(label: string, fallback: LocationPoint): LocationPoint {
  if (label === pickupPoint.label) {
    if (livePickupCoordinate) {
      return {
        label: pickupPoint.label,
        lat: livePickupCoordinate.latitude,
        lng: livePickupCoordinate.longitude
      }
    }
    return pickupPoint
  }
  return destinationPoints.find((item) => item.label === label) || fallback
}

function normalizePrice(value: number) {
  return Math.max(Math.round(value), 12000)
}

function formatLocation(lat?: number | null, lng?: number | null) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return '-'
  }

  const known = [pickupPoint, ...destinationPoints].find(
    (point) => Math.abs(point.lat - Number(lat)) < 0.0006 && Math.abs(point.lng - Number(lng)) < 0.0006
  )
  if (known) return known.label

  return `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`
}

function toMethodCode(method: string): 'CASH' | 'WALLET' | 'VIETQR' {
  const normalized = method.trim().toLowerCase()
  if (normalized === 'wallet' || normalized === 'ví') return 'WALLET'
  if (normalized === 'vietqr') return 'VIETQR'
  return 'CASH'
}

function isUuid(value: string | undefined) {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function moveRideToStatus(rideId: string, status: string) {
  try {
    return await rideApi.updateRideStatus(rideId, status)
  } catch (error) {
    if (isApiError(error) && error.status === 409) {
      return null
    }
    throw error
  }
}

function buildUserName(identifier: string, user: authApi.AuthUser) {
  if (user.username && user.username.trim()) return user.username.trim()
  if (user.email && user.email.trim()) return user.email.trim()
  return identifier
}

function buildPhone(identifier: string) {
  const normalized = identifier.trim()
  return normalized.includes('@') ? 'Không có' : normalized
}

export const customerApi = {
  setLivePickupLocation(latitude: number, longitude: number) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return
    livePickupCoordinate = { latitude, longitude }
  },

  async requestOtp(identifier: string) {
    await authApi.healthCheck()
    return { ok: Boolean(identifier.trim()) }
  },

  async verifyOtp(identifier: string, otp: string) {
    const normalizedIdentifier = normalizeIdentifier(identifier)
    const password = otp.trim()
    if (!normalizedIdentifier) {
      throw new Error('Thiếu số điện thoại/email')
    }
    if (!password) {
      throw new Error('Thiếu OTP/mật khẩu')
    }

    let authResult: authApi.AuthResponse
    try {
      authResult = await authApi.login(normalizedIdentifier, password)
    } catch (error) {
      if (isApiError(error) && error.status === 401) {
        authResult = await authApi.register(normalizedIdentifier, password)
      } else {
        throw error
      }
    }

    return {
      accessToken: authResult.tokens.accessToken,
      refreshToken: authResult.tokens.refreshToken,
      user: {
        id: authResult.data.id,
        name: buildUserName(normalizedIdentifier, authResult.data),
        phone: buildPhone(normalizedIdentifier)
      }
    }
  },

  async getRideOptions(pickupLabel: string, destinationLabel: string): Promise<RideOption[]> {
    const pickup = resolveLocation(pickupLabel, pickupPoint)
    const destination = resolveLocation(destinationLabel, destinationPoints[0] || pickupPoint)

    try {
      const [standardQuote, premiumQuote] = await Promise.all([
        pricingApi.createQuote(pickup, destination, 'STANDARD'),
        pricingApi.createQuote(pickup, destination, 'PREMIUM')
      ])

      const standardFare = Number(standardQuote.data.estimatedFare || 0)
      const premiumFare = Number(premiumQuote.data.estimatedFare || 0)
      const standardEta = Math.max(Math.round(Number(standardQuote.data.durationMin || 6)), 3)
      const premiumEta = Math.max(Math.round(Number(premiumQuote.data.durationMin || 8)), 4)

      return [
        {
          id: 'bike',
          name: 'Xe máy',
          etaMinutes: Math.max(standardEta - 2, 2),
          price: normalizePrice(standardFare * 0.55),
          capacity: 1,
          quoteId: standardQuote.data.quoteId,
          serviceType: 'STANDARD'
        },
        {
          id: 'car4',
          name: 'Xe 4 chỗ',
          etaMinutes: standardEta,
          price: normalizePrice(standardFare),
          capacity: 4,
          surgeLabel:
            standardQuote.data.breakdown && Number(standardQuote.data.breakdown.surge) > 0
              ? 'Đang tăng giá'
              : undefined,
          quoteId: standardQuote.data.quoteId,
          serviceType: 'STANDARD'
        },
        {
          id: 'car7',
          name: 'Xe 7 chỗ',
          etaMinutes: premiumEta,
          price: normalizePrice(premiumFare),
          capacity: 7,
          quoteId: premiumQuote.data.quoteId,
          serviceType: 'PREMIUM'
        }
      ]
    } catch {
      return fallbackRideOptions
    }
  },

  async startRide({ pickupLabel, destinationLabel, option }: StartRidePayload) {
    const pickup = resolveLocation(pickupLabel, pickupPoint)
    const destination = resolveLocation(destinationLabel, destinationPoints[0] || pickupPoint)

    const created = await rideApi.createRide({
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      dropoffLat: destination.lat,
      dropoffLng: destination.lng,
      status: 'requested'
    })

    let ride = created.data
    const assigned = await moveRideToStatus(ride.id, 'ASSIGNED')
    if (assigned?.data) {
      ride = assigned.data
    }

    const driver: DriverInfo = ride.driverId
      ? {
          id: ride.driverId,
          name: `Tài xế ${ride.driverId.slice(0, 6)}`,
          rating: 4.8,
          vehicle: 'Xe tiêu chuẩn',
          plate: 'Đang cập nhật'
        }
      : {
          ...mockDriver,
          id: 'pending-driver',
          name: 'Đang tìm tài xế',
          vehicle: option.name
        }

    return { ride, driver, pickup, destination }
  },

  async createPayment(rideId: string, method: string, amount: number) {
    await moveRideToStatus(rideId, 'ARRIVING')
    await moveRideToStatus(rideId, 'IN_PROGRESS')
    await moveRideToStatus(rideId, 'COMPLETED')

    return paymentApi.createPayment({
      rideId,
      amount: normalizePrice(amount).toFixed(2),
      currency: 'VND',
      method: toMethodCode(method)
    })
  },

  async submitRating(rideId: string, driverId: string | undefined, stars: number, comment: string) {
    if (!isUuid(rideId)) {
      return {
        data: {
          id: `local-${Date.now()}`,
          rideId,
          driverId: driverId || 'unknown',
          rating: stars,
          comment: comment || '',
          status: 'submitted'
        }
      }
    }

    const safeDriverId = isUuid(driverId) ? driverId : rideId
    return reviewApi.createReview({
      rideId,
      driverId: safeDriverId,
      rating: stars,
      comment: comment.trim() || undefined
    })
  },

  async getHistory(riderId?: string | null): Promise<RideHistoryItem[]> {
    if (!riderId) return []
    const [ridesResult, paymentsResult] = await Promise.all([
      rideApi.listRides({ limit: 50, riderId }),
      paymentApi.listPayments(100)
    ])

    const amountByRideId = (paymentsResult.data || []).reduce<Record<string, number>>((acc, payment) => {
      const current = acc[payment.rideId] || 0
      const amount = Number(payment.amount || 0)
      acc[payment.rideId] = current + (Number.isFinite(amount) ? amount : 0)
      return acc
    }, {})

    const rows = ridesResult.data || []
    const filtered = rows.filter((ride) => {
      const status = String(ride.status || '').toLowerCase()
      return status === 'completed' || status === 'cancelled'
    })

    return filtered.map((ride) => ({
      id: ride.id,
      date: (ride.createdAt || new Date().toISOString()).slice(0, 16).replace('T', ' '),
      pickup: formatLocation(ride.pickupLat, ride.pickupLng),
      destination: formatLocation(ride.dropoffLat, ride.dropoffLng),
      amount: Math.round(amountByRideId[ride.id] || 0),
      status: String(ride.status || '').toLowerCase() === 'cancelled' ? 'cancelled' : 'completed'
    }))
  }
}

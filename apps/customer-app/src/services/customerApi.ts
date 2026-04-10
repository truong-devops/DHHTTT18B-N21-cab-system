import type { ApiError } from '../lib/api';
import type { DriverInfo, LocationPoint, RideHistoryItem, RideOption, RidePriceBreakdown } from '../mock/data';
import { destinationPoints, pickupPoint } from '../mock/data';
import * as authApi from './authApi';
import * as etaApi from './etaApi';
import * as paymentApi from './paymentApi';
import * as pricingApi from './pricingApi';
import * as reviewApi from './reviewApi';
import * as rideApi from './rideApi';

type StartRidePayload = {
  pickupLabel: string;
  destinationLabel: string;
};

type LivePickup = {
  latitude: number;
  longitude: number;
};

let livePickupCoordinate: LivePickup | null = null;

function isApiError(error: unknown): error is ApiError {
  return Boolean(error && typeof error === 'object' && 'status' in error);
}

function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

function normalizePrice(value: number) {
  return Math.max(Math.round(value), 12000);
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function normalizeEta(value: unknown, fallback: number) {
  const parsed = Math.round(toFiniteNumber(value, fallback));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.max(fallback, 2);
  }
  return Math.max(parsed, 2);
}

function buildPriceBreakdown(quote: pricingApi.QuoteData, total: number): RidePriceBreakdown {
  const distanceKm = Math.max(toFiniteNumber(quote.distanceKm, 0), 0);
  const durationMin = Math.max(toFiniteNumber(quote.durationMin, 0), 0);
  const baseFare = Math.max(Math.round(toFiniteNumber(quote.breakdown?.base, 0)), 0);
  const perKm = Math.max(toFiniteNumber(quote.breakdown?.perKm, 0), 0);
  const perMin = Math.max(toFiniteNumber(quote.breakdown?.perMin, 0), 0);
  const distanceFee = Math.max(Math.round(perKm * distanceKm), 0);
  const timeFee = Math.max(Math.round(perMin * durationMin), 0);
  const surgeFee = Math.max(Math.round(toFiniteNumber(quote.breakdown?.surge, 0)), 0);
  const discount = Math.max(Math.round(toFiniteNumber(quote.breakdown?.discount, 0)), 0);
  const subtotal = Math.max(Math.round(baseFare + distanceFee + timeFee), 0);

  return {
    baseFare,
    distanceFee,
    timeFee,
    surgeFee,
    discount,
    subtotal,
    total,
    distanceKm: Number(distanceKm.toFixed(2)),
    durationMin: Math.max(Math.round(durationMin), 0),
    currency: quote.currency || 'VND'
  };
}

function scaleBreakdown(source: RidePriceBreakdown, factor: number, total: number): RidePriceBreakdown {
  const safeFactor = Number.isFinite(factor) && factor > 0 ? factor : 1;

  return {
    ...source,
    baseFare: Math.max(Math.round(source.baseFare * safeFactor), 0),
    distanceFee: Math.max(Math.round(source.distanceFee * safeFactor), 0),
    timeFee: Math.max(Math.round(source.timeFee * safeFactor), 0),
    surgeFee: Math.max(Math.round(source.surgeFee * safeFactor), 0),
    discount: Math.max(Math.round(source.discount * safeFactor), 0),
    subtotal: Math.max(Math.round(source.subtotal * safeFactor), 0),
    total
  };
}

function getSurgeMeta(price: number, breakdown: RidePriceBreakdown) {
  if (!breakdown.surgeFee) {
    return { surgeLabel: undefined, surgeMultiplier: undefined };
  }

  const baseFare = Math.max(price - breakdown.surgeFee, 1);
  const multiplier = Number((price / baseFare).toFixed(2));
  if (!Number.isFinite(multiplier) || multiplier <= 1) {
    return { surgeLabel: undefined, surgeMultiplier: undefined };
  }

  return {
    surgeLabel: `Surge x${multiplier.toFixed(2)}`,
    surgeMultiplier: multiplier
  };
}

function toMethodCode(method: string): 'CASH' | 'WALLET' | 'VIETQR' {
  const normalized = method.trim().toUpperCase();

  // Keep backend stable: CARD is routed via WALLET flow in Payment Service.
  if (normalized === 'CARD' || normalized === 'WALLET' || normalized === 'VI') return 'WALLET';
  if (normalized === 'VIETQR' || normalized === 'QR') return 'VIETQR';
  if (normalized === 'CASH') return 'CASH';

  // Backward compatibility for old UI labels.
  const legacy = method.trim().toLowerCase();
  if (legacy.includes('wallet') || legacy.includes('the')) return 'WALLET';
  if (legacy.includes('vietqr') || legacy.includes('qr')) return 'VIETQR';
  return 'CASH';
}

function isUuid(value: string | undefined) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function buildUserName(identifier: string, user: authApi.AuthUser) {
  if (user.username && user.username.trim()) return user.username.trim();
  if (user.email && user.email.trim()) return user.email.trim();
  return identifier;
}

function buildPhone(identifier: string) {
  const normalized = identifier.trim();
  return normalized.includes('@') ? 'N/A' : normalized;
}

function getDestinationPointOrThrow(label: string): LocationPoint {
  const point = destinationPoints.find((item) => item.label === label);
  if (!point) {
    throw new Error(`Khong tim thay toa do diem den: ${label}`);
  }
  return point;
}

function getPickupPointOrThrow(label: string): LocationPoint {
  if (label === pickupPoint.label) {
    if (!livePickupCoordinate) {
      throw new Error('Khong lay duoc toa do diem don. Vui long bat GPS va thu lai.');
    }
    return {
      label,
      lat: livePickupCoordinate.latitude,
      lng: livePickupCoordinate.longitude
    };
  }

  const point = destinationPoints.find((item) => item.label === label);
  if (!point) {
    throw new Error(`Khong tim thay toa do diem don: ${label}`);
  }
  return point;
}

function formatLocation(lat?: number | null, lng?: number | null) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return '-';
  }
  return `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;
}

function ensureNumberCoordinate(value: number | null | undefined, field: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`Du lieu ${field} khong hop le tu backend`);
  }
  return Number(value);
}

async function moveRideToStatus(rideId: string, status: string) {
  try {
    return await rideApi.updateRideStatus(rideId, status);
  } catch (error) {
    if (isApiError(error) && error.status === 409) {
      return null;
    }
    throw error;
  }
}

export const customerApi = {
  setLivePickupLocation(latitude: number, longitude: number) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    livePickupCoordinate = { latitude, longitude };
  },

  getLivePickupLocation() {
    return livePickupCoordinate;
  },

  async requestOtp(identifier: string) {
    await authApi.healthCheck();
    return { ok: Boolean(identifier.trim()) };
  },

  async verifyOtp(identifier: string, otp: string) {
    const normalizedIdentifier = normalizeIdentifier(identifier);
    const password = otp.trim();
    if (!normalizedIdentifier) {
      throw new Error('Thieu so dien thoai/email');
    }
    if (!password) {
      throw new Error('Thieu OTP/mat khau');
    }

    let authResult: authApi.AuthResponse;
    try {
      authResult = await authApi.login(normalizedIdentifier, password);
    } catch (error) {
      if (isApiError(error) && error.status === 401) {
        authResult = await authApi.register(normalizedIdentifier, password);
      } else {
        throw error;
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
    };
  },

  async getRideOptions(pickupLabel: string, destinationLabel: string): Promise<RideOption[]> {
    const pickup = getPickupPointOrThrow(pickupLabel);
    const destination = getDestinationPointOrThrow(destinationLabel);

    const [standardQuote, premiumQuote, etaEstimate] = await Promise.all([
      pricingApi.createQuote(pickup, destination, 'STANDARD'),
      pricingApi.createQuote(pickup, destination, 'PREMIUM'),
      etaApi.estimateEta(pickup, destination).catch(() => null)
    ]);

    const standardFare = Number(standardQuote.data.estimatedFare || 0);
    const premiumFare = Number(premiumQuote.data.estimatedFare || 0);
    const etaServiceMinutes = Math.round(toFiniteNumber(etaEstimate?.data?.eta_minutes, 0));
    const standardEta = etaServiceMinutes > 0 ? Math.max(etaServiceMinutes, 2) : normalizeEta(standardQuote.data.durationMin, 6);
    const premiumEta = Math.max(normalizeEta(premiumQuote.data.durationMin, 8), standardEta + 1);

    const bikePrice = normalizePrice(standardFare * 0.55);
    const car4Price = normalizePrice(standardFare);
    const car7Price = normalizePrice(premiumFare);

    const car4Breakdown = buildPriceBreakdown(standardQuote.data, car4Price);
    const car7Breakdown = buildPriceBreakdown(premiumQuote.data, car7Price);
    const bikeBreakdown = scaleBreakdown(car4Breakdown, bikePrice / Math.max(car4Price, 1), bikePrice);

    const bikeSurge = getSurgeMeta(bikePrice, bikeBreakdown);
    const car4Surge = getSurgeMeta(car4Price, car4Breakdown);
    const car7Surge = getSurgeMeta(car7Price, car7Breakdown);

    return [
      {
        id: 'bike',
        name: 'Xe may',
        etaMinutes: Math.max(standardEta - 2, 2),
        price: bikePrice,
        capacity: 1,
        vehicleIcon: 'motorbike.fill',
        surgeLabel: bikeSurge.surgeLabel,
        surgeMultiplier: bikeSurge.surgeMultiplier,
        priceBreakdown: bikeBreakdown,
        quoteId: standardQuote.data.quoteId,
        serviceType: 'STANDARD'
      },
      {
        id: 'car4',
        name: 'Xe 4 cho',
        etaMinutes: standardEta,
        price: car4Price,
        capacity: 4,
        vehicleIcon: 'car.fill',
        surgeLabel: car4Surge.surgeLabel,
        surgeMultiplier: car4Surge.surgeMultiplier,
        priceBreakdown: car4Breakdown,
        quoteId: standardQuote.data.quoteId,
        serviceType: 'STANDARD'
      },
      {
        id: 'car7',
        name: 'Xe 7 cho',
        etaMinutes: premiumEta,
        price: car7Price,
        capacity: 7,
        vehicleIcon: 'car.fill',
        surgeLabel: car7Surge.surgeLabel,
        surgeMultiplier: car7Surge.surgeMultiplier,
        priceBreakdown: car7Breakdown,
        quoteId: premiumQuote.data.quoteId,
        serviceType: 'PREMIUM'
      }
    ];
  },

  async startRide({ pickupLabel, destinationLabel }: StartRidePayload) {
    const pickup = getPickupPointOrThrow(pickupLabel);
    const destination = getDestinationPointOrThrow(destinationLabel);

    const created = await rideApi.createRide({
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      pickupLabel,
      dropoffLat: destination.lat,
      dropoffLng: destination.lng,
      dropoffLabel: destinationLabel,
      status: 'requested'
    });

    const ride = created.data;
    const ridePickupLat = ensureNumberCoordinate(ride.pickupLat, 'pickupLat');
    const ridePickupLng = ensureNumberCoordinate(ride.pickupLng, 'pickupLng');
    const rideDropoffLat = ensureNumberCoordinate(ride.dropoffLat, 'dropoffLat');
    const rideDropoffLng = ensureNumberCoordinate(ride.dropoffLng, 'dropoffLng');

    const driver: DriverInfo | null = null;

    return {
      ride,
      driver,
      pickup: {
        label: ride.pickupLabel || pickupLabel,
        lat: ridePickupLat,
        lng: ridePickupLng
      },
      destination: {
        label: ride.dropoffLabel || destinationLabel,
        lat: rideDropoffLat,
        lng: rideDropoffLng
      }
    };
  },

  async createPayment(rideId: string, method: string, amount: number) {
    await moveRideToStatus(rideId, 'ARRIVING');
    await moveRideToStatus(rideId, 'IN_PROGRESS');
    await moveRideToStatus(rideId, 'COMPLETED');

    return paymentApi.createPayment({
      rideId,
      amount: normalizePrice(amount).toFixed(2),
      currency: 'VND',
      method: toMethodCode(method)
    });
  },

  async submitRating(rideId: string, driverId: string | undefined, stars: number, comment: string) {
    if (!isUuid(rideId)) {
      throw new Error('Ride ID khong hop le');
    }
    const normalizedDriverId = typeof driverId === 'string' ? driverId.trim() : '';
    if (!normalizedDriverId) {
      throw new Error('Driver ID khong hop le');
    }
    return reviewApi.createReview({
      rideId,
      driverId: normalizedDriverId,
      rating: stars,
      comment: comment.trim() || undefined
    });
  },

  async getHistory(riderId?: string | null): Promise<RideHistoryItem[]> {
    if (!riderId) return [];
    const [ridesResult, paymentsResult] = await Promise.all([rideApi.listRides({ limit: 50, riderId }), paymentApi.listPayments(100)]);

    const amountByRideId = (paymentsResult.data || []).reduce<Record<string, number>>((acc, payment) => {
      const current = acc[payment.rideId] || 0;
      const amount = Number(payment.amount || 0);
      acc[payment.rideId] = current + (Number.isFinite(amount) ? amount : 0);
      return acc;
    }, {});

    const rows = ridesResult.data || [];
    const filtered = rows.filter((ride) => {
      const status = String(ride.status || '').toLowerCase();
      return status === 'completed' || status === 'cancelled';
    });

    return filtered.map((ride) => ({
      id: ride.id,
      date: (ride.createdAt || new Date().toISOString()).slice(0, 16).replace('T', ' '),
      pickup: ride.pickupLabel || formatLocation(ride.pickupLat, ride.pickupLng),
      destination: ride.dropoffLabel || formatLocation(ride.dropoffLat, ride.dropoffLng),
      amount: Math.round(amountByRideId[ride.id] || 0),
      status: String(ride.status || '').toLowerCase() === 'cancelled' ? 'cancelled' : 'completed'
    }));
  }
};

const EARTH_RADIUS_KM = 6371;

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function haversineKm(pickup, dropoff) {
  const lat1 = toRadians(pickup.lat);
  const lng1 = toRadians(pickup.lng);
  const lat2 = toRadians(dropoff.lat);
  const lng2 = toRadians(dropoff.lng);

  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function estimateDurationMin(distanceKm, averageSpeedKmh) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    return 0;
  }
  if (!Number.isFinite(averageSpeedKmh) || averageSpeedKmh <= 0) {
    return 0;
  }
  return (distanceKm / averageSpeedKmh) * 60;
}

function calculateFare({
  distanceKm,
  durationMin,
  rateCard,
  discount = 0
}) {
  const safeDistance = Math.max(0, distanceKm || 0);
  const safeDuration = Math.max(0, durationMin || 0);
  const base = Number(rateCard.baseFare || 0);
  const perKm = Number(rateCard.perKmRate || 0) * safeDistance;
  const perMin = Number(rateCard.perMinRate || 0) * safeDuration;
  const subtotal = base + perKm + perMin;
  const surgeMultiplier = Number(rateCard.surgeMultiplier || 1);
  const surge =
    surgeMultiplier > 1
      ? subtotal * (surgeMultiplier - 1)
      : 0;
  const safeDiscount = Math.max(0, Number(discount || 0));
  const estimatedFare = Math.max(0, subtotal + surge - safeDiscount);

  return {
    estimatedFare: round(estimatedFare, 2),
    breakdown: {
      base: round(base, 2),
      perKm: round(perKm, 2),
      perMin: round(perMin, 2),
      discount: round(safeDiscount, 2),
      surge: round(surge, 2)
    }
  };
}

module.exports = {
  haversineKm,
  estimateDurationMin,
  calculateFare,
  round
};

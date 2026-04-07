const { executeModel } = require('./modelRuntime');

const DEFAULT_WEIGHTS = Object.freeze({
  distance: 0.4,
  rating: 0.3,
  eta: 0.2,
  price: 0.1
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function invertNormalize(value, min, max) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (max <= min) {
    return 1;
  }
  const normalized = (value - min) / (max - min);
  return clamp(1 - normalized, 0, 1);
}

function normalizeCandidate(raw) {
  const driverId = raw?.driver_id || raw?.driverId || null;
  if (!driverId) {
    return null;
  }
  return {
    driver_id: String(driverId),
    online: raw?.online !== false,
    rating: clamp(toNumber(raw?.rating, 0), 0, 5),
    distance_m: Math.max(0, toNumber(raw?.distance_m ?? raw?.distanceMeters, Number.MAX_SAFE_INTEGER)),
    eta_min: Math.max(0, toNumber(raw?.eta_min, Number.MAX_SAFE_INTEGER)),
    price_score: clamp(toNumber(raw?.price_score, 0.5), 0, 1),
    vehicle_type: raw?.vehicle_type || raw?.vehicleType || null
  };
}

function scoreCandidates(candidates) {
  if (!candidates.length) {
    return [];
  }

  const distances = candidates.map((item) => item.distance_m);
  const etas = candidates.map((item) => item.eta_min);
  const minDistance = Math.min(...distances);
  const maxDistance = Math.max(...distances);
  const minEta = Math.min(...etas);
  const maxEta = Math.max(...etas);

  return candidates.map((candidate) => {
    const distanceScore = invertNormalize(candidate.distance_m, minDistance, maxDistance);
    const etaScore = invertNormalize(candidate.eta_min, minEta, maxEta);
    const ratingScore = clamp(candidate.rating / 5, 0, 1);
    const priceScore = candidate.price_score;
    const totalScore =
      DEFAULT_WEIGHTS.distance * distanceScore +
      DEFAULT_WEIGHTS.rating * ratingScore +
      DEFAULT_WEIGHTS.eta * etaScore +
      DEFAULT_WEIGHTS.price * priceScore;

    return {
      ...candidate,
      score: Number(totalScore.toFixed(6))
    };
  });
}

function buildModelDecision(candidates) {
  const ranked = scoreCandidates(candidates)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.distance_m !== b.distance_m) {
        return a.distance_m - b.distance_m;
      }
      return b.rating - a.rating;
    })
    .map((item, idx) => ({
      ...item,
      rank: idx + 1
    }));

  return {
    top_3: ranked.slice(0, 3),
    selected_driver: ranked[0] || null,
    decision_log: {
      weights: DEFAULT_WEIGHTS,
      reason: ranked.length ? 'highest_score' : 'no_online_candidates'
    }
  };
}

function buildFallbackDecision(candidates) {
  const ranked = [...candidates]
    .sort((a, b) => {
      if (a.distance_m !== b.distance_m) {
        return a.distance_m - b.distance_m;
      }
      if (a.eta_min !== b.eta_min) {
        return a.eta_min - b.eta_min;
      }
      return b.rating - a.rating;
    })
    .map((item, idx) => ({
      ...item,
      rank: idx + 1,
      score: null
    }));

  return {
    top_3: ranked.slice(0, 3),
    selected_driver: ranked[0] || null,
    decision_log: {
      weights: DEFAULT_WEIGHTS,
      reason: ranked.length ? 'fallback_nearest_online' : 'fallback_no_online_candidates'
    }
  };
}

async function recommendDrivers(payload) {
  const modelVersion = process.env.AI_RECOMMENDATION_MODEL_VERSION || 'recommendation-v1';
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates.map(normalizeCandidate).filter(Boolean) : [];
  const onlineCandidates = candidates.filter((item) => item.online);
  const validByVehicle = payload?.vehicle_type
    ? onlineCandidates.filter((item) => !item.vehicle_type || String(item.vehicle_type).toUpperCase() === String(payload.vehicle_type).toUpperCase())
    : onlineCandidates;
  const chosenPool = validByVehicle.length ? validByVehicle : onlineCandidates;

  const execution = await executeModel({
    task: 'recommendation',
    payload,
    modelFn: () => buildModelDecision(chosenPool),
    fallbackFn: () => buildFallbackDecision(chosenPool)
  });

  return {
    ...execution.output,
    model_version: modelVersion,
    fallback_used: execution.fallbackUsed
  };
}

module.exports = {
  recommendDrivers,
  normalizeCandidate,
  buildModelDecision,
  buildFallbackDecision
};

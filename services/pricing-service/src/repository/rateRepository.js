const redis = require('../cache/redis');
const { loadRatesFromEnv, loadCouponDiscounts } = require('../config/rates');

const RATE_PREFIX = 'rates:';
const RATE_CACHE_TTL_SEC = Number(process.env.RATE_CACHE_TTL_SEC || 900);
const RATE_LOCAL_CACHE_TTL_SEC = Number(process.env.RATE_LOCAL_CACHE_TTL_SEC || 300);

const rates = loadRatesFromEnv();
const couponDiscounts = loadCouponDiscounts();
const localRateCache = new Map();

function getCouponDiscount(code) {
  if (!code) return 0;
  const value = couponDiscounts[code];
  return Number.isFinite(value) ? value : 0;
}

async function getRateCard(serviceType) {
  const now = Date.now();
  const localCached = localRateCache.get(serviceType);
  if (localCached && localCached.expiresAt > now) {
    return localCached.value;
  }

  const key = `${RATE_PREFIX}${serviceType}`;
  if (RATE_CACHE_TTL_SEC > 0) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (RATE_LOCAL_CACHE_TTL_SEC > 0) {
          localRateCache.set(serviceType, {
            value: parsed,
            expiresAt: now + RATE_LOCAL_CACHE_TTL_SEC * 1000
          });
        }
        return parsed;
      }
    } catch (_err) {
      // ignore cache errors
    }
  }

  const rateCard = rates[serviceType];
  if (!rateCard) {
    return null;
  }

  if (RATE_CACHE_TTL_SEC > 0) {
    try {
      await redis.set(key, JSON.stringify(rateCard), 'EX', RATE_CACHE_TTL_SEC);
    } catch (_err) {
      // ignore cache errors
    }
  }

  if (RATE_LOCAL_CACHE_TTL_SEC > 0) {
    localRateCache.set(serviceType, {
      value: rateCard,
      expiresAt: now + RATE_LOCAL_CACHE_TTL_SEC * 1000
    });
  }

  return rateCard;
}

module.exports = { getRateCard, getCouponDiscount };

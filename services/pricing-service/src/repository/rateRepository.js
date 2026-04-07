const redis = require('../cache/redis');
const { loadRatesFromEnv, loadCouponDiscounts } = require('../config/rates');

const RATE_PREFIX = 'rates:';
const RATE_CACHE_TTL_SEC = Number(process.env.RATE_CACHE_TTL_SEC || 900);

const rates = loadRatesFromEnv();
const couponDiscounts = loadCouponDiscounts();

function getCouponDiscount(code) {
  if (!code) return 0;
  const value = couponDiscounts[code];
  return Number.isFinite(value) ? value : 0;
}

async function getRateCard(serviceType) {
  const key = `${RATE_PREFIX}${serviceType}`;
  if (RATE_CACHE_TTL_SEC > 0) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached);
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

  return rateCard;
}

module.exports = { getRateCard, getCouponDiscount };

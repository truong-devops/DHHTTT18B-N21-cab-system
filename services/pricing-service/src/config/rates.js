const DEFAULT_RATES = {
  STANDARD: {
    currency: 'VND',
    baseFare: 12000,
    perKmRate: 5000,
    perMinRate: 500,
    surgeMultiplier: 1.0,
    averageSpeedKmh: 25
  },
  PREMIUM: {
    currency: 'VND',
    baseFare: 20000,
    perKmRate: 8000,
    perMinRate: 800,
    surgeMultiplier: 1.2,
    averageSpeedKmh: 25
  }
};

function loadRatesFromEnv() {
  let rates = { ...DEFAULT_RATES };

  if (process.env.RATES_JSON) {
    try {
      const parsed = JSON.parse(process.env.RATES_JSON);
      rates = Object.fromEntries(
        Object.entries({ ...rates, ...parsed }).map(([key, value]) => {
          const fallback = DEFAULT_RATES[key] || {};
          const override = value && typeof value === 'object' ? value : {};
          return [key, { ...fallback, ...override }];
        })
      );
    } catch (_err) {
      // ignore invalid override
    }
  }

  const avgSpeed = Number(process.env.AVERAGE_SPEED_KMH || '');
  if (Number.isFinite(avgSpeed) && avgSpeed > 0) {
    rates = Object.fromEntries(Object.entries(rates).map(([key, value]) => [key, { ...value, averageSpeedKmh: avgSpeed }]));
  }

  return rates;
}

function loadCouponDiscounts() {
  if (process.env.COUPON_DISCOUNTS_JSON) {
    try {
      const parsed = JSON.parse(process.env.COUPON_DISCOUNTS_JSON);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_err) {
      return {};
    }
  }
  return {};
}

module.exports = {
  DEFAULT_RATES,
  loadRatesFromEnv,
  loadCouponDiscounts
};

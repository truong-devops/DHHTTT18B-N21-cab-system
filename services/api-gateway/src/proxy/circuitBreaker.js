function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const ENABLED = String(process.env.PROXY_CIRCUIT_BREAKER_ENABLED || 'true') !== 'false';
const FAILURE_THRESHOLD = Math.max(1, toNumber(process.env.PROXY_CIRCUIT_BREAKER_FAILURE_THRESHOLD, 3));
const OPEN_MS = Math.max(100, toNumber(process.env.PROXY_CIRCUIT_BREAKER_OPEN_MS, 10000));

const states = new Map();

function initState(domain) {
  return {
    domain,
    status: 'CLOSED',
    consecutiveFailures: 0,
    openUntil: 0
  };
}

function getState(domain) {
  if (!states.has(domain)) {
    states.set(domain, initState(domain));
  }
  return states.get(domain);
}

function getFailureThreshold(domain) {
  const key = `PROXY_CIRCUIT_BREAKER_FAILURE_THRESHOLD_${String(domain || '').toUpperCase()}`;
  return Math.max(1, toNumber(process.env[key], FAILURE_THRESHOLD));
}

function getOpenMs(domain) {
  const key = `PROXY_CIRCUIT_BREAKER_OPEN_MS_${String(domain || '').toUpperCase()}`;
  return Math.max(100, toNumber(process.env[key], OPEN_MS));
}

function allow(domain) {
  if (!ENABLED) {
    return {
      allowed: true,
      state: 'DISABLED',
      retryAfterMs: 0
    };
  }

  const state = getState(domain);
  const now = Date.now();
  if (state.status === 'OPEN' && now < state.openUntil) {
    return {
      allowed: false,
      state: state.status,
      retryAfterMs: Math.max(1, state.openUntil - now)
    };
  }

  if (state.status === 'OPEN' && now >= state.openUntil) {
    state.status = 'HALF_OPEN';
  }

  return {
    allowed: true,
    state: state.status,
    retryAfterMs: 0
  };
}

function markSuccess(domain) {
  if (!ENABLED) {
    return;
  }
  const state = getState(domain);
  state.status = 'CLOSED';
  state.consecutiveFailures = 0;
  state.openUntil = 0;
}

function markFailure(domain) {
  if (!ENABLED) {
    return;
  }
  const state = getState(domain);
  const failureThreshold = getFailureThreshold(domain);
  const openMs = getOpenMs(domain);
  state.consecutiveFailures += 1;
  if (state.status === 'HALF_OPEN' || state.consecutiveFailures >= failureThreshold) {
    state.status = 'OPEN';
    state.openUntil = Date.now() + openMs;
  }
}

module.exports = {
  allow,
  markSuccess,
  markFailure
};

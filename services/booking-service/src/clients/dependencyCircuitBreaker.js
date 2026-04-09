function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function createDependencyCircuitBreaker(options = {}) {
  const name = String(options.name || 'dependency');
  const enabled = options.enabled !== false;
  const failureThreshold = Math.max(1, toNumber(options.failureThreshold, 3));
  const openMs = Math.max(100, toNumber(options.openMs, 10000));

  let state = 'CLOSED';
  let consecutiveFailures = 0;
  let openedAt = 0;
  let openUntil = 0;
  let halfOpenInFlight = 0;

  function now() {
    return Date.now();
  }

  function transitionToOpen() {
    state = 'OPEN';
    openedAt = now();
    openUntil = openedAt + openMs;
    halfOpenInFlight = 0;
  }

  function allowRequest() {
    if (!enabled) {
      return { allowed: true, state: 'DISABLED' };
    }

    const ts = now();
    if (state === 'OPEN') {
      if (ts < openUntil) {
        return {
          allowed: false,
          state,
          retryAfterMs: Math.max(1, openUntil - ts)
        };
      }
      state = 'HALF_OPEN';
      halfOpenInFlight = 0;
    }

    if (state === 'HALF_OPEN') {
      if (halfOpenInFlight >= 1) {
        return {
          allowed: false,
          state,
          retryAfterMs: Math.max(1, openMs / 2)
        };
      }
      halfOpenInFlight += 1;
      return { allowed: true, state };
    }

    return { allowed: true, state };
  }

  function onSuccess() {
    if (!enabled) {
      return;
    }
    consecutiveFailures = 0;
    state = 'CLOSED';
    openedAt = 0;
    openUntil = 0;
    halfOpenInFlight = 0;
  }

  function onFailure() {
    if (!enabled) {
      return;
    }

    if (state === 'HALF_OPEN') {
      consecutiveFailures = failureThreshold;
      transitionToOpen();
      return;
    }

    consecutiveFailures += 1;
    if (consecutiveFailures >= failureThreshold) {
      transitionToOpen();
    }
  }

  function release() {
    if (state === 'HALF_OPEN' && halfOpenInFlight > 0) {
      halfOpenInFlight -= 1;
    }
  }

  function snapshot() {
    const ts = now();
    return {
      name,
      enabled,
      state,
      consecutiveFailures,
      openedAt,
      openUntil,
      retryAfterMs: state === 'OPEN' && ts < openUntil ? Math.max(1, openUntil - ts) : 0
    };
  }

  return {
    allowRequest,
    onSuccess,
    onFailure,
    release,
    snapshot
  };
}

function computeExponentialBackoffMs({ attempt, baseMs, maxMs, jitterRatio = 0.2 }) {
  const normalizedAttempt = Math.max(1, toNumber(attempt, 1));
  const base = Math.max(1, toNumber(baseMs, 100));
  const cap = Math.max(base, toNumber(maxMs, 2000));
  const ratio = Math.max(0, Math.min(1, toNumber(jitterRatio, 0.2)));

  const exp = Math.min(cap, Math.round(base * 2 ** Math.max(0, normalizedAttempt - 1)));
  if (ratio === 0) {
    return exp;
  }
  const jitter = Math.round(exp * ratio * Math.random());
  return Math.min(cap, exp + jitter);
}

function buildCircuitOpenError(dependency, gate) {
  const error = new Error(`${dependency} circuit breaker is open`);
  error.code = 'CIRCUIT_OPEN';
  error.dependency = dependency;
  error.retryAfterMs = Number(gate?.retryAfterMs || 0);
  return error;
}

module.exports = {
  createDependencyCircuitBreaker,
  computeExponentialBackoffMs,
  buildCircuitOpenError
};

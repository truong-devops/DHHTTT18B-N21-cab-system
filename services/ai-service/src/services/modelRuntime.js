function sleep(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asTaskSet(raw) {
  return String(raw || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function shouldForceError(task, payload) {
  if (payload?.simulate_model_error === true) {
    return true;
  }
  const tasks = asTaskSet(process.env.AI_FORCE_MODEL_ERROR_TASKS);
  return tasks.includes('all') || tasks.includes(String(task || '').toLowerCase());
}

function resolveForcedDelayMs(task, payload) {
  if (Number.isFinite(Number(payload?.simulate_delay_ms))) {
    return Number(payload.simulate_delay_ms);
  }
  const envTaskKey = `AI_${String(task || 'model').toUpperCase()}_MODEL_DELAY_MS`;
  const taskDelay = Number(process.env[envTaskKey]);
  if (Number.isFinite(taskDelay) && taskDelay > 0) {
    return taskDelay;
  }
  const globalDelay = Number(process.env.AI_FORCE_MODEL_DELAY_MS);
  if (Number.isFinite(globalDelay) && globalDelay > 0) {
    return globalDelay;
  }
  return 0;
}

async function withTimeout(promise, timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error('model timeout');
      err.code = 'ETIMEDOUT';
      reject(err);
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function executeModel({ task, payload, modelFn, fallbackFn }) {
  const timeoutMs = Number(process.env.AI_MODEL_TIMEOUT_MS || 180);
  try {
    const forcedDelay = resolveForcedDelayMs(task, payload);
    if (forcedDelay > 0) {
      await sleep(forcedDelay);
    }
    if (shouldForceError(task, payload)) {
      const err = new Error('simulated model error');
      err.code = 'MODEL_ERROR';
      throw err;
    }
    const output = await withTimeout(Promise.resolve().then(() => modelFn()), timeoutMs);
    return {
      output,
      fallbackUsed: false,
      fallbackReason: null
    };
  } catch (error) {
    const output = fallbackFn(error);
    return {
      output,
      fallbackUsed: true,
      fallbackReason: error?.code || 'UNKNOWN'
    };
  }
}

module.exports = {
  executeModel
};

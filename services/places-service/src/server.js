require('dotenv').config();

const { createApp } = require('./app');
const { config } = require('./config');
const { createPool } = require('./db/pool');
const { initDb } = require('./db/init');
const { createRecentRepository } = require('./repositories/recentRepository');
const { createNominatimProvider } = require('./providers/nominatimProvider');
const { createSearchService } = require('./services/searchService');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(task, { retries = 8, delayMs = 800 } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await sleep(delayMs * (attempt + 1));
    }
  }
  throw lastError;
}

async function start() {
  const pool = createPool(config.databaseUrl);
  await withRetry(() => initDb(pool));

  const recentRepository = createRecentRepository({
    pool,
    maxRecentPerUser: config.maxRecentPerUser
  });
  const externalProvider = config.placesProviderEnabled
    ? createNominatimProvider({
        baseUrl: config.placesProviderBaseUrl,
        timeoutMs: config.placesProviderTimeoutMs,
        userAgent: config.placesProviderUserAgent,
        countryCodes: config.placesProviderCountryCodes
      })
    : null;
  const searchService = createSearchService({ externalProvider });
  const app = createApp({
    searchService,
    recentRepository,
    defaultLimit: config.defaultResultLimit,
    maxLimit: config.maxResultLimit
  });

  const server = app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[places-service] listening on ${config.port}`);
  });

  const shutdown = async () => {
    server.close();
    await pool.end();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[places-service] failed to start', error);
  process.exit(1);
});

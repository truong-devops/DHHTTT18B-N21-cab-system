const { Pool } = require('pg');
const monitoring = require('../monitoring');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Postgres restart can emit idle-client errors from pg-pool.
// Attach a handler so auth-service does not crash during DB failover tests.
pool.on('error', (error) => {
  monitoring.recordDependencyRequest({
    dependencyType: 'db',
    dependencyName: 'postgres',
    operation: 'POOL_IDLE_ERROR',
    outcome: 'error',
    durationMs: 0,
    attributes: {
      error_type: String(error && error.code ? error.code : 'pool_idle_error')
    }
  });
  // eslint-disable-next-line no-console
  console.warn('[auth-service] postgres pool idle client error', {
    message: error?.message || 'pool idle error',
    code: error?.code || 'UNKNOWN'
  });
});

function inferDbOperation(text) {
  if (typeof text === 'string') {
    const [token] = text.trim().split(/\s+/);
    return token ? token.toUpperCase() : 'QUERY';
  }
  if (text && typeof text === 'object' && typeof text.name === 'string') {
    return text.name;
  }
  return 'QUERY';
}

async function queryWithMetrics(queryFn, text, params) {
  const startedAt = Date.now();
  const operation = inferDbOperation(text);
  try {
    const result = await queryFn(text, params);
    monitoring.recordDependencyRequest({
      dependencyType: 'db',
      dependencyName: 'postgres',
      operation,
      outcome: 'success',
      durationMs: Date.now() - startedAt
    });
    return result;
  } catch (error) {
    monitoring.recordDependencyRequest({
      dependencyType: 'db',
      dependencyName: 'postgres',
      operation,
      outcome: 'error',
      durationMs: Date.now() - startedAt,
      attributes: {
        error_type: String(error && error.code ? error.code : 'query_error')
      }
    });
    throw error;
  }
}

const originalPoolQuery = pool.query.bind(pool);
pool.query = (text, params) => queryWithMetrics(originalPoolQuery, text, params);

module.exports = pool;

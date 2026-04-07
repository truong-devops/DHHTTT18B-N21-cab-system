const { Pool } = require('pg');
const monitoring = require('../monitoring');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
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

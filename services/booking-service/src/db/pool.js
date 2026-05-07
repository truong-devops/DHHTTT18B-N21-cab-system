const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');

const poolOptions = {
  connectionString: config.db.connectionString,
  max: config.db.maxPoolSize,
  min: config.db.minPoolSize,
  idleTimeoutMillis: config.db.idleTimeoutMs,
  connectionTimeoutMillis: config.db.connectionTimeoutMs
};
if (config.db.maxUses > 0) {
  poolOptions.maxUses = config.db.maxUses;
}

const pool = new Pool(poolOptions);

// Postgres restart can emit errors from idle clients.
// Keep process alive so request handlers can recover once DB is back.
pool.on('error', (error) => {
  logger.warn(
    {
      err: {
        message: error?.message || 'postgres pool error',
        code: error?.code || 'UNKNOWN'
      }
    },
    '[booking-service] postgres pool idle client error'
  );
});

function extractUpSql(raw) {
  const lines = raw.split(/\r?\n/);
  const upMarker = /^--\s*migrate:up\b/i;
  const downMarker = /^--\s*migrate:down\b/i;
  let hasMarkers = false;
  let inUp = false;
  const out = [];

  for (const line of lines) {
    if (upMarker.test(line)) {
      hasMarkers = true;
      inUp = true;
      continue;
    }
    if (downMarker.test(line)) {
      hasMarkers = true;
      inUp = false;
      continue;
    }
    if (!hasMarkers || inUp) {
      out.push(line);
    }
  }

  return out.join('\n').trim();
}

function migrationVersion(filename) {
  const match = String(filename || '').match(/^(\d+)/);
  return match ? match[1] : null;
}

async function runMigrations() {
  const migrationsDir = path.resolve(__dirname, '..', '..', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`
  );

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => /^\d+.*\.sql$/.test(file))
    .sort();

  const existing = await pool.query('SELECT version FROM schema_migrations');
  const applied = new Set(existing.rows.map((row) => row.version));

  for (const file of files) {
    const version = migrationVersion(file);
    if (!version || applied.has(version)) {
      continue;
    }

    const sql = extractUpSql(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
    if (!sql) {
      continue;
    }

    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
      await pool.query('COMMIT');
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  }
}

async function initDb() {
  await runMigrations();
}

async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      logger.warn(
        {
          err: {
            message: rollbackError?.message || 'rollback failed',
            code: rollbackError?.code || 'UNKNOWN'
          }
        },
        '[booking-service] rollback failed after transaction error'
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

async function closeDb() {
  await pool.end();
}

module.exports = {
  pool,
  initDb,
  withTransaction,
  closeDb
};

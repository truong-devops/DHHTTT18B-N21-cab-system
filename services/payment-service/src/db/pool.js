const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const config = require("../config");

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  max: config.db.max
});

function extractUpSql(raw) {
  const lines = raw.split(/\r?\n/);
  let inUp = false;
  let hasMarkers = false;
  const output = [];
  const upMarker = /^--\s*migrate:up\b/i;
  const downMarker = /^--\s*migrate:down\b/i;

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
      output.push(line);
    }
  }

  return output.join("\n").trim();
}

function getMigrationVersion(filename) {
  const match = filename.match(/^(\d+)/);
  return match ? match[1] : null;
}

async function runMigrations() {
  const migrationsDir = path.resolve(__dirname, "..", "..", "migrations");
  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version text PRIMARY KEY
     )`
  );

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => /^\d+.*\.sql$/.test(file))
    .sort();

  const appliedRows = await pool.query("SELECT version FROM schema_migrations");
  const applied = new Set(appliedRows.rows.map((row) => row.version));

  for (const file of files) {
    const version = getMigrationVersion(file);
    if (!version || applied.has(version)) {
      continue;
    }
    const raw = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    const sql = extractUpSql(raw);
    if (!sql) {
      continue;
    }
    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await pool.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
      await pool.query("COMMIT");
    } catch (err) {
      await pool.query("ROLLBACK");
      throw err;
    }
  }
}

async function initDb() {
  await runMigrations();
}

async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, initDb, withTransaction };

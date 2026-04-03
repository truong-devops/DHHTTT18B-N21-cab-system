const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const config = require("../config");
const monitoring = require("../monitoring");

const poolConfig = config.db.connectionString
  ? { connectionString: config.db.connectionString, max: config.db.max }
  : {
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      max: config.db.max
    };

const pool = new Pool(poolConfig);

function inferDbOperation(text) {
  if (typeof text === "string") {
    const [token] = text.trim().split(/\s+/);
    return token ? token.toUpperCase() : "QUERY";
  }
  if (text && typeof text === "object" && typeof text.name === "string") {
    return text.name;
  }
  return "QUERY";
}

async function queryWithMetrics(queryFn, text, params) {
  const startedAt = Date.now();
  const operation = inferDbOperation(text);
  try {
    const result = await queryFn(text, params);
    monitoring.recordDependencyRequest({
      dependencyType: "db",
      dependencyName: "postgres",
      operation,
      outcome: "success",
      durationMs: Date.now() - startedAt
    });
    return result;
  } catch (error) {
    monitoring.recordDependencyRequest({
      dependencyType: "db",
      dependencyName: "postgres",
      operation,
      outcome: "error",
      durationMs: Date.now() - startedAt,
      attributes: {
        error_type: String(error && error.code ? error.code : "query_error")
      }
    });
    throw error;
  }
}

const originalPoolQuery = pool.query.bind(pool);
pool.query = (text, params) =>
  queryWithMetrics(originalPoolQuery, text, params);

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
  const originalClientQuery = client.query.bind(client);
  client.query = (text, params) =>
    queryWithMetrics(originalClientQuery, text, params);
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

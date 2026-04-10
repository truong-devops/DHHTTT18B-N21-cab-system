async function initDb(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS places_recent_destinations (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      normalized_label TEXT NOT NULL,
      place_id TEXT NOT NULL,
      label TEXT NOT NULL,
      address TEXT NULL,
      lat DOUBLE PRECISION NULL,
      lng DOUBLE PRECISION NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS places_recent_destinations_user_label_uidx ON places_recent_destinations (user_id, normalized_label)'
  );
  await pool.query(
    'CREATE INDEX IF NOT EXISTS places_recent_destinations_user_created_at_idx ON places_recent_destinations (user_id, created_at DESC)'
  );
}

module.exports = { initDb };

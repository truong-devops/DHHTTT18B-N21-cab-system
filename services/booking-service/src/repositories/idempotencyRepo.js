const { pool } = require('../db/pool');

function mapRow(row) {
  if (!row) {
    return null;
  }
  return {
    routeKey: row.route_key,
    userId: row.user_id,
    idemKey: row.idem_key,
    requestHash: row.request_hash,
    responseCode: row.response_code,
    responseBody: row.response_body
  };
}

async function reserveIdempotencyKey(client, data) {
  const db = client || pool;
  const insertResult = await db.query(
    `INSERT INTO idempotency_keys (
      route_key,
      user_id,
      idem_key,
      request_hash,
      response_code,
      response_body
    )
    VALUES ($1, $2, $3, $4, NULL, NULL)
    ON CONFLICT (route_key, user_id, idem_key) DO NOTHING
    RETURNING *`,
    [data.routeKey, data.userId, data.idemKey, data.requestHash]
  );

  if (insertResult.rows[0]) {
    return {
      state: 'reserved',
      record: mapRow(insertResult.rows[0])
    };
  }

  const existingResult = await db.query(
    `SELECT *
       FROM idempotency_keys
      WHERE route_key = $1
        AND user_id = $2
        AND idem_key = $3
      LIMIT 1`,
    [data.routeKey, data.userId, data.idemKey]
  );
  const existing = mapRow(existingResult.rows[0]);
  if (!existing) {
    return { state: 'in_progress', record: null };
  }
  if (existing.requestHash !== data.requestHash) {
    return { state: 'conflict', record: existing };
  }
  if (existing.responseBody) {
    return { state: 'replay', record: existing };
  }
  return { state: 'in_progress', record: existing };
}

async function getIdempotencyKey(client, data) {
  const db = client || pool;
  const result = await db.query(
    `SELECT *
       FROM idempotency_keys
      WHERE route_key = $1
        AND user_id = $2
        AND idem_key = $3
      LIMIT 1`,
    [data.routeKey, data.userId, data.idemKey]
  );
  return mapRow(result.rows[0]);
}

async function completeIdempotencyKey(client, data) {
  const db = client || pool;
  await db.query(
    `UPDATE idempotency_keys
        SET response_code = $4,
            response_body = $5,
            updated_at = now()
      WHERE route_key = $1
        AND user_id = $2
        AND idem_key = $3`,
    [data.routeKey, data.userId, data.idemKey, data.responseCode, data.responseBody]
  );
}

module.exports = {
  getIdempotencyKey,
  reserveIdempotencyKey,
  completeIdempotencyKey
};

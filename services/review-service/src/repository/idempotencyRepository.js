const pool = require('../db/pool');

async function getByKey({ routeKey, userId, idempotencyKey }) {
  const result = await pool.query(
    `
      SELECT *
      FROM idempotency_keys
      WHERE route_key = $1
        AND user_id = $2
        AND idem_key = $3
    `,
    [routeKey, userId, idempotencyKey]
  );
  return result.rows[0] || null;
}

async function createKey({ routeKey, userId, idempotencyKey, requestHash }) {
  const result = await pool.query(
    `
      INSERT INTO idempotency_keys (
        route_key,
        user_id,
        idem_key,
        request_hash,
        locked_at
      )
      VALUES ($1, $2, $3, $4, now())
      ON CONFLICT (route_key, user_id, idem_key)
      DO UPDATE SET locked_at = now()
      RETURNING *
    `,
    [routeKey, userId, idempotencyKey, requestHash]
  );
  return result.rows[0];
}

async function setResponse({ routeKey, userId, idempotencyKey, responseStatus, responseHeaders, responseBody }) {
  await pool.query(
    `
      UPDATE idempotency_keys
      SET response_status = $4,
          response_headers = $5,
          response_body = $6,
          locked_at = NULL
      WHERE route_key = $1
        AND user_id = $2
        AND idem_key = $3
    `,
    [routeKey, userId, idempotencyKey, responseStatus, responseHeaders, responseBody]
  );
}

module.exports = {
  getByKey,
  createKey,
  setResponse
};

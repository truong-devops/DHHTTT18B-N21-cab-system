const { pool } = require('./pool');

function mapIdempotencyRow(row) {
  if (!row) {
    return null;
  }
  return {
    routeKey: row.route_key,
    userId: row.user_id,
    idemKey: row.idem_key,
    requestHash: row.request_hash,
    responseCode: row.response_code,
    responseHeaders: row.response_headers || {},
    responseBody: row.response_body,
    createdAt: row.created_at
  };
}

async function getIdempotencyKey(routeKey, userId, idemKey) {
  const result = await pool.query(
    `SELECT *
       FROM idempotency_keys
      WHERE route_key = $1
        AND user_id = $2
        AND idem_key = $3`,
    [routeKey, userId, idemKey]
  );
  return mapIdempotencyRow(result.rows[0]);
}

async function saveIdempotencyKey(client, data) {
  const executor = client || pool;
  await executor.query(
    `INSERT INTO idempotency_keys (
      route_key,
      user_id,
      idem_key,
      request_hash,
      response_code,
      response_headers,
      response_body
    )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (route_key, user_id, idem_key) DO NOTHING`,
    [data.routeKey, data.userId, data.idemKey, data.requestHash, data.responseCode, data.responseHeaders || {}, data.responseBody]
  );
}

module.exports = { getIdempotencyKey, saveIdempotencyKey };

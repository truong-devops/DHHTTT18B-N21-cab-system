const pool = require("../db/pool");

async function getIdempotencyKey(keyHash) {
  const result = await pool.query(
    "SELECT * FROM idempotency_keys WHERE key_hash = $1;",
    [keyHash]
  );
  return result.rows[0] || null;
}

async function insertIdempotencyKey(record) {
  const query = `
    INSERT INTO idempotency_keys (
      key_hash,
      request_hash,
      response_status,
      response_body,
      response_headers,
      expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const values = [
    record.keyHash,
    record.requestHash,
    record.responseStatus,
    record.responseBody,
    record.responseHeaders,
    record.expiresAt,
  ];
  const result = await pool.query(query, values);
  return result.rows[0];
}

module.exports = {
  getIdempotencyKey,
  insertIdempotencyKey,
};

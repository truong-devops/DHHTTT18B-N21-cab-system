const { getPool } = require("../db/pool");

const inMemoryKeys = new Map();

const getIdempotencyRecord = async (idempotencyKey) => {
  const pool = getPool();
  if (!pool) {
    return inMemoryKeys.get(idempotencyKey) || null;
  }

  const result = await pool.query(
    "SELECT id, idempotency_key, request_hash, status_code, trace_id FROM idempotency_keys WHERE idempotency_key = $1",
    [idempotencyKey]
  );
  return result.rows[0] || null;
};

const createIdempotencyRecord = async ({ idempotencyKey, requestHash, traceId }) => {
  const pool = getPool();
  if (!pool) {
    const record = {
      idempotency_key: idempotencyKey,
      request_hash: requestHash,
      status_code: null,
      trace_id: traceId
    };
    inMemoryKeys.set(idempotencyKey, record);
    return record;
  }

  const result = await pool.query(
    `INSERT INTO idempotency_keys (idempotency_key, request_hash, trace_id)
     VALUES ($1, $2, $3)
     RETURNING id, idempotency_key, request_hash, status_code, trace_id`,
    [idempotencyKey, requestHash, traceId]
  );
  return result.rows[0];
};

const updateIdempotencyStatus = async ({ idempotencyKey, statusCode }) => {
  const pool = getPool();
  if (!pool) {
    const record = inMemoryKeys.get(idempotencyKey);
    if (record) {
      record.status_code = statusCode;
      inMemoryKeys.set(idempotencyKey, record);
    }
    return;
  }

  await pool.query(
    "UPDATE idempotency_keys SET status_code = $1, updated_at = NOW() WHERE idempotency_key = $2",
    [statusCode, idempotencyKey]
  );
};

module.exports = {
  getIdempotencyRecord,
  createIdempotencyRecord,
  updateIdempotencyStatus
};

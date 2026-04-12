const { pool } = require('../db/pool');
const { applyCursorQuery } = require('../../../../libs/http/cursor');

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function mapWithdrawalRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    driverUserId: row.driver_user_id,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    note: row.note || null,
    rejectionReason: row.rejection_reason || null,
    requestedAt: toIso(row.requested_at),
    processedAt: toIso(row.processed_at),
    processedBy: row.processed_by || null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

async function insertWithdrawal(client, { driverUserId, amount, currency = 'VND', note = null, status = 'REQUESTED' }) {
  const executor = client || pool;
  const result = await executor.query(
    `
      INSERT INTO driver_withdrawals (
        driver_user_id,
        amount,
        currency,
        status,
        note,
        requested_at
      )
      VALUES ($1, $2, $3, $4, $5, now())
      RETURNING *
    `,
    [driverUserId, amount, currency, status, note]
  );
  return mapWithdrawalRow(result.rows[0]);
}

async function getWithdrawalById(id) {
  const result = await pool.query('SELECT * FROM driver_withdrawals WHERE id = $1', [id]);
  return mapWithdrawalRow(result.rows[0]);
}

async function updateWithdrawalStatus(client, { id, status, rejectionReason = null, processedBy = null }) {
  const executor = client || pool;
  const processedAt = ['APPROVED', 'REJECTED', 'PAID', 'FAILED', 'CANCELED'].includes(status) ? 'now()' : 'NULL';
  const result = await executor.query(
    `
      UPDATE driver_withdrawals
      SET
        status = $2,
        rejection_reason = $3,
        processed_by = $4,
        processed_at = ${processedAt},
        updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [id, status, rejectionReason, processedBy]
  );
  return mapWithdrawalRow(result.rows[0]);
}

async function listWithdrawals({ driverUserId, status, limit = 20, cursor = null, sort = '-requestedAt' }) {
  const builder = { where: [], values: [], orderBy: '', limit: 20 };

  if (driverUserId) {
    builder.values.push(driverUserId);
    builder.where.push(`driver_user_id = $${builder.values.length}`);
  }

  if (status) {
    builder.values.push(status);
    builder.where.push(`status = $${builder.values.length}`);
  }

  const safeLimit = Number(limit) && Number(limit) > 0 ? Number(limit) : 20;
  applyCursorQuery(builder, {
    limit: safeLimit + 1,
    cursor,
    sort: sort === 'requestedAt' ? 'createdAt' : '-createdAt'
  });

  const whereClause = builder.where.length ? `WHERE ${builder.where.join(' AND ')}` : '';
  const orderByClause = builder.orderBy ? `ORDER BY ${builder.orderBy}` : 'ORDER BY requested_at DESC, id DESC';
  builder.values.push(builder.limit);
  const limitIndex = builder.values.length;
  const query = `SELECT * FROM driver_withdrawals ${whereClause} ${orderByClause} LIMIT $${limitIndex}`;
  const result = await pool.query(query, builder.values);
  const rows = result.rows.map(mapWithdrawalRow);
  const hasMore = rows.length > safeLimit;
  const items = hasMore ? rows.slice(0, safeLimit) : rows;
  const last = items[items.length - 1];
  const nextCursor = hasMore && last ? { createdAt: last.createdAt, id: last.id } : null;
  return { items, nextCursor };
}

async function getWithdrawalStats(driverUserId) {
  const result = await pool.query(
    `
      SELECT
        COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END), 0) AS paid_out,
        COALESCE(SUM(CASE WHEN status IN ('REQUESTED', 'APPROVED') THEN amount ELSE 0 END), 0) AS pending_out
      FROM driver_withdrawals
      WHERE driver_user_id = $1
    `,
    [driverUserId]
  );
  const row = result.rows[0] || {};
  return {
    paidOut: Number(row.paid_out || 0),
    pendingOut: Number(row.pending_out || 0)
  };
}

module.exports = {
  insertWithdrawal,
  getWithdrawalById,
  updateWithdrawalStatus,
  listWithdrawals,
  getWithdrawalStats,
  mapWithdrawalRow
};

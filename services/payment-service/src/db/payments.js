const { pool } = require('./pool');
const { applyCursorQuery } = require('../../../../libs/http/cursor');

function toIso(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

function mapPaymentRow(row) {
  if (!row) {
    return null;
  }
  const payment = {
    id: row.id,
    rideId: row.ride_id,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    statusUpdatedAt: toIso(row.status_updated_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };

  if (row.user_id != null) {
    payment.userId = row.user_id;
  }

  if (row.method != null) {
    payment.method = row.method;
  }

  if (row.failure_reason != null) {
    payment.failureReason = row.failure_reason;
  }

  if (row.vietqr_payload != null) {
    payment.vietqr = {
      payload: row.vietqr_payload,
      qrUrl: row.vietqr_qr_url,
      reference: row.vietqr_reference,
      expiresAt: toIso(row.vietqr_expires_at)
    };
  }

  if (row.payos_order_code != null) {
    payment.payos = {
      orderCode: row.payos_order_code,
      paymentLinkId: row.payos_payment_link_id,
      checkoutUrl: row.payos_checkout_url,
      qrCode: row.payos_qr_code
    };
  }

  return payment;
}

async function insertPayment(client, payment) {
  const executor = client || pool;
  const result = await executor.query(
    `INSERT INTO payments (
      ride_id,
      user_id,
      amount,
      currency,
      method,
      status,
      status_updated_at,
      failure_reason,
      vietqr_payload,
      vietqr_reference,
      vietqr_expires_at,
      vietqr_qr_url,
      payos_order_code,
      payos_payment_link_id,
      payos_checkout_url,
      payos_qr_code
    )
     VALUES ($1, $2, $3, $4, $5, $6, now(), $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING *`,
    [
      payment.rideId,
      payment.userId,
      payment.amount,
      payment.currency,
      payment.method,
      payment.status,
      payment.failureReason || null,
      payment.vietqrPayload || null,
      payment.vietqrReference || null,
      payment.vietqrExpiresAt || null,
      payment.vietqrQrUrl || null,
      payment.payosOrderCode || null,
      payment.payosPaymentLinkId || null,
      payment.payosCheckoutUrl || null,
      payment.payosQrCode || null
    ]
  );
  return mapPaymentRow(result.rows[0]);
}

async function insertStatusHistory(client, data) {
  const executor = client || pool;
  await executor.query(
    `INSERT INTO payment_status_history (
      payment_id,
      from_status,
      to_status,
      reason,
      actor_id,
      occurred_at,
      trace_id
    )
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, now()), $7)`,
    [data.paymentId, data.fromStatus || null, data.toStatus, data.reason || null, data.actorId || null, data.occurredAt || null, data.traceId || null]
  );
}

async function getPaymentById(id) {
  const result = await pool.query('SELECT * FROM payments WHERE id = $1', [id]);
  return mapPaymentRow(result.rows[0]);
}

async function getPaymentByPayosOrderCode(orderCode) {
  const result = await pool.query('SELECT * FROM payments WHERE payos_order_code = $1', [orderCode]);
  return mapPaymentRow(result.rows[0]);
}

async function updatePaymentStatus(client, paymentId, status, failureReason) {
  const executor = client || pool;
  const result = await executor.query(
    `UPDATE payments
       SET status = $2,
           status_updated_at = now(),
           failure_reason = COALESCE($3, failure_reason),
           updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [paymentId, status, failureReason || null]
  );
  return mapPaymentRow(result.rows[0]);
}

async function listPayments({ limit, cursor, sort, status, rideId }) {
  const builder = { where: [], values: [], orderBy: '', limit: 20 };

  if (status) {
    builder.values.push(status);
    builder.where.push(`status = $${builder.values.length}`);
  }

  if (rideId) {
    builder.values.push(rideId);
    builder.where.push(`ride_id = $${builder.values.length}`);
  }

  const safeLimit = Number(limit) && Number(limit) > 0 ? Number(limit) : 20;
  applyCursorQuery(builder, {
    limit: safeLimit + 1,
    cursor,
    sort
  });

  const whereClause = builder.where.length ? `WHERE ${builder.where.join(' AND ')}` : '';
  const orderByClause = builder.orderBy ? `ORDER BY ${builder.orderBy}` : 'ORDER BY created_at DESC, id DESC';
  builder.values.push(builder.limit);
  const limitIndex = builder.values.length;
  const query = `SELECT * FROM payments ${whereClause} ${orderByClause} LIMIT $${limitIndex}`;

  const result = await pool.query(query, builder.values);
  const rows = result.rows.map(mapPaymentRow);

  const hasMore = rows.length > safeLimit;
  const items = hasMore ? rows.slice(0, safeLimit) : rows;
  const last = items[items.length - 1];
  const nextCursor = hasMore && last ? { createdAt: last.createdAt, id: last.id } : null;

  return { items, nextCursor };
}

async function listPendingPayosPayments(limit = 20) {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 20;
  const result = await pool.query(
    `SELECT *
       FROM payments
      WHERE method = 'PAYOS'
        AND status IN ('INITIATED', 'PROCESSING')
        AND (payos_order_code IS NOT NULL OR payos_payment_link_id IS NOT NULL)
      ORDER BY created_at DESC, id DESC
      LIMIT $1`,
    [safeLimit]
  );
  return result.rows.map(mapPaymentRow);
}

module.exports = {
  insertPayment,
  insertStatusHistory,
  getPaymentById,
  getPaymentByPayosOrderCode,
  updatePaymentStatus,
  listPayments,
  listPendingPayosPayments,
  mapPaymentRow
};

const { pool } = require('../db/pool');
const { insertWithdrawal, getWithdrawalById, updateWithdrawalStatus, listWithdrawals, getWithdrawalStats } = require('../repositories/withdrawalsRepo');
const { ApiError } = require('../utils/errors');
const { encodeCursor, decodeCursor } = require('../../../../libs/http/cursor');
const config = require('../config');

const WITHDRAWAL_STATUS = {
  REQUESTED: 'REQUESTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PAID: 'PAID',
  FAILED: 'FAILED',
  CANCELED: 'CANCELED'
};

const TRANSITIONS = {
  REQUESTED: [WITHDRAWAL_STATUS.APPROVED, WITHDRAWAL_STATUS.REJECTED, WITHDRAWAL_STATUS.CANCELED],
  APPROVED: [WITHDRAWAL_STATUS.PAID, WITHDRAWAL_STATUS.FAILED, WITHDRAWAL_STATUS.CANCELED]
};

function normalizeStatus(value) {
  return value ? String(value).trim().toUpperCase() : null;
}

async function fetchCompletedRideIdsForDriver({ driverUserId, authorization, traceId, requestId }) {
  const baseUrl = String(config.services?.ride || '').replace(/\/+$/, '');
  if (!baseUrl || !driverUserId) return [];

  const rideIds = new Set();
  let cursor = null;
  let pages = 0;

  while (pages < 10) {
    const url = new URL('/v1/rides', baseUrl);
    url.searchParams.set('status', 'completed');
    url.searchParams.set('driverId', driverUserId);
    url.searchParams.set('limit', '100');
    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(authorization ? { Authorization: authorization } : {}),
          ...(traceId ? { 'x-trace-id': traceId } : {}),
          ...(requestId ? { 'x-request-id': requestId } : {})
        },
        signal: controller.signal
      });
      if (!response.ok) break;
      const payload = await response.json();
      const data = Array.isArray(payload?.data) ? payload.data : [];
      data.forEach((item) => {
        if (item?.id) rideIds.add(item.id);
      });
      const nextCursor = payload?.nextCursor || null;
      pages += 1;
      if (!nextCursor) break;
      cursor = nextCursor;
    } catch (_error) {
      break;
    } finally {
      clearTimeout(timeout);
    }
  }

  return Array.from(rideIds);
}

async function sumPaidEarningsByRideIds(rideIds) {
  if (!Array.isArray(rideIds) || !rideIds.length) {
    return 0;
  }
  const result = await pool.query(
    `
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM payments
      WHERE ride_id = ANY($1::text[])
        AND status = 'PAID'
    `,
    [rideIds]
  );
  return Number(result.rows?.[0]?.total || 0);
}

async function getDriverWalletSummary({ driverUserId, authorization, traceId, requestId }) {
  if (!driverUserId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Unauthorized');
  }

  const rideIds = await fetchCompletedRideIdsForDriver({
    driverUserId,
    authorization,
    traceId,
    requestId
  });
  const earningsTotal = await sumPaidEarningsByRideIds(rideIds);
  const stats = await getWithdrawalStats(driverUserId);
  const availableBalance = Math.max(0, earningsTotal - stats.paidOut - stats.pendingOut);

  return {
    driverUserId,
    completedRides: rideIds.length,
    earningsTotal: Number(earningsTotal.toFixed(2)),
    paidOutTotal: Number(stats.paidOut.toFixed(2)),
    pendingWithdrawal: Number(stats.pendingOut.toFixed(2)),
    availableBalance: Number(availableBalance.toFixed(2)),
    currency: 'VND'
  };
}

async function createWithdrawalRequest({ driverUserId, amount, note, authorization, traceId, requestId }) {
  const wallet = await getDriverWalletSummary({
    driverUserId,
    authorization,
    traceId,
    requestId
  });

  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'amount must be greater than zero');
  }
  if (normalizedAmount > wallet.availableBalance) {
    throw new ApiError(400, 'INSUFFICIENT_BALANCE', 'Insufficient available balance');
  }

  const withdrawal = await insertWithdrawal(null, {
    driverUserId,
    amount: normalizedAmount.toFixed(2),
    currency: wallet.currency,
    note: note || null,
    status: WITHDRAWAL_STATUS.REQUESTED
  });

  return {
    withdrawal,
    wallet
  };
}

async function fetchWithdrawals({ actor, query }) {
  const roleSet = new Set(Array.isArray(actor?.roles) ? actor.roles : []);
  const canViewAll = roleSet.has('admin') || roleSet.has('ops');

  const targetDriverUserId = canViewAll ? query.driverUserId || null : actor?.id;
  if (!targetDriverUserId) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'driverUserId is required');
  }

  const parsedCursor = query.cursor ? decodeCursor(query.cursor) : null;
  const status = normalizeStatus(query.status);
  const result = await listWithdrawals({
    driverUserId: targetDriverUserId,
    status,
    limit: query.limit,
    cursor: parsedCursor,
    sort: query.sort
  });
  return {
    data: result.items,
    nextCursor: result.nextCursor ? encodeCursor(result.nextCursor) : null
  };
}

async function changeWithdrawalStatus({ id, status, rejectionReason, actorId }) {
  const targetStatus = normalizeStatus(status);
  if (!targetStatus || !Object.values(WITHDRAWAL_STATUS).includes(targetStatus)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid withdrawal status');
  }

  const current = await getWithdrawalById(id);
  if (!current) {
    throw new ApiError(404, 'NOT_FOUND', 'Withdrawal not found');
  }

  const fromStatus = normalizeStatus(current.status);
  if (fromStatus === targetStatus) {
    return current;
  }

  const allowed = TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(targetStatus)) {
    throw new ApiError(409, 'INVALID_STATE_TRANSITION', `Cannot transition from ${fromStatus} to ${targetStatus}`);
  }

  if ((targetStatus === WITHDRAWAL_STATUS.REJECTED || targetStatus === WITHDRAWAL_STATUS.FAILED) && !String(rejectionReason || '').trim()) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'rejectionReason is required');
  }

  const updated = await updateWithdrawalStatus(null, {
    id,
    status: targetStatus,
    rejectionReason: targetStatus === WITHDRAWAL_STATUS.REJECTED || targetStatus === WITHDRAWAL_STATUS.FAILED ? String(rejectionReason).trim() : null,
    processedBy: actorId || null
  });
  return updated;
}

module.exports = {
  WITHDRAWAL_STATUS,
  normalizeStatus,
  getDriverWalletSummary,
  createWithdrawalRequest,
  fetchWithdrawals,
  changeWithdrawalStatus
};

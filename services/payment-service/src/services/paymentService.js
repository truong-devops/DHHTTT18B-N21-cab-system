const { withTransaction } = require('../db/pool');
const {
  insertPayment,
  insertStatusHistory,
  getPaymentById,
  getLatestPaymentByRideIdForUpdate,
  updatePaymentStatus,
  listPayments
} = require('../repositories/paymentsRepo');
const { saveIdempotencyKey } = require('../repositories/idempotencyRepo');
const { insertOutboxEvent } = require('../repositories/outboxRepo');
const { encodeCursor, decodeCursor } = require('../../../../libs/http/cursor');
const { hashRequest } = require('../utils/idempotency');
const { ApiError } = require('../utils/errors');
const { STATUSES, canTransition } = require('../domain/paymentStatus');
const { buildPaymentCompleted, buildPaymentFailed } = require('../messaging/events');
const { generateVietQr } = require('./vietqrService');
const { createPayosPaymentLink } = require('./payosService');
const { generateVietQrCode } = require('../integrations/vietqrClient');
const config = require('../config');
const { withTrace } = require('../utils/logger');
const { isEightDigitId } = require('../utils/validation');
const monitoring = require('../monitoring');

const RECENT_RIDE_CACHE_TTL_MS = Math.max(1000, Number(process.env.PAYMENTS_RECENT_RIDE_CACHE_TTL_MS || 300000));
const RECENT_RIDE_CACHE_MAX_ITEMS = Math.max(1, Number(process.env.PAYMENTS_RECENT_RIDE_CACHE_MAX_ITEMS || 20));
const recentPaymentsByRide = new Map();

function setRecentRidePayment(payment) {
  const rideId = payment?.rideId;
  if (!rideId) {
    return;
  }

  const now = Date.now();
  const existing = recentPaymentsByRide.get(rideId);
  const currentItems = Array.isArray(existing?.items) ? existing.items : [];
  const withoutCurrent = currentItems.filter((item) => item?.id !== payment.id);
  const nextItems = [payment, ...withoutCurrent].slice(0, RECENT_RIDE_CACHE_MAX_ITEMS);
  recentPaymentsByRide.set(rideId, {
    items: nextItems,
    expiresAt: now + RECENT_RIDE_CACHE_TTL_MS
  });
}

function getRecentRidePayments(rideId, limit) {
  if (!rideId) {
    return null;
  }
  const entry = recentPaymentsByRide.get(rideId);
  if (!entry) {
    return null;
  }
  if (!Number.isFinite(entry.expiresAt) || entry.expiresAt <= Date.now()) {
    recentPaymentsByRide.delete(rideId);
    return null;
  }
  const safeLimit = Number(limit) > 0 ? Number(limit) : RECENT_RIDE_CACHE_MAX_ITEMS;
  return entry.items.slice(0, safeLimit);
}

function normalizeActorId(value) {
  if (!isEightDigitId(value)) {
    return null;
  }
  return String(value).trim();
}

function normalizeSagaReason(value, fallback) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return fallback;
  }
  return normalized.slice(0, 255);
}

function resolveCompensationActorId(actor) {
  if (isEightDigitId(actor)) {
    return String(actor).trim();
  }
  return '10000000';
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function compensateBookingForPaymentFailure({ payment, traceId, requestId, actor }) {
  const sagaConfig = config.saga?.bookingCompensationOnPaymentFailed || {};
  if (!sagaConfig.enabled) {
    return { attempted: false, ok: true, skipped: 'disabled' };
  }

  const rideId = String(payment?.rideId || '').trim();
  const baseUrl = String(config.services?.booking || '').replace(/\/+$/, '');
  const path = String(sagaConfig.path || '/v1/bookings/internal/payment-failed-compensation').trim();
  if (!rideId || !baseUrl || !path) {
    return { attempted: false, ok: false, skipped: 'missing_config_or_ride' };
  }

  const actorId = resolveCompensationActorId(actor);
  const maxAttempts = Math.max(1, Number(sagaConfig.maxAttempts || 1));
  const timeoutMs = Math.max(300, Number(sagaConfig.timeoutMs || 2500));
  const retryBackoffMs = Math.max(0, Number(sagaConfig.retryBackoffMs || 200));

  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const payload = {
    rideId,
    paymentId: payment.id,
    reason: normalizeSagaReason(payment.failureReason, 'PAYMENT_FAILED')
  };

  let lastStatus = 0;
  let lastBody = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': String(config.internalApiKey || ''),
          'x-user-id': actorId,
          'x-user-role': 'service',
          'x-user-roles': 'service',
          ...(traceId ? { 'x-trace-id': traceId } : {}),
          ...(requestId ? { 'x-request-id': requestId } : {})
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeout);

      lastStatus = response.status;
      lastBody = await response.text();
      if (response.ok) {
        return {
          attempted: true,
          ok: true,
          status: response.status,
          body: lastBody
        };
      }

      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      if (!retryable || attempt >= maxAttempts) {
        break;
      }
      if (retryBackoffMs > 0) {
        await sleep(retryBackoffMs);
      }
    } catch (error) {
      clearTimeout(timeout);
      lastStatus = 0;
      lastBody = error?.message || 'compensation_request_failed';
      if (attempt >= maxAttempts) {
        break;
      }
      if (retryBackoffMs > 0) {
        await sleep(retryBackoffMs);
      }
    }
  }

  return {
    attempted: true,
    ok: false,
    status: lastStatus,
    body: lastBody
  };
}

async function resolvePayosQrCode({ payosData, traceId, requestId, authorization }) {
  if (!payosData || !payosData.qrCode) {
    return payosData;
  }
  if (config.payos.qrSource !== 'VIETQR') {
    return payosData;
  }

  const bankBin = payosData.bankBin;
  const accountNumber = payosData.accountNumber;
  const accountName = payosData.accountName;
  const addInfo = payosData.description || String(payosData.orderCode || '');
  const amount = Number(payosData.amount);
  if (!bankBin || !accountNumber || !accountName || !addInfo || !Number.isFinite(amount)) {
    return payosData;
  }

  try {
    const vietqr = await generateVietQrCode({
      apiUrl: config.vietqr.apiUrl,
      bankBin,
      accountNumber,
      accountName,
      amount,
      addInfo,
      format: config.vietqr.format,
      headers: {
        authorization,
        traceId,
        requestId,
        clientId: config.vietqr.clientId,
        apiKey: config.vietqr.apiKey
      }
    });
    return {
      ...payosData,
      qrCode: vietqr.qrDataUrl || vietqr.qrCode || payosData.qrCode
    };
  } catch (err) {
    withTrace(traceId, requestId).warn({ err, orderCode: payosData.orderCode }, 'Fallback to PayOS QR due to VietQR generation error');
    return payosData;
  }
}

async function createPayment({ payload, idempotency, traceId, requestId, method, path, authorization }) {
  const requestHash = idempotency ? idempotency.requestHash || hashRequest(method, path, payload) : null;
  const paymentMethod = payload.method || '';
  const rawPayosData =
    paymentMethod === 'PAYOS'
      ? await createPayosPaymentLink({
          amount: payload.amount,
          currency: payload.currency,
          note: payload.note,
          rideId: payload.rideId
        })
      : null;
  const payosData =
    paymentMethod === 'PAYOS'
      ? await resolvePayosQrCode({
          payosData: rawPayosData,
          traceId,
          requestId,
          authorization
        })
      : null;
  const vietqrData =
    paymentMethod === 'VIETQR'
      ? await generateVietQr({
          amount: payload.amount,
          currency: payload.currency,
          note: payload.note || payload.rideId,
          traceId,
          requestId,
          authorization
        })
      : null;

  return withTransaction(async (client) => {
    const payment = await insertPayment(client, {
      ...payload,
      status: payosData ? STATUSES.PROCESSING : STATUSES.INITIATED,
      vietqrPayload: vietqrData ? vietqrData.qrCode : null,
      vietqrReference: vietqrData ? vietqrData.reference : null,
      vietqrExpiresAt: vietqrData ? vietqrData.expiresAt : null,
      vietqrQrUrl: vietqrData ? vietqrData.qrDataUrl : null,
      payosOrderCode: payosData ? payosData.orderCode : null,
      payosPaymentLinkId: payosData ? payosData.paymentLinkId : null,
      payosCheckoutUrl: payosData ? payosData.checkoutUrl : null,
      payosQrCode: payosData ? payosData.qrCode : null
    });
    await insertStatusHistory(client, {
      paymentId: payment.id,
      fromStatus: null,
      toStatus: payment.status,
      reason: null,
      actorId: normalizeActorId(payment.userId),
      traceId
    });

    const responseBody = { data: payment };
    setRecentRidePayment(payment);
    monitoring.recordPaymentStatus(payment.status, 'success', {
      method: String(payment.method || payload.method || 'unknown').toLowerCase()
    });

    if (idempotency) {
      await saveIdempotencyKey(client, {
        routeKey: idempotency.routeKey,
        userId: idempotency.userId,
        idemKey: idempotency.idemKey,
        requestHash,
        responseCode: 201,
        responseHeaders: idempotency.responseHeaders,
        responseBody
      });
    }

    return { responseCode: 201, responseBody };
  });
}

async function fetchPayment(paymentId) {
  const payment = await getPaymentById(paymentId);
  if (!payment) {
    throw new ApiError(404, 'NOT_FOUND', 'Payment not found');
  }
  return payment;
}

async function fetchPayments(parsedQuery) {
  const limit = parsedQuery.limit ? Number(parsedQuery.limit) : 20;
  if (parsedQuery.rideId && !parsedQuery.cursor) {
    const cached = getRecentRidePayments(parsedQuery.rideId, limit);
    if (cached) {
      return { data: cached };
    }
  }
  const cursor = parsedQuery.cursor ? decodeCursor(parsedQuery.cursor) : null;
  const result = await listPayments({
    limit,
    cursor,
    sort: parsedQuery.sort,
    status: parsedQuery.status,
    rideId: parsedQuery.rideId
  });
  const nextCursor = result.nextCursor ? encodeCursor(result.nextCursor) : null;
  const response = { data: result.items };
  if (nextCursor) {
    response.nextCursor = nextCursor;
  }
  return response;
}

async function changePaymentStatus({ paymentId, statusUpdate, traceId, requestId, actor }) {
  const { status, failureReason } = statusUpdate;
  const payment = await fetchPayment(paymentId);

  const trace = traceId || 'no-trace';
  const actorLabel = actor || 'system';
  const log = withTrace(trace, requestId);
  log.info(
    {
      paymentId: payment.id,
      fromStatus: payment.status,
      toStatus: status,
      actor: actorLabel,
      reason: failureReason || null
    },
    'Payment status transition'
  );

  if (!canTransition(payment.status, status)) {
    monitoring.recordPaymentStatus(status, 'error', {
      reason: 'invalid_transition',
      from_status: String(payment.status || 'unknown').toLowerCase()
    });
    throw new ApiError(409, 'INVALID_STATE_TRANSITION', `Cannot transition from ${payment.status} to ${status}`);
  }

  if (payment.status === status) {
    if (status === STATUSES.FAILED) {
      const compensation = await compensateBookingForPaymentFailure({
        payment,
        traceId,
        requestId,
        actor
      });
      if (!compensation.ok) {
        log.warn(
          {
            paymentId: payment.id,
            rideId: payment.rideId,
            compensationStatus: compensation.status || 0,
            compensationBody: compensation.body || null
          },
          'Booking compensation call failed after repeated FAILED status'
        );
      }
    }
    return payment;
  }

  const updated = await withTransaction(async (client) => {
    const updated = await updatePaymentStatus(client, paymentId, status, failureReason);
    await insertStatusHistory(client, {
      paymentId,
      fromStatus: payment.status,
      toStatus: status,
      reason: failureReason,
      actorId: normalizeActorId(actor),
      traceId
    });

    if (status === STATUSES.PAID) {
      const { topic, envelope } = buildPaymentCompleted(updated, traceId);
      await insertOutboxEvent(client, {
        eventId: envelope.eventId,
        traceId,
        requestId,
        type: envelope.type,
        topic,
        payload: envelope.payload,
        occurredAt: envelope.occurredAt
      });
    }

    if (status === STATUSES.FAILED) {
      const { topic, envelope } = buildPaymentFailed(updated, traceId);
      await insertOutboxEvent(client, {
        eventId: envelope.eventId,
        traceId,
        requestId,
        type: envelope.type,
        topic,
        payload: envelope.payload,
        occurredAt: envelope.occurredAt
      });
    }

    monitoring.recordPaymentStatus(status, 'success', {
      from_status: String(payment.status || 'unknown').toLowerCase()
    });
    setRecentRidePayment(updated);

    return updated;
  });

  if (status === STATUSES.FAILED) {
    const compensation = await compensateBookingForPaymentFailure({
      payment: updated,
      traceId,
      requestId,
      actor
    });
    if (!compensation.ok) {
      log.warn(
        {
          paymentId: updated.id,
          rideId: updated.rideId,
          compensationStatus: compensation.status || 0,
          compensationBody: compensation.body || null
        },
        'Booking compensation call failed for payment FAILED transition'
      );
    }
  }

  return updated;
}

async function compensatePaymentForRideCancelled({ rideId, reason, traceId, requestId }) {
  const normalizedRideId = String(rideId || '').trim();
  if (!normalizedRideId) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'rideId is required for compensation');
  }

  const log = withTrace(traceId || 'no-trace', requestId || null);
  const compensationReason = normalizeSagaReason(reason, 'RIDE_CANCELLED');

  return withTransaction(async (client) => {
    const payment = await getLatestPaymentByRideIdForUpdate(client, normalizedRideId);
    if (!payment) {
      log.info({ rideId: normalizedRideId }, 'Saga compensation skipped: payment not found');
      return {
        handled: false,
        reason: 'payment_not_found',
        rideId: normalizedRideId
      };
    }

    const currentStatus = String(payment.status || '').toUpperCase();
    let targetStatus = null;
    let updateFailureReason = null;

    if (currentStatus === STATUSES.PAID) {
      targetStatus = STATUSES.REFUNDED;
    } else if (currentStatus === STATUSES.INITIATED || currentStatus === STATUSES.PROCESSING) {
      targetStatus = STATUSES.FAILED;
      updateFailureReason = compensationReason;
    } else if (currentStatus === STATUSES.FAILED || currentStatus === STATUSES.REFUNDED) {
      return {
        handled: false,
        reason: 'already_terminal',
        paymentId: payment.id,
        status: currentStatus
      };
    } else {
      return {
        handled: false,
        reason: 'unsupported_status',
        paymentId: payment.id,
        status: currentStatus
      };
    }

    if (!canTransition(currentStatus, targetStatus)) {
      return {
        handled: false,
        reason: 'invalid_transition',
        paymentId: payment.id,
        fromStatus: currentStatus,
        toStatus: targetStatus
      };
    }

    const updated = await updatePaymentStatus(client, payment.id, targetStatus, updateFailureReason);
    await insertStatusHistory(client, {
      paymentId: payment.id,
      fromStatus: currentStatus,
      toStatus: targetStatus,
      reason: compensationReason,
      actorId: null,
      traceId
    });

    if (targetStatus === STATUSES.FAILED) {
      const { topic, envelope } = buildPaymentFailed(updated, traceId);
      await insertOutboxEvent(client, {
        eventId: envelope.eventId,
        traceId,
        requestId,
        type: envelope.type,
        topic,
        payload: envelope.payload,
        occurredAt: envelope.occurredAt
      });
    }

    monitoring.recordPaymentStatus(targetStatus, 'success', {
      reason: 'ride_cancelled_compensation',
      from_status: currentStatus.toLowerCase()
    });

    return {
      handled: true,
      reason: targetStatus === STATUSES.REFUNDED ? 'refunded' : 'marked_failed',
      paymentId: updated.id,
      rideId: normalizedRideId,
      fromStatus: currentStatus,
      toStatus: targetStatus
    };
  });
}

async function fetchVietQr(paymentId) {
  const payment = await fetchPayment(paymentId);
  if (!payment.vietqr) {
    throw new ApiError(409, 'CONFLICT', 'VietQR data is not available for this payment');
  }
  return {
    paymentId: payment.id,
    rideId: payment.rideId,
    amount: payment.amount,
    currency: payment.currency,
    vietqr: payment.vietqr
  };
}

module.exports = {
  createPayment,
  fetchPayment,
  fetchPayments,
  changePaymentStatus,
  compensatePaymentForRideCancelled,
  fetchVietQr
};

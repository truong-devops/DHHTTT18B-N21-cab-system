const config = require("../config");
const { getPaymentRequest } = require("../integrations/payosClient");
const { listPendingPayosPayments } = require("../repositories/paymentsRepo");
const { changePaymentStatus } = require("./paymentService");
const { STATUSES } = require("../domain/paymentStatus");
const { logger, withTrace } = require("../utils/logger");

function hasPollingCredentials() {
  return Boolean(config.payos.clientId && config.payos.apiKey);
}

function normalizePayosStatus(value) {
  if (value == null) {
    return "";
  }
  return String(value).trim().toUpperCase();
}

function mapPayosStatus({ status, code, desc }) {
  const normalized = normalizePayosStatus(status);
  if (!normalized || normalized === "PENDING" || normalized === "PROCESSING") {
    return null;
  }

  if (normalized === "PAID") {
    return { status: STATUSES.PAID };
  }

  if (normalized === "CANCELLED") {
    return {
      status: STATUSES.FAILED,
      failureReason: desc || code || "PAYOS_CANCELLED"
    };
  }

  if (normalized === "EXPIRED") {
    return {
      status: STATUSES.FAILED,
      failureReason: desc || code || "PAYOS_EXPIRED"
    };
  }

  if (normalized === "FAILED") {
    return {
      status: STATUSES.FAILED,
      failureReason: desc || code || "PAYOS_FAILED"
    };
  }

  return null;
}

async function fetchPayosRequestData(payment) {
  const payos = payment && payment.payos ? payment.payos : null;
  const orderCode = payos && payos.orderCode ? payos.orderCode : null;
  const paymentLinkId = payos && payos.paymentLinkId ? payos.paymentLinkId : null;

  if (!orderCode && !paymentLinkId) {
    return null;
  }

  if (orderCode) {
    try {
      return await getPaymentRequest(orderCode);
    } catch (err) {
      if (!paymentLinkId || String(paymentLinkId) === String(orderCode)) {
        throw err;
      }
    }
  }

  return getPaymentRequest(paymentLinkId);
}

async function syncPayosPayment(payment) {
  const traceId = `payos-sync-${payment.id}`;
  const requestId =
    (payment.payos && payment.payos.paymentLinkId) ||
    (payment.payos && payment.payos.orderCode ? String(payment.payos.orderCode) : null);
  const log = withTrace(traceId, requestId);

  const remote = await fetchPayosRequestData(payment);
  if (!remote) {
    log.warn({ paymentId: payment.id }, "PayOS sync skipped due to missing identifier");
    return { handled: false, reason: "missing_identifier" };
  }

  const mapped = mapPayosStatus({
    status: remote.status,
    code: remote.code,
    desc: remote.desc
  });
  if (!mapped) {
    return { handled: false, reason: "non_terminal" };
  }

  try {
    const updated = await changePaymentStatus({
      paymentId: payment.id,
      statusUpdate:
        mapped.status === STATUSES.FAILED
          ? { status: mapped.status, failureReason: mapped.failureReason }
          : { status: mapped.status },
      traceId,
      requestId,
      actor: "payos-sync"
    });
    log.info(
      {
        paymentId: updated.id,
        fromStatus: payment.status,
        toStatus: updated.status
      },
      "PayOS payment status synchronized"
    );
    return { handled: true, payment: updated };
  } catch (err) {
    if (err && err.code === "INVALID_STATE_TRANSITION") {
      log.warn(
        { paymentId: payment.id, targetStatus: mapped.status },
        "PayOS sync ignored due to state transition"
      );
      return { handled: false, reason: "state_transition" };
    }
    throw err;
  }
}

async function syncPayosPaymentsBatch() {
  if (!config.payos.autoSyncEnabled) {
    return { skipped: true, reason: "disabled" };
  }
  if (!hasPollingCredentials()) {
    return { skipped: true, reason: "config_missing" };
  }

  const batchSize = Number(config.payos.autoSyncBatchSize);
  const safeBatchSize = Number.isInteger(batchSize) && batchSize > 0 ? batchSize : 20;
  const pending = await listPendingPayosPayments(safeBatchSize);
  if (!pending.length) {
    return { skipped: false, processed: 0, synced: 0 };
  }

  let synced = 0;
  for (const payment of pending) {
    try {
      const result = await syncPayosPayment(payment);
      if (result && result.handled) {
        synced += 1;
      }
    } catch (err) {
      const traceId = `payos-sync-${payment.id}`;
      withTrace(traceId).error(
        { err, paymentId: payment.id },
        "PayOS sync failed for payment"
      );
    }
  }

  return { skipped: false, processed: pending.length, synced };
}

function startPayosAutoSync() {
  if (!config.payos.autoSyncEnabled) {
    logger.info("PayOS auto sync disabled");
    return null;
  }
  if (!hasPollingCredentials()) {
    logger.info("PayOS auto sync skipped due to missing credentials");
    return null;
  }

  const intervalMs = Number(config.payos.autoSyncIntervalMs);
  const safeIntervalMs = Number.isFinite(intervalMs) && intervalMs >= 1000 ? intervalMs : 15000;
  let running = false;

  const run = async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      await syncPayosPaymentsBatch();
    } catch (err) {
      logger.error({ err }, "PayOS auto sync batch failed");
    } finally {
      running = false;
    }
  };

  run().catch((err) => {
    logger.error({ err }, "PayOS auto sync initial run failed");
  });

  const timer = setInterval(() => {
    run().catch((err) => {
      logger.error({ err }, "PayOS auto sync run failed");
    });
  }, safeIntervalMs);

  return () => clearInterval(timer);
}

module.exports = {
  mapPayosStatus,
  syncPayosPayment,
  syncPayosPaymentsBatch,
  startPayosAutoSync
};

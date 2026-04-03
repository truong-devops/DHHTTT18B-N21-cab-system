const notificationRepository = require("../repository/notificationRepository");
const { getProvider } = require("../providers");
const { deriveOverallStatus } = require("../services/notificationService");
const logger = require("../utils/logger");
const monitoring = require("../monitoring");

const DISPATCH_INTERVAL_MS = Number(
  process.env.NOTIFICATION_DISPATCH_INTERVAL_MS || 1000
);
const DISPATCH_BATCH_SIZE = Number(
  process.env.NOTIFICATION_DISPATCH_BATCH_SIZE || 10
);
const MAX_ATTEMPTS = Number(
  process.env.NOTIFICATION_MAX_ATTEMPTS || 5
);
const BASE_BACKOFF_MS = Number(
  process.env.NOTIFICATION_RETRY_BASE_MS || 1000
);

const state = {
  running: false,
  lastTickAt: null,
  lastError: null
};

function computeBackoff(attempts) {
  const exponent = Math.max(attempts - 1, 0);
  return BASE_BACKOFF_MS * Math.pow(2, exponent);
}

function canAttemptChannel(channelStatus, now) {
  if (!channelStatus) {
    return false;
  }
  if (channelStatus.blocked) {
    return false;
  }
  if (![
    "PENDING",
    "FAILED"
  ].includes(channelStatus.status)) {
    return false;
  }
  if (channelStatus.attempts >= MAX_ATTEMPTS) {
    return false;
  }
  if (
    channelStatus.nextAttemptAt &&
    channelStatus.nextAttemptAt > now
  ) {
    return false;
  }
  return true;
}

function missingRecipient(channel, recipient) {
  if (channel === "IN_APP") {
    return false;
  }
  if (channel === "EMAIL") {
    return !recipient?.email;
  }
  if (channel === "SMS") {
    return !recipient?.phone;
  }
  if (channel === "PUSH") {
    return !(recipient?.pushTokens || []).length;
  }
  return true;
}

async function updateOverallStatus(doc) {
  if (!doc) {
    return;
  }
  const overall = deriveOverallStatus(
    doc.perChannelStatus,
    doc.scheduledAt ? new Date(doc.scheduledAt) : null,
    new Date()
  );
  if (overall !== doc.status) {
    await notificationRepository.updateNotificationById(doc.id, {
      $set: { status: overall, updatedAt: new Date() }
    });
  }
}

async function handleChannel(notification, channel) {
  const now = new Date();
  const channelStatus =
    notification.perChannelStatus?.[channel];

  if (!canAttemptChannel(channelStatus, now)) {
    return;
  }

  const claimed = await notificationRepository.claimChannel(
    notification.id,
    channel,
    MAX_ATTEMPTS,
    now
  );

  if (!claimed) {
    return;
  }

  const recipient = claimed.recipient || {};
  if (missingRecipient(channel, recipient)) {
    monitoring.recordNotificationSend(channel, "error", {
      reason: "missing_recipient"
    });
    const updated = await notificationRepository.updateChannelResult(
      claimed.id,
      channel,
      {
        status: "FAILED",
        processing: false,
        lastError: "MISSING_RECIPIENT",
        nextAttemptAt: null,
        blocked: true,
        attempts: MAX_ATTEMPTS
      }
    );
    await updateOverallStatus(updated);
    return;
  }

  const provider = getProvider(channel);
  if (!provider) {
    monitoring.recordNotificationSend(channel, "error", {
      reason: "provider_not_configured"
    });
    const updated = await notificationRepository.updateChannelResult(
      claimed.id,
      channel,
      {
        status: "FAILED",
        processing: false,
        lastError: "PROVIDER_NOT_CONFIGURED",
        nextAttemptAt: null,
        blocked: true,
        attempts: MAX_ATTEMPTS
      }
    );
    await updateOverallStatus(updated);
    return;
  }

  try {
    const response = await monitoring.measureDependency(
      {
        dependencyType: "provider",
        dependencyName: channel.toLowerCase(),
        operation: "send_notification"
      },
      () =>
        provider.send({
          notification: claimed,
          channel,
          recipient
        })
    );
    monitoring.recordNotificationSend(channel, "success");

    const updated = await notificationRepository.updateChannelResult(
      claimed.id,
      channel,
      {
        status: "SENT",
        processing: false,
        lastError: null,
        nextAttemptAt: null,
        providerMessageId: response?.messageId || null
      }
    );
    await updateOverallStatus(updated);
  } catch (error) {
    monitoring.recordNotificationSend(channel, "error", {
      reason: "send_failed"
    });
    const attempts =
      claimed.perChannelStatus?.[channel]?.attempts || 1;
    const shouldRetry = attempts < MAX_ATTEMPTS;
    const nextAttemptAt = shouldRetry
      ? new Date(Date.now() + computeBackoff(attempts))
      : null;
    const updated = await notificationRepository.updateChannelResult(
      claimed.id,
      channel,
      {
        status: "FAILED",
        processing: false,
        lastError: error?.message || "SEND_FAILED",
        nextAttemptAt
      }
    );
    await updateOverallStatus(updated);
  }
}

async function dispatchOnce() {
  const now = new Date();
  const backlog = await notificationRepository.countDispatchBacklog(now);
  monitoring.setQueueBacklog("notification_dispatch", backlog);

  const candidates =
    await notificationRepository.findDispatchCandidates(
      DISPATCH_BATCH_SIZE,
      now
    );

  for (const notification of candidates) {
    for (const channel of notification.channels || []) {
      await handleChannel(notification, channel);
    }
  }
}

function startDispatcher() {
  if (state.running) {
    return state;
  }
  state.running = true;

  const tick = async () => {
    state.lastTickAt = new Date();
    try {
      await dispatchOnce();
      state.lastError = null;
    } catch (error) {
      state.lastError = error;
      logger.error(
        { err: error },
        "[notification-service] dispatcher error"
      );
    }
  };

  tick();
  setInterval(tick, DISPATCH_INTERVAL_MS);
  return state;
}

function getDispatcherState() {
  return state;
}

module.exports = { startDispatcher, getDispatcherState };

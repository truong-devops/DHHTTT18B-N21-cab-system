const { ApiError } = require("../utils/errors");
const logger = require("../utils/logger");
const { buildDedupeKey } = require("../utils/dedupe");
const {
  CHANNEL_VALUES,
  isNonEmptyString,
  isObject,
  normalizeChannels,
  parseDate
} = require("../utils/validation");
const { getUserById } = require("../clients/userServiceClient");
const notificationRepository = require("../repository/notificationRepository");
const preferenceRepository = require("../repository/preferenceRepository");

const MAX_ATTEMPTS = Number(
  process.env.NOTIFICATION_MAX_ATTEMPTS || 5
);

function validatePayload(payload) {
  const errors = [];
  if (!isObject(payload)) {
    errors.push({ field: "body", message: "must be an object" });
    return errors;
  }

  if (!isNonEmptyString(payload.sourceService)) {
    errors.push({ field: "sourceService", message: "is required" });
  }
  if (!isNonEmptyString(payload.sourceAction)) {
    errors.push({ field: "sourceAction", message: "is required" });
  }
  if (!isNonEmptyString(payload.userId)) {
    errors.push({ field: "userId", message: "is required" });
  }

  const channelResult = normalizeChannels(payload.channels);
  if (!channelResult.ok) {
    errors.push({ field: "channels", message: channelResult.error });
  } else if (channelResult.value.length === 0) {
    errors.push({ field: "channels", message: "must not be empty" });
  }

  if (payload.recipient && !isObject(payload.recipient)) {
    errors.push({ field: "recipient", message: "must be an object" });
  }

  if (payload.sourceRef && !isObject(payload.sourceRef)) {
    errors.push({ field: "sourceRef", message: "must be an object" });
  }

  if (payload.templateKey && !isNonEmptyString(payload.templateKey)) {
    errors.push({ field: "templateKey", message: "must be a string" });
  }

  if (payload.dedupeKey && !isNonEmptyString(payload.dedupeKey)) {
    errors.push({ field: "dedupeKey", message: "must be a string" });
  }

  if (payload.title && !isNonEmptyString(payload.title)) {
    errors.push({ field: "title", message: "must be a string" });
  }

  if (payload.body && !isNonEmptyString(payload.body)) {
    errors.push({ field: "body", message: "must be a string" });
  }

  if (!payload.templateKey && !payload.title && !payload.body) {
    errors.push({
      field: "templateKey|title|body",
      message: "templateKey or title/body is required"
    });
  }

  const scheduleResult = parseDate(payload.scheduledAt);
  if (!scheduleResult.ok) {
    errors.push({ field: "scheduledAt", message: scheduleResult.error });
  }

  return errors;
}

function normalizeRecipient(recipient) {
  const result = {
    email: null,
    phone: null,
    pushTokens: []
  };
  if (!recipient) {
    return result;
  }
  if (recipient.email) {
    result.email = String(recipient.email).trim();
  }
  if (recipient.phone) {
    result.phone = String(recipient.phone).trim();
  }
  if (Array.isArray(recipient.pushTokens)) {
    result.pushTokens = recipient.pushTokens.filter(Boolean);
  }
  if (recipient.pushToken) {
    result.pushTokens.push(String(recipient.pushToken));
  }
  result.pushTokens = Array.from(new Set(result.pushTokens));
  return result;
}

function computeDedupeKey(payload, normalizedChannels) {
  if (payload.dedupeKey) {
    return payload.dedupeKey;
  }
  const sourceRef = payload.sourceRef || {};
  const hashPayload = {
    sourceService: payload.sourceService,
    sourceAction: payload.sourceAction,
    userId: payload.userId,
    sourceRef,
    channels: normalizedChannels,
    templateKey: payload.templateKey || null,
    title: payload.title || null,
    body: payload.body || null,
    data: payload.data || null,
    scheduledAt: payload.scheduledAt || null
  };
  return buildDedupeKey(hashPayload);
}

function buildPerChannelStatus({
  channels,
  recipient,
  userStatus,
  lookupFailed,
  preferences,
  scheduledAt,
  now
}) {
  const perChannelStatus = {};

  channels.forEach((channel) => {
    const base = {
      status: "PENDING",
      attempts: 0,
      lastError: null,
      lastAttemptAt: null,
      nextAttemptAt: scheduledAt || null,
      providerMessageId: null,
      processing: false,
      blocked: false
    };

    const isInApp = channel === "IN_APP";
    const prefAllowed =
      !preferences ||
      preferences[channel] === undefined ||
      preferences[channel] === true;

    if (!prefAllowed) {
      perChannelStatus[channel] = {
        ...base,
        status: "FAILED",
        attempts: MAX_ATTEMPTS,
        lastError: "OPTED_OUT",
        blocked: true
      };
      return;
    }

    if (!isInApp && lookupFailed) {
      perChannelStatus[channel] = {
        ...base,
        status: "FAILED",
        attempts: MAX_ATTEMPTS,
        lastError: "USER_LOOKUP_FAILED",
        blocked: true
      };
      return;
    }

    if (!isInApp && userStatus && userStatus !== "ACTIVE") {
      perChannelStatus[channel] = {
        ...base,
        status: "FAILED",
        attempts: MAX_ATTEMPTS,
        lastError: "USER_INACTIVE",
        blocked: true
      };
      return;
    }

    if (!isInApp) {
      const hasRecipient =
        (channel === "EMAIL" && recipient.email) ||
        (channel === "SMS" && recipient.phone) ||
        (channel === "PUSH" && recipient.pushTokens.length);

      if (!hasRecipient) {
        perChannelStatus[channel] = {
          ...base,
          status: "FAILED",
          attempts: MAX_ATTEMPTS,
          lastError: "MISSING_RECIPIENT",
          blocked: true
        };
        return;
      }
    }

    perChannelStatus[channel] = base;
  });

  return perChannelStatus;
}

function deriveOverallStatus(perChannelStatus, scheduledAt, now) {
  const statuses = Object.values(perChannelStatus).map(
    (entry) => entry.status
  );
  if (!statuses.length) {
    return "FAILED";
  }

  const all = (value) => statuses.every((status) => status === value);
  const any = (value) => statuses.some((status) => status === value);

  if (all("CANCELED")) {
    return "CANCELED";
  }
  if (all("SENT")) {
    return "SENT";
  }
  if (all("FAILED")) {
    return "FAILED";
  }
  if (any("PROCESSING")) {
    return "PROCESSING";
  }

  const scheduledInFuture =
    scheduledAt && now && scheduledAt.getTime() > now.getTime();
  if (scheduledInFuture && any("PENDING")) {
    return "SCHEDULED";
  }

  if (any("PENDING")) {
    return "PENDING";
  }

  if (any("FAILED") && any("SENT")) {
    return "PARTIAL";
  }

  return "PENDING";
}

async function resolveUserContacts(userId, context) {
  try {
    return await getUserById(userId, context);
  } catch (error) {
    logger.withTrace(context).warn(
      { err: error },
      "[notification-service] user-service lookup failed"
    );
    return { error: true };
  }
}

async function createNotification(payload, context) {
  const errors = validatePayload(payload);
  if (errors.length) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid payload", errors);
  }

  const channelResult = normalizeChannels(payload.channels);
  if (!channelResult.ok) {
    throw new ApiError(400, "VALIDATION_ERROR", channelResult.error);
  }
  const channels = channelResult.value;

  const scheduleResult = parseDate(payload.scheduledAt);
  if (!scheduleResult.ok) {
    throw new ApiError(400, "VALIDATION_ERROR", scheduleResult.error);
  }

  const dedupeKey = computeDedupeKey(payload, channels);

  const existing = await notificationRepository.findByDedupeKey(
    dedupeKey
  );
  if (existing) {
    return { notification: existing, created: false };
  }

  const now = new Date();
  const scheduledAt = scheduleResult.value;
  const recipient = normalizeRecipient(payload.recipient);

  let lookupFailed = false;
  let userStatus = null;

  if (channels.some((channel) => channel !== "IN_APP")) {
    const userProfile = await resolveUserContacts(payload.userId, context);
    if (userProfile && !userProfile.error) {
      userStatus = userProfile.status
        ? String(userProfile.status).toUpperCase()
        : null;
      if (!recipient.email && userProfile.contacts?.email) {
        recipient.email = userProfile.contacts.email;
      }
      if (!recipient.phone && userProfile.contacts?.phone) {
        recipient.phone = userProfile.contacts.phone;
      }
      if (
        recipient.pushTokens.length === 0 &&
        Array.isArray(userProfile.contacts?.pushTokens)
      ) {
        recipient.pushTokens = userProfile.contacts.pushTokens;
      }
    } else {
      lookupFailed = true;
    }
  }

  const preferencesDoc =
    process.env.NOTIFICATION_RESPECT_PREFERENCES === "false"
      ? null
      : await preferenceRepository.getPreferences(payload.userId);
  const preferences = preferencesDoc?.channels || null;

  const perChannelStatus = buildPerChannelStatus({
    channels,
    recipient,
    userStatus,
    lookupFailed,
    preferences,
    scheduledAt,
    now
  });

  const status = deriveOverallStatus(perChannelStatus, scheduledAt, now);

  const notification = {
    userId: payload.userId,
    channels,
    recipient,
    templateKey: payload.templateKey || null,
    title: payload.title || null,
    body: payload.body || null,
    data: payload.data || null,
    status,
    perChannelStatus,
    sourceService: payload.sourceService,
    sourceAction: payload.sourceAction,
    sourceRef: payload.sourceRef || {},
    dedupeKey,
    scheduledAt,
    requestMeta: {
      traceId: context?.traceId || null,
      requestId: context?.requestId || null,
      correlationId: context?.correlationId || null,
      forwardedFor: context?.forwardedFor || null,
      realIp: context?.realIp || null
    },
    createdBy: context?.userId || null,
    createdAt: now,
    updatedAt: now
  };

  try {
    const created = await notificationRepository.insertNotification(
      notification
    );
    return { notification: created, created: true };
  } catch (error) {
    if (String(error?.code) === "11000") {
      const existingDoc = await notificationRepository.findByDedupeKey(
        dedupeKey
      );
      if (existingDoc) {
        return { notification: existingDoc, created: false };
      }
    }
    throw error;
  }
}

async function createBatch(payload, context) {
  if (!payload || !Array.isArray(payload.items)) {
    throw new ApiError(400, "VALIDATION_ERROR", "items is required");
  }

  const results = [];
  for (let i = 0; i < payload.items.length; i += 1) {
    try {
      const { notification, created } = await createNotification(
        payload.items[i],
        context
      );
      results.push({ index: i, id: notification.id, created });
    } catch (error) {
      results.push({
        index: i,
        error: {
          code: error.code || "ERROR",
          message: error.message
        }
      });
    }
  }

  return results;
}

async function getNotificationById(id) {
  const notification = await notificationRepository.findById(id);
  if (!notification) {
    throw new ApiError(404, "NOT_FOUND", "Notification not found");
  }
  return notification;
}

async function listNotificationsByUser(userId, filters) {
  return notificationRepository.listByUserId({ userId, ...filters });
}

async function retryNotification(id) {
  const notification = await notificationRepository.findById(id);
  if (!notification) {
    throw new ApiError(404, "NOT_FOUND", "Notification not found");
  }

  const updates = {};
  const now = new Date();

  Object.entries(notification.perChannelStatus || {}).forEach(
    ([channel, status]) => {
      if (["FAILED", "PENDING"].includes(status.status)) {
        updates[`perChannelStatus.${channel}.status`] = "PENDING";
        updates[`perChannelStatus.${channel}.processing`] = false;
        updates[`perChannelStatus.${channel}.lastError`] = null;
        updates[`perChannelStatus.${channel}.nextAttemptAt`] = now;
        updates[`perChannelStatus.${channel}.attempts`] = 0;
        updates[`perChannelStatus.${channel}.blocked`] = false;
      }
    }
  );

  updates.status = "PENDING";
  updates.updatedAt = now;

  const updated = await notificationRepository.updateNotificationById(
    id,
    { $set: updates }
  );
  if (updated) {
    return updated;
  }
  return notificationRepository.findById(id);
}

async function cancelNotification(id) {
  const notification = await notificationRepository.findById(id);
  if (!notification) {
    throw new ApiError(404, "NOT_FOUND", "Notification not found");
  }
  const hasSentChannel = Object.values(
    notification.perChannelStatus || {}
  ).some((status) => status.status === "SENT");
  if (notification.status === "SENT" || hasSentChannel) {
    throw new ApiError(409, "CONFLICT", "Notification already sent");
  }

  const updates = { status: "CANCELED", updatedAt: new Date() };

  Object.entries(notification.perChannelStatus || {}).forEach(
    ([channel, status]) => {
      if (status.status !== "SENT") {
        updates[`perChannelStatus.${channel}.status`] = "CANCELED";
        updates[`perChannelStatus.${channel}.processing`] = false;
      }
    }
  );

  const updated = await notificationRepository.updateNotificationById(
    id,
    { $set: updates }
  );
  if (updated) {
    return updated;
  }
  return notificationRepository.findById(id);
}

async function getPreferences(userId) {
  const prefs = await preferenceRepository.getPreferences(userId);
  return prefs || { userId, channels: {}, updatedAt: null, createdAt: null };
}

async function updatePreferences(userId, channels) {
  if (!isObject(channels)) {
    throw new ApiError(400, "VALIDATION_ERROR", "channels must be object");
  }

  const sanitized = {};
  Object.entries(channels).forEach(([key, value]) => {
    const upper = String(key).toUpperCase();
    if (CHANNEL_VALUES.includes(upper)) {
      sanitized[upper] = Boolean(value);
    }
  });

  return preferenceRepository.upsertPreferences(userId, sanitized);
}

module.exports = {
  createNotification,
  createBatch,
  getNotificationById,
  listNotificationsByUser,
  retryNotification,
  cancelNotification,
  getPreferences,
  updatePreferences,
  deriveOverallStatus
};

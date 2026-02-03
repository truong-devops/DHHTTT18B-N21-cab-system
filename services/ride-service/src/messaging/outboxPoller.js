const { publish } = require("./producer");
const topics = require("./topics");
const {
  claimPendingEvents,
  markPublished,
  markFailed
} = require("../repository/outboxEventsRepository");
const logger = require("../utils/logger");

const DEFAULT_INTERVAL_MS = 5000;
const DEFAULT_BATCH_SIZE = 50;

function resolvePayload(row) {
  if (row.payload && row.payload.payload) {
    return {
      traceId: row.payload.traceId || null,
      payload: row.payload.payload
    };
  }
  return { traceId: null, payload: row.payload };
}

const EVENT_TOPIC_MAP = {
  RideCreated: topics.RideCreated,
  RideAssigned: topics.RideAssigned
};

async function tick() {
  const rows = await claimPendingEvents(DEFAULT_BATCH_SIZE);
  if (!rows.length) {
    return;
  }

  for (const row of rows) {
    const { traceId, payload } = resolvePayload(row);
    const topic = EVENT_TOPIC_MAP[row.event_type];
    if (!topic) {
      logger.error(
        { eventType: row.event_type },
        "[ride-service] outbox unknown event_type"
      );
      await markFailed(row.id);
      continue;
    }
    try {
      const result = await publish({
        topic,
        type: row.event_type,
        traceId,
        payload,
        eventId: row.event_id,
        version: 1,
        occurredAt: row.occurred_at
      });

      if (!result.published) {
        await markFailed(row.id);
        continue;
      }

      await markPublished(row.id);
    } catch (error) {
      logger
        .withTrace(traceId)
        .error(
          { err: error, eventId: row.event_id },
          "[ride-service] outbox publish failed"
        );
      await markFailed(row.id);
    }
  }
}

function startOutboxPoller(intervalMs = DEFAULT_INTERVAL_MS) {
  const timer = setInterval(() => {
    tick().catch((error) => {
      logger.error(
        { err: error },
        "[ride-service] outbox tick error"
      );
    });
  }, intervalMs);

  timer.unref();
  return () => clearInterval(timer);
}

module.exports = { startOutboxPoller };

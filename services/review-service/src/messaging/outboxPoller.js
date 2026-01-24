const { publish } = require("./producer");
const topics = require("./topics");
const {
  claimPendingEvents,
  markPublished,
  markFailed
} = require("../repository/outboxEventsRepository");

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

async function tick() {
  const rows = await claimPendingEvents(DEFAULT_BATCH_SIZE);
  if (!rows.length) {
    return;
  }

  for (const row of rows) {
    const { traceId, payload } = resolvePayload(row);
    try {
      const result = await publish({
        topic: topics.ReviewCreated,
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
      console.error(
        `[review-service] outbox publish failed eventId=${row.event_id}`,
        error
      );
      await markFailed(row.id);
    }
  }
}

function startOutboxPoller(intervalMs = DEFAULT_INTERVAL_MS) {
  const timer = setInterval(() => {
    tick().catch((error) => {
      console.error("[review-service] outbox tick error", error);
    });
  }, intervalMs);

  timer.unref();
  return () => clearInterval(timer);
}

module.exports = { startOutboxPoller };

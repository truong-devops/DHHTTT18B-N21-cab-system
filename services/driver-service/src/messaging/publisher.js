const crypto = require("crypto");
const topics = require("./topics");

function buildEventId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function publishDriverLocationUpdated({ driverId, location }) {
  const event = {
    eventId: buildEventId(),
    eventType: topics.DriverLocationUpdated,
    occurredAt: new Date().toISOString(),
    data: {
      driverId,
      location
    }
  };
  console.log(`[event] ${topics.DriverLocationUpdated}`, event);
  return event;
}

module.exports = {
  publishDriverLocationUpdated
};

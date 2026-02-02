const { randomUUID } = require("crypto");

const locations = [];
const eventsById = new Map();

function createLocation({ eventId, driverId, lat, lng, recordedAt }) {
  if (eventsById.has(eventId)) {
    return { ok: true, location: eventsById.get(eventId), existed: true };
  }

  const location = {
    locationId: randomUUID(),
    driverId,
    lat,
    lng,
    recordedAt: recordedAt || new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  locations.push(location);
  eventsById.set(eventId, location);
  return { ok: true, location };
}

function listLocations({ driverId, limit, cursor }) {
  const items = locations
    .filter((item) => (driverId ? item.driverId === driverId : true))
    .sort((a, b) => {
      if (a.recordedAt === b.recordedAt) {
        return a.locationId.localeCompare(b.locationId);
      }
      return a.recordedAt.localeCompare(b.recordedAt);
    });

  const filtered = cursor
    ? items.filter(
        (item) =>
          item.recordedAt > cursor.recordedAt ||
          (item.recordedAt === cursor.recordedAt &&
            item.locationId > cursor.locationId)
      )
    : items;

  const page = filtered.slice(0, limit);
  const next =
    filtered.length > limit
      ? {
          recordedAt: page[page.length - 1].recordedAt,
          locationId: page[page.length - 1].locationId
        }
      : null;

  return { items: page, nextCursor: next };
}

function _reset() {
  locations.length = 0;
  eventsById.clear();
}

module.exports = {
  createLocation,
  listLocations,
  // testing helper
  _reset
};

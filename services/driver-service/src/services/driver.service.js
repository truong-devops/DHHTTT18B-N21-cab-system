const { randomUUID } = require("crypto");

const drivers = new Map();

function createDriver(payload) {
  if (drivers.has(payload.driverId)) {
    return { ok: false, error: "DRIVER_EXISTS" };
  }

  const now = new Date().toISOString();
  const driver = {
    driverId: payload.driverId || randomUUID(),
    name: payload.name,
    phone: payload.phone,
    status: payload.status,
    statusUpdatedAt: now,
    createdAt: now,
    updatedAt: now
  };

  drivers.set(driver.driverId, driver);
  return { ok: true, driver };
}

function listDrivers({ limit, cursor }) {
  const items = Array.from(drivers.values()).sort((a, b) => {
    if (a.createdAt === b.createdAt) {
      return a.driverId.localeCompare(b.driverId);
    }
    return a.createdAt.localeCompare(b.createdAt);
  });

  const filtered = cursor
    ? items.filter(
        (item) =>
          item.createdAt > cursor.createdAt ||
          (item.createdAt === cursor.createdAt &&
            item.driverId > cursor.driverId)
      )
    : items;

  const page = filtered.slice(0, limit);
  const next =
    filtered.length > limit
      ? {
          createdAt: page[page.length - 1].createdAt,
          driverId: page[page.length - 1].driverId
        }
      : null;

  return { items: page, nextCursor: next };
}

function getDriver(driverId) {
  return drivers.get(driverId) || null;
}

function updateDriver(driverId, payload) {
  const driver = drivers.get(driverId);
  if (!driver) {
    return { ok: false, error: "DRIVER_NOT_FOUND" };
  }

  if (payload.name !== undefined) {
    driver.name = payload.name;
  }
  if (payload.phone !== undefined) {
    driver.phone = payload.phone;
  }
  if (payload.status !== undefined) {
    driver.status = payload.status;
    driver.statusUpdatedAt = new Date().toISOString();
  }
  driver.updatedAt = new Date().toISOString();

  return { ok: true, driver };
}

function _reset() {
  drivers.clear();
}

module.exports = {
  createDriver,
  listDrivers,
  getDriver,
  updateDriver,
  // testing helper
  _reset
};

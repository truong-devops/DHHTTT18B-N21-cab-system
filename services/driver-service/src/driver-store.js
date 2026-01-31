const crypto = require("crypto");

const drivers = new Map();
const v1Drivers = new Map();

function buildDriverId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDriver(payload) {
  const { driverId, name, phone, status, location } = payload;
  if (drivers.has(driverId)) {
    return null;
  }
  const now = new Date().toISOString();
  const driver = {
    driverId,
    name,
    phone,
    status,
    location,
    createdAt: now,
    updatedAt: now
  };
  drivers.set(driverId, driver);
  return driver;
}

function updateDriverStatus(driverId, status) {
  const driver = drivers.get(driverId);
  if (!driver) {
    return null;
  }
  driver.status = status;
  driver.updatedAt = new Date().toISOString();
  return driver;
}

function updateDriverLocation(driverId, location) {
  const driver = drivers.get(driverId);
  if (!driver) {
    return null;
  }
  driver.location = location;
  driver.updatedAt = new Date().toISOString();
  return driver;
}

function createDriverV1(payload) {
  const { fullName, phoneNumber } = payload;
  const now = new Date().toISOString();
  const driver = {
    driverId: buildDriverId(),
    fullName,
    phoneNumber,
    createdAt: now,
    updatedAt: now
  };
  v1Drivers.set(driver.driverId, driver);
  return driver;
}

function updateDriverLocationV1(driverId, location) {
  const driver = v1Drivers.get(driverId);
  if (!driver) {
    return null;
  }
  driver.location = location;
  driver.updatedAt = new Date().toISOString();
  return driver;
}

module.exports = {
  createDriver,
  createDriverV1,
  updateDriverStatus,
  updateDriverLocation,
  updateDriverLocationV1
};

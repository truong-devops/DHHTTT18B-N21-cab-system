const redis = require('../cache/redis');
const {
  LOCATION_TTL_SECONDS,
  ONLINE_TTL_SECONDS,
  MAX_LOCATION_RATE_PER_SEC,
  DEFAULT_SEARCH_RADIUS_METERS,
  AVAILABLE_LIMIT_DEFAULT,
  FORCE_OFFLINE_WHEN_BUSY
} = require('../config/settings');
const { DRIVER_STATUS, ONLINE_STATUS, canGoOnline, canTransitionOnlineStatus } = require('../domain/driverState');
const { ApiError } = require('../utils/errors');
const { driverLocationKey, driverOnlineKey, driverBusyKey, geoKey, locationRateKey } = require('../utils/redisKeys');
const { mapDriver, mapVehicle, mapLocation, mapKycSubmission } = require('../utils/mapper');
const { toUser8 } = require('../utils/identity');
const monitoring = require('../monitoring');
const driverRepository = require('../repository/driverRepository');
const vehicleRepository = require('../repository/vehicleRepository');
const locationRepository = require('../repository/locationRepository');
const kycRepository = require('../repository/kycRepository');

const KYC_STATUS = {
  NOT_SUBMITTED: 'NOT_SUBMITTED',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
};

function normalizeEightDigitId(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return /^\d{8}$/.test(normalized) ? normalized : null;
}

async function getDriverMe(userId) {
  let driver = await driverRepository.getDriverByUserId(userId);
  if (!driver) {
    // Tự tạo hồ sơ driver khi user có role driver nhưng chưa có bản ghi driver.
    driver = await driverRepository.createDriver({
      userId,
      fullName: null,
      phone: null
    });
    // Đưa về trạng thái sẵn sàng duyệt để app hiển thị được.
    driver = await driverRepository.updateDriverStatus(driver.id, 'APPROVED');
  }
  const vehicle = await vehicleRepository.getActiveVehicleByDriverId(driver.id);
  const location = await getLocationSnapshot(driver.id);

  return {
    driver: mapDriver(driver),
    vehicle: mapVehicle(vehicle),
    location
  };
}

async function updateDriverProfile(userId, fields) {
  const driver = await driverRepository.getDriverByUserId(userId);
  if (!driver) {
    throw new ApiError(404, 'NOT_FOUND', 'Driver not found');
  }
  const updated = await driverRepository.updateDriverProfile(driver.id, fields);
  const vehicle = await vehicleRepository.getActiveVehicleByDriverId(driver.id);
  const location = await getLocationSnapshot(driver.id);

  return {
    driver: mapDriver(updated),
    vehicle: mapVehicle(vehicle),
    location
  };
}

async function getDriverKyc(userId) {
  const driver = await driverRepository.getDriverByUserId(userId);
  if (!driver) {
    return {
      status: KYC_STATUS.NOT_SUBMITTED,
      rejectionReason: null,
      submission: null
    };
  }

  const latest = await kycRepository.getLatestByDriverId(driver.id);
  if (!latest) {
    return {
      status: KYC_STATUS.NOT_SUBMITTED,
      rejectionReason: null,
      submission: null
    };
  }

  return {
    status: latest.status,
    rejectionReason: latest.rejection_reason || null,
    submission: mapKycSubmission(latest)
  };
}

async function submitDriverKyc(userId, payload = {}) {
  let driver = await driverRepository.getDriverByUserId(userId);
  if (!driver) {
    driver = await driverRepository.createDriver({
      userId,
      fullName: payload.fullName || null,
      phone: payload.phone || null
    });
  }

  const submission = await kycRepository.createSubmission({
    driverId: driver.id,
    fullName: payload.fullName || driver.full_name || null,
    phone: payload.phone || driver.phone || null,
    idNumber: payload.idNumber || null,
    licenseNumber: payload.licenseNumber || null,
    vehicleRegistrationNumber: payload.vehicleRegistrationNumber || null,
    idFrontUrl: payload.idFrontUrl || null,
    idBackUrl: payload.idBackUrl || null,
    licenseFrontUrl: payload.licenseFrontUrl || null,
    selfieUrl: payload.selfieUrl || null
  });

  if (driver.status !== DRIVER_STATUS.PENDING) {
    await driverRepository.updateDriverStatus(driver.id, DRIVER_STATUS.PENDING);
  }

  return {
    status: submission.status,
    submission: mapKycSubmission(submission)
  };
}

async function listKycSubmissionsAdmin({ status, page, limit }) {
  const normalizedStatus = status ? String(status).toUpperCase() : null;
  if (normalizedStatus && !Object.values(KYC_STATUS).includes(normalizedStatus)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid KYC status');
  }
  const data = await kycRepository.listSubmissions({
    status: normalizedStatus,
    page,
    limit
  });
  return {
    items: data.items.map(mapKycSubmission),
    page: data.page,
    limit: data.limit
  };
}

async function approveKycSubmission(submissionId, reviewerId) {
  const current = await kycRepository.getById(submissionId);
  if (!current) {
    throw new ApiError(404, 'NOT_FOUND', 'KYC submission not found');
  }

  const updated = await kycRepository.updateReview({
    id: submissionId,
    status: KYC_STATUS.APPROVED,
    rejectionReason: null,
    reviewedBy: normalizeEightDigitId(reviewerId)
  });
  const driver = await driverRepository.updateDriverStatus(current.driver_id, DRIVER_STATUS.APPROVED);

  return {
    submission: mapKycSubmission(updated),
    driver: mapDriver(driver)
  };
}

async function rejectKycSubmission(submissionId, reason, reviewerId) {
  if (!reason || !String(reason).trim()) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'rejectionReason is required');
  }

  const current = await kycRepository.getById(submissionId);
  if (!current) {
    throw new ApiError(404, 'NOT_FOUND', 'KYC submission not found');
  }

  const updated = await kycRepository.updateReview({
    id: submissionId,
    status: KYC_STATUS.REJECTED,
    rejectionReason: String(reason).trim(),
    reviewedBy: normalizeEightDigitId(reviewerId)
  });
  const driver = await driverRepository.updateDriverStatus(current.driver_id, DRIVER_STATUS.PENDING);

  return {
    submission: mapKycSubmission(updated),
    driver: mapDriver(driver)
  };
}

async function upsertVehicle(userId, vehicleInput) {
  const driver = await driverRepository.getDriverByUserId(userId);
  if (!driver) {
    throw new ApiError(404, 'NOT_FOUND', 'Driver not found');
  }

  const vehicle = await vehicleRepository.upsertActiveVehicle({
    driverId: driver.id,
    vehicleType: vehicleInput.vehicleType,
    plateNumber: vehicleInput.plateNumber,
    brand: vehicleInput.brand || null,
    model: vehicleInput.model || null,
    color: vehicleInput.color || null,
    isActive: vehicleInput.isActive === undefined ? true : Boolean(vehicleInput.isActive)
  });

  return { vehicle: mapVehicle(vehicle) };
}

async function setOnline(userId, initialLocation) {
  const driver = await driverRepository.getDriverByUserId(userId);
  if (!driver) {
    throw new ApiError(404, 'NOT_FOUND', 'Driver not found');
  }
  if (!canGoOnline(driver.status)) {
    throw new ApiError(403, 'FORBIDDEN', 'Driver not approved');
  }

  if (!canTransitionOnlineStatus(driver.online_status, ONLINE_STATUS.ONLINE)) {
    throw new ApiError(409, 'CONFLICT', 'Invalid online status transition');
  }

  const updated = await driverRepository.updateOnlineStatus(driver.id, [ONLINE_STATUS.OFFLINE], ONLINE_STATUS.ONLINE);
  if (!updated) {
    throw new ApiError(409, 'CONFLICT', 'Driver already online');
  }

  await updateOnlineRedis(driver.id, ONLINE_STATUS.ONLINE);

  if (initialLocation) {
    await updateDriverLocation(driver.id, initialLocation);
  }

  monitoring.recordBusinessEvent({
    domain: 'driver',
    event: 'online_status_changed',
    outcome: 'success',
    attributes: {
      status: 'online'
    }
  });

  return { driver: mapDriver(updated) };
}

async function setOnlineByDriverId(driverId, initialLocation) {
  const driver = await driverRepository.getDriverById(driverId);
  if (!driver) {
    throw new ApiError(404, 'NOT_FOUND', 'Driver not found');
  }
  if (!canGoOnline(driver.status)) {
    throw new ApiError(403, 'FORBIDDEN', 'Driver not approved');
  }

  if (!canTransitionOnlineStatus(driver.online_status, ONLINE_STATUS.ONLINE)) {
    throw new ApiError(409, 'CONFLICT', 'Invalid online status transition');
  }

  const updated = await driverRepository.updateOnlineStatus(driver.id, [ONLINE_STATUS.OFFLINE], ONLINE_STATUS.ONLINE);
  if (!updated) {
    throw new ApiError(409, 'CONFLICT', 'Driver already online');
  }

  await updateOnlineRedis(driver.id, ONLINE_STATUS.ONLINE);
  if (initialLocation) {
    await updateDriverLocation(driver.id, initialLocation);
  }

  return { driver: mapDriver(updated) };
}

async function setOffline(userId) {
  const driver = await driverRepository.getDriverByUserId(userId);
  if (!driver) {
    throw new ApiError(404, 'NOT_FOUND', 'Driver not found');
  }

  const allowForce = FORCE_OFFLINE_WHEN_BUSY;
  if (!canTransitionOnlineStatus(driver.online_status, ONLINE_STATUS.OFFLINE, allowForce)) {
    throw new ApiError(409, 'CONFLICT', 'Invalid online status transition');
  }

  const allowedCurrent = allowForce ? [ONLINE_STATUS.ONLINE, ONLINE_STATUS.BUSY] : [ONLINE_STATUS.ONLINE];

  const updated = await driverRepository.updateOnlineStatus(driver.id, allowedCurrent, ONLINE_STATUS.OFFLINE);
  if (!updated) {
    throw new ApiError(409, 'CONFLICT', 'Driver already offline or busy');
  }

  const vehicle = await vehicleRepository.getActiveVehicleByDriverId(driver.id);
  await clearOnlineRedis(driver.id, vehicle?.vehicle_type);

  monitoring.recordBusinessEvent({
    domain: 'driver',
    event: 'online_status_changed',
    outcome: 'success',
    attributes: {
      status: 'offline'
    }
  });

  return { driver: mapDriver(updated) };
}

async function setOfflineByDriverId(driverId) {
  const driver = await driverRepository.getDriverById(driverId);
  if (!driver) {
    throw new ApiError(404, 'NOT_FOUND', 'Driver not found');
  }

  const allowForce = FORCE_OFFLINE_WHEN_BUSY;
  if (!canTransitionOnlineStatus(driver.online_status, ONLINE_STATUS.OFFLINE, allowForce)) {
    throw new ApiError(409, 'CONFLICT', 'Invalid online status transition');
  }

  const allowedCurrent = allowForce ? [ONLINE_STATUS.ONLINE, ONLINE_STATUS.BUSY] : [ONLINE_STATUS.ONLINE];
  const updated = await driverRepository.updateOnlineStatus(driver.id, allowedCurrent, ONLINE_STATUS.OFFLINE);
  if (!updated) {
    throw new ApiError(409, 'CONFLICT', 'Driver already offline or busy');
  }

  const vehicle = await vehicleRepository.getActiveVehicleByDriverId(driver.id);
  await clearOnlineRedis(driver.id, vehicle?.vehicle_type);
  return { driver: mapDriver(updated) };
}

async function updateDriverLocation(driverId, input) {
  const driver = await driverRepository.getDriverById(driverId);
  if (!driver) {
    throw new ApiError(404, 'NOT_FOUND', 'Driver not found');
  }
  const internalDriverId = driver.id;

  const recordedAt = input.recordedAt ? new Date(input.recordedAt) : new Date();
  if (Number.isNaN(recordedAt.getTime())) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid recordedAt');
  }

  await enforceLocationRateLimit(internalDriverId);

  const redisLocation = await getRedisLocation(internalDriverId);
  if (redisLocation && redisLocation.ts && new Date(redisLocation.ts).getTime() >= recordedAt.getTime()) {
    return { ignored: true };
  }

  await setRedisLocation(internalDriverId, {
    lat: input.lat,
    lng: input.lng,
    heading: input.heading,
    speed: input.speed,
    accuracy: input.accuracy,
    ts: recordedAt.toISOString()
  });

  const vehicle = await vehicleRepository.getActiveVehicleByDriverId(internalDriverId);
  await updateGeo(internalDriverId, input.lat, input.lng, vehicle?.vehicle_type);

  await locationRepository.upsertLastLocation({
    driverId: internalDriverId,
    lat: input.lat,
    lng: input.lng,
    heading: input.heading || null,
    speed: input.speed || null,
    accuracyM: input.accuracy || null,
    recordedAt
  });

  return { updated: true };
}

async function heartbeat(userId) {
  const driver = await driverRepository.getDriverByUserId(userId);
  if (!driver) {
    throw new ApiError(404, 'NOT_FOUND', 'Driver not found');
  }

  await refreshOnlineRedis(driver.id, driver.online_status);
  await refreshLocationTtl(driver.id);

  return { ok: true };
}

async function getDriverInternal(driverId) {
  const driver = await driverRepository.getDriverById(driverId);
  if (!driver) {
    throw new ApiError(404, 'NOT_FOUND', 'Driver not found');
  }
  const vehicle = await vehicleRepository.getActiveVehicleByDriverId(driver.id);
  return { driver: mapDriver(driver), vehicle: mapVehicle(vehicle) };
}

async function getDriverProfileForCustomer(driverId) {
  const driver = (await driverRepository.getDriverById(driverId)) || (await driverRepository.getDriverByUserId(driverId));
  if (!driver) {
    throw new ApiError(404, 'NOT_FOUND', 'Driver not found');
  }

  const vehicle = await vehicleRepository.getActiveVehicleByDriverId(driver.id);
  const location = await getLocationSnapshot(driver.id);

  return {
    driver: {
      id: toUser8(driver.id),
      userId: toUser8(driver.user_id),
      fullName: driver.full_name || null,
      phone: driver.phone || null,
      status: driver.status,
      onlineStatus: driver.online_status
    },
    vehicle: mapVehicle(vehicle),
    location
  };
}

async function getLocationInternal(driverId) {
  const driver = await driverRepository.getDriverById(driverId);
  if (!driver) {
    throw new ApiError(404, 'NOT_FOUND', 'Driver not found');
  }
  const location = await getLocationSnapshot(driver.id);
  if (!location) {
    throw new ApiError(404, 'NOT_FOUND', 'Location not found');
  }
  return { location };
}

async function listAvailableDrivers({ lat, lng, radiusMeters = DEFAULT_SEARCH_RADIUS_METERS, limit = AVAILABLE_LIMIT_DEFAULT, vehicleType }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 1, 1), 100);
  const safeRadius = Math.max(Number(radiusMeters) || DEFAULT_SEARCH_RADIUS_METERS, 100);
  const fallbackToPostgres = async () => {
    const fallback = await locationRepository.listAvailableDriversFallback({
      lat,
      lng,
      radiusMeters: safeRadius,
      limit: safeLimit,
      vehicleType
    });

    return fallback.map((row) => ({
      driverId: toUser8(row.driver_id),
      distanceMeters: null,
      location: {
        lat: row.lat,
        lng: row.lng,
        recordedAt: row.recorded_at
      },
      vehicle: row.vehicle_type ? { type: row.vehicle_type, plate: row.plate_number } : null
    }));
  };

  try {
    const key = geoKey(vehicleType || 'all');
    const results = await redis.georadius(key, lng, lat, safeRadius, 'm', 'WITHDIST', 'COUNT', safeLimit);

    if (!Array.isArray(results)) {
      throw new Error('Redis geo query failed');
    }

    const filtered = [];
    for (const entry of results) {
      const [internalDriverId, distance] = entry;
      const online = await redis.get(driverOnlineKey(internalDriverId));
      const busy = await redis.get(driverBusyKey(internalDriverId));
      if (online !== ONLINE_STATUS.ONLINE) {
        continue;
      }
      if (busy) {
        continue;
      }

      const location = await getRedisLocation(internalDriverId);
      const vehicle = await vehicleRepository.getActiveVehicleByDriverId(internalDriverId);
      filtered.push({
        driverId: toUser8(internalDriverId),
        distanceMeters: distance ? Math.round(Number(distance)) : null,
        location: location
          ? {
              lat: location.lat,
              lng: location.lng,
              recordedAt: location.ts
            }
          : null,
        vehicle: vehicle
          ? {
              type: vehicle.vehicle_type,
              plate: vehicle.plate_number
            }
          : null
      });
    }

    if (filtered.length) {
      return filtered;
    }
  } catch (_err) {
    return fallbackToPostgres();
  }

  return fallbackToPostgres();
}

async function markBusy(driverId, rideId) {
  const driver = await driverRepository.getDriverById(driverId);
  if (!driver) {
    throw new ApiError(404, 'NOT_FOUND', 'Driver not found');
  }
  const internalDriverId = driver.id;

  if (driver.online_status === ONLINE_STATUS.BUSY) {
    const currentRide = await redis.get(driverBusyKey(internalDriverId));
    if (currentRide && currentRide === rideId) {
      return { driver: mapDriver(driver), rideId };
    }
  }

  const updated = await driverRepository.updateOnlineStatus(internalDriverId, [ONLINE_STATUS.ONLINE], ONLINE_STATUS.BUSY);
  if (!updated) {
    throw new ApiError(409, 'CONFLICT', 'Driver not available');
  }

  await redis.set(driverBusyKey(internalDriverId), rideId, 'EX', ONLINE_TTL_SECONDS);
  await updateOnlineRedis(internalDriverId, ONLINE_STATUS.BUSY);
  const vehicle = await vehicleRepository.getActiveVehicleByDriverId(internalDriverId);
  await removeFromGeo(internalDriverId, vehicle?.vehicle_type);

  monitoring.recordBusinessEvent({
    domain: 'driver',
    event: 'availability_changed',
    outcome: 'success',
    attributes: {
      status: 'busy'
    }
  });

  return { driver: mapDriver(updated), rideId };
}

async function markAvailable(driverId, rideId) {
  const driver = await driverRepository.getDriverById(driverId);
  if (!driver) {
    throw new ApiError(404, 'NOT_FOUND', 'Driver not found');
  }
  const internalDriverId = driver.id;

  const busyRide = await redis.get(driverBusyKey(internalDriverId));
  if (rideId && busyRide && busyRide !== rideId) {
    throw new ApiError(409, 'CONFLICT', 'Driver busy with another ride');
  }

  const updated = await driverRepository.updateOnlineStatus(internalDriverId, [ONLINE_STATUS.BUSY], ONLINE_STATUS.ONLINE);
  if (!updated && driver.online_status === ONLINE_STATUS.ONLINE) {
    await redis.del(driverBusyKey(internalDriverId));
    return { driver: mapDriver(driver) };
  }

  await redis.del(driverBusyKey(internalDriverId));
  await updateOnlineRedis(internalDriverId, ONLINE_STATUS.ONLINE);

  const location = await getRedisLocation(internalDriverId);
  if (location) {
    const vehicle = await vehicleRepository.getActiveVehicleByDriverId(internalDriverId);
    await updateGeo(internalDriverId, location.lat, location.lng, vehicle?.vehicle_type);
  }

  monitoring.recordBusinessEvent({
    domain: 'driver',
    event: 'availability_changed',
    outcome: 'success',
    attributes: {
      status: 'available'
    }
  });

  return { driver: mapDriver(updated || driver) };
}

async function bulkSnapshot(driverIds, fields) {
  const result = [];
  for (const driverId of driverIds) {
    const driver = await driverRepository.getDriverById(driverId);
    if (!driver) {
      result.push({ driverId, found: false });
      continue;
    }
    const internalDriverId = driver.id;
    const externalDriverId = toUser8(driver.id);

    const entry = { driverId: externalDriverId, found: true };
    if (!fields || fields.includes('status') || fields.includes('online_status')) {
      entry.status = driver.status;
      entry.onlineStatus = driver.online_status;
    }
    if (!fields || fields.includes('vehicle')) {
      const vehicle = await vehicleRepository.getActiveVehicleByDriverId(internalDriverId);
      entry.vehicle = vehicle
        ? {
            type: vehicle.vehicle_type,
            plate: vehicle.plate_number
          }
        : null;
    }
    if (!fields || fields.includes('location')) {
      const location = await getLocationSnapshot(internalDriverId);
      entry.location = location;
    }
    result.push(entry);
  }
  return result;
}

async function createDriverAdmin({ userId, fullName, phone }) {
  const existing = await driverRepository.getDriverByUserId(userId);
  if (existing) {
    return { driver: mapDriver(existing), created: false };
  }
  const driver = await driverRepository.createDriver({ userId, fullName, phone });
  return { driver: mapDriver(driver), created: true };
}

async function approveDriver(driverId) {
  const driver = await driverRepository.updateDriverStatus(driverId, DRIVER_STATUS.APPROVED);
  if (!driver) {
    throw new ApiError(404, 'NOT_FOUND', 'Driver not found');
  }
  return { driver: mapDriver(driver) };
}

async function suspendDriver(driverId) {
  const driver = await driverRepository.updateDriverStatus(driverId, DRIVER_STATUS.SUSPENDED);
  if (!driver) {
    throw new ApiError(404, 'NOT_FOUND', 'Driver not found');
  }
  const vehicle = await vehicleRepository.getActiveVehicleByDriverId(driver.id);
  await clearOnlineRedis(driver.id, vehicle?.vehicle_type);
  return { driver: mapDriver(driver) };
}

async function listDriversAdmin({ status, onlineStatus, page = 1, limit = 20 }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const rows = await driverRepository.listDrivers({
    status,
    onlineStatus,
    limit: safeLimit,
    offset
  });

  return {
    items: rows.map(mapDriver),
    page: safePage,
    limit: safeLimit
  };
}

async function getLocationSnapshot(driverId) {
  const redisLocation = await getRedisLocation(driverId);
  if (redisLocation) {
    return {
      lat: redisLocation.lat,
      lng: redisLocation.lng,
      heading: redisLocation.heading || null,
      speed: redisLocation.speed || null,
      accuracyM: redisLocation.accuracy || null,
      recordedAt: redisLocation.ts || null
    };
  }
  const persisted = await locationRepository.getLastLocationByDriverId(driverId);
  return persisted ? mapLocation(persisted) : null;
}

async function getRedisLocation(driverId) {
  try {
    const raw = await redis.get(driverLocationKey(driverId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_err) {
    return null;
  }
}

async function setRedisLocation(driverId, location) {
  try {
    await redis.set(driverLocationKey(driverId), JSON.stringify(location), 'EX', LOCATION_TTL_SECONDS);
  } catch (_err) {
    // ignore redis failure
  }
}

async function updateOnlineRedis(driverId, status) {
  try {
    await redis.set(driverOnlineKey(driverId), status, 'EX', ONLINE_TTL_SECONDS);
  } catch (_err) {
    // ignore redis failure
  }
}

async function clearOnlineRedis(driverId, vehicleType) {
  try {
    await redis.del(driverOnlineKey(driverId));
    await redis.del(driverBusyKey(driverId));
    await removeFromGeo(driverId, vehicleType);
  } catch (_err) {
    // ignore redis failure
  }
}

async function refreshOnlineRedis(driverId, status) {
  if (!status) return;
  await updateOnlineRedis(driverId, status);
}

async function refreshLocationTtl(driverId) {
  try {
    await redis.expire(driverLocationKey(driverId), LOCATION_TTL_SECONDS);
  } catch (_err) {
    // ignore
  }
}

async function updateGeo(driverId, lat, lng, vehicleType) {
  try {
    await redis.geoadd(geoKey('all'), lng, lat, driverId);
    if (vehicleType) {
      await redis.geoadd(geoKey(vehicleType), lng, lat, driverId);
    }
  } catch (_err) {
    // ignore
  }
}

async function removeFromGeo(driverId, vehicleType) {
  try {
    await redis.zrem(geoKey('all'), driverId);
    if (vehicleType) {
      await redis.zrem(geoKey(vehicleType), driverId);
    }
  } catch (_err) {
    // ignore
  }
}

async function enforceLocationRateLimit(driverId) {
  if (!Number.isFinite(MAX_LOCATION_RATE_PER_SEC) || MAX_LOCATION_RATE_PER_SEC <= 0) {
    return;
  }
  try {
    const key = locationRateKey(driverId);
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 1);
    }
    if (count > MAX_LOCATION_RATE_PER_SEC) {
      throw new ApiError(429, 'RATE_LIMITED', 'Too many location updates');
    }
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    // ignore redis failure
  }
}

module.exports = {
  getDriverMe,
  updateDriverProfile,
  getDriverKyc,
  submitDriverKyc,
  upsertVehicle,
  setOnline,
  setOnlineByDriverId,
  setOffline,
  setOfflineByDriverId,
  updateDriverLocation,
  heartbeat,
  getDriverInternal,
  getDriverProfileForCustomer,
  getLocationInternal,
  listAvailableDrivers,
  markBusy,
  markAvailable,
  bulkSnapshot,
  createDriverAdmin,
  approveDriver,
  suspendDriver,
  listDriversAdmin,
  listKycSubmissionsAdmin,
  approveKycSubmission,
  rejectKycSubmission
};

const express = require("express");
const crypto = require("crypto");
const { requireAuth } = require("../../../../libs/security/requireAuth");
const driversRepository = require("../repositories/driversRepository");
const idempotencyKeysRepository = require("../repositories/idempotencyKeysRepository");
const { canTransition } = require("../state/driverStateMachine");
const redis = require("../redis/client");
const {
  buildRedisKey,
  getCachedResponse,
  acquireLock,
  storeResponse,
  clearKey,
  waitForResponse,
} = require("../idempotency/idempotencyService");
const { publishMessage } = require("../messaging/producer");
const topics = require("../messaging/topics");
const Ajv = require("ajv");
const path = require("path");
const outboxEventsRepository = require("../repositories/outboxEventsRepository");
const authorizeDriverSelf = require("../middleware/authorizeDriverSelf");
const validateRequest = require("../middleware/validateRequest");
const {
  driverIdParamsSchema,
  listDriversQuerySchema,
  createDriverBodySchema,
  updateDriverBodySchema,
  statusOnlyBodySchema,
  updateLocationBodySchema,
} = require("../validation/driversSchemas");

const driverLocationSchema = require(path.resolve(
  __dirname,
  "../../../../contracts/events/schema-registry/driver.location.updated.json"
));
const ajv = new Ajv();
const validateDriverLocation = ajv.compile(driverLocationSchema);

const router = express.Router();

function parseCursor(cursor) {
  if (!cursor) {
    return null;
  }
  const decoded = Buffer.from(cursor, "base64").toString("utf8");
  const [createdAt, id] = decoded.split("|");
  if (!createdAt || !id) {
    return null;
  }
  return { createdAt, id };
}

function buildCursor(row) {
  if (!row || !row.created_at || !row.id) {
    return null;
  }
  const payload = `${row.created_at.toISOString()}|${row.id}`;
  return Buffer.from(payload, "utf8").toString("base64");
}

function mapDriverInput(body, userId) {
  return {
    user_id: userId,
    license_number: body.licenseNumber,
    license_expiry_date: body.licenseExpiryDate,
    vehicle_type: body.vehicleType,
    vehicle_brand: body.vehicleBrand,
    vehicle_model: body.vehicleModel,
    vehicle_year: body.vehicleYear,
    vehicle_color: body.vehicleColor,
    vehicle_plate: body.vehiclePlate,
    status: body.status,
    current_latitude: body.currentLatitude,
    current_longitude: body.currentLongitude,
    current_location_updated_at: body.currentLocationUpdatedAt,
    is_verified: body.isVerified,
    verification_notes: body.verificationNotes,
    verified_at: body.verifiedAt,
    verified_by: body.verifiedBy,
    rating_avg: body.ratingAvg,
    total_ratings: body.totalRatings,
    total_trips: body.totalTrips,
    total_earnings: body.totalEarnings,
  };
}

function mapDriverUpdate(body) {
  return {
    license_number: body.licenseNumber,
    license_expiry_date: body.licenseExpiryDate,
    vehicle_type: body.vehicleType,
    vehicle_brand: body.vehicleBrand,
    vehicle_model: body.vehicleModel,
    vehicle_year: body.vehicleYear,
    vehicle_color: body.vehicleColor,
    vehicle_plate: body.vehiclePlate,
    current_latitude: body.currentLatitude,
    current_longitude: body.currentLongitude,
    current_location_updated_at: body.currentLocationUpdatedAt,
    is_verified: body.isVerified,
    verification_notes: body.verificationNotes,
    verified_at: body.verifiedAt,
    verified_by: body.verifiedBy,
    rating_avg: body.ratingAvg,
    total_ratings: body.totalRatings,
    total_trips: body.totalTrips,
    total_earnings: body.totalEarnings,
  };
}

function toApiDriver(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    userId: row.user_id,
    licenseNumber: row.license_number,
    licenseExpiryDate: row.license_expiry_date,
    vehicleType: row.vehicle_type,
    vehicleBrand: row.vehicle_brand,
    vehicleModel: row.vehicle_model,
    vehicleYear: row.vehicle_year,
    vehicleColor: row.vehicle_color,
    vehiclePlate: row.vehicle_plate,
    status: row.status,
    statusUpdatedAt: row.status_updated_at,
    currentLatitude: row.current_latitude,
    currentLongitude: row.current_longitude,
    currentLocationUpdatedAt: row.current_location_updated_at,
    isVerified: row.is_verified,
    verificationNotes: row.verification_notes,
    verifiedAt: row.verified_at,
    verifiedBy: row.verified_by,
    ratingAvg: row.rating_avg,
    totalRatings: row.total_ratings,
    totalTrips: row.total_trips,
    totalEarnings: row.total_earnings,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function hashSha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

router.post(
  "/",
  requireAuth,
  validateRequest({ body: createDriverBodySchema }),
  async (req, res, next) => {
  let lockKey = null;
  try {
    const idempotencyKey = req.headers["idempotency-key"];
    if (!idempotencyKey) {
      const error = new Error("Idempotency-Key header is required");
      error.statusCode = 400;
      error.code = "IDEMPOTENCY_KEY_REQUIRED";
      throw error;
    }

    const requestHash = hashSha256(
      JSON.stringify({
        method: req.method,
        path: req.originalUrl,
        body: req.body,
      })
    );
    const keyHash = hashSha256(String(idempotencyKey));
    lockKey = buildRedisKey({ userId: req.userId, idempotencyKey });
    const cached = await getCachedResponse(redis, lockKey);
    if (cached && !cached.pending) {
      return res.status(cached.response.status).json(cached.response.body);
    }

    const acquired = await acquireLock(redis, lockKey);
    if (!acquired) {
      const response = await waitForResponse(redis, lockKey);
      if (response) {
        return res.status(response.status).json(response.body);
      }
      const error = new Error("Idempotency key in progress");
      error.statusCode = 409;
      error.code = "IDEMPOTENCY_IN_PROGRESS";
      throw error;
    }

    const existing = await idempotencyKeysRepository.getIdempotencyKey(keyHash);
    if (existing) {
      if (existing.request_hash !== requestHash) {
        const error = new Error("Idempotency key reuse with different request");
        error.statusCode = 409;
        error.code = "IDEMPOTENCY_CONFLICT";
        throw error;
      }
      return res.status(existing.response_status).json(existing.response_body);
    }

    const driver = await driversRepository.createDriver(
      mapDriverInput(req.body, req.userId)
    );
    const responseBody = { data: toApiDriver(driver) };

    await idempotencyKeysRepository.insertIdempotencyKey({
      keyHash,
      requestHash,
      responseStatus: 201,
      responseBody,
      responseHeaders: {},
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await storeResponse(redis, lockKey, {
      status: 201,
      body: responseBody,
      headers: {},
    });
    lockKey = null;
    return res.status(201).json(responseBody);
  } catch (err) {
    if (lockKey) {
      try {
        await clearKey(redis, lockKey);
      } catch (clearErr) {
        console.warn("[driver-service][idempotency] clear key failed", clearErr);
      }
    }
    return next(err);
  }
  }
);

router.get(
  "/",
  requireAuth,
  validateRequest({ query: listDriversQuerySchema }),
  async (req, res, next) => {
  try {
    const sort = req.query.sort || "-createdAt";
    const sortDirection = sort === "createdAt" ? "ASC" : "DESC";
    const cursor = parseCursor(req.query.cursor);
    const limit = Number(req.query.limit) || 20;

    const drivers = await driversRepository.listDrivers({
      userId: req.query.userId,
      status: req.query.status,
      vehicleType: req.query.vehicleType,
      limit,
      cursorCreatedAt: cursor ? cursor.createdAt : null,
      cursorId: cursor ? cursor.id : null,
      sortDirection,
    });

    const data = drivers.map(toApiDriver);
    const nextCursor = drivers.length === Math.min(limit, 100)
      ? buildCursor(drivers[drivers.length - 1])
      : null;

    return res.json({
      data,
      pageInfo: {
        limit: Math.min(limit, 100),
        cursor: nextCursor,
        sort,
      },
    });
  } catch (err) {
    return next(err);
  }
  }
);

router.get(
  "/:id",
  requireAuth,
  validateRequest({ params: driverIdParamsSchema }),
  async (req, res, next) => {
  try {
    const driver = await driversRepository.getDriverById(req.params.id);
    if (!driver) {
      const error = new Error("Driver not found");
      error.statusCode = 404;
      error.code = "NOT_FOUND";
      throw error;
    }
    return res.json({ data: toApiDriver(driver) });
  } catch (err) {
    return next(err);
  }
  }
);

async function handlePatchDriver(req, res, next) {
  try {
    const driverId = req.params.id;
    const currentDriver = await driversRepository.getDriverById(driverId);
    if (!currentDriver) {
      const error = new Error("Driver not found");
      error.statusCode = 404;
      error.code = "NOT_FOUND";
      throw error;
    }

    let driver = currentDriver;
    if (req.body.status) {
      const fromState = currentDriver.status;
      const toState = req.body.status;
      if (!canTransition(fromState, toState)) {
        const error = new Error("Invalid state transition");
        error.statusCode = 409;
        error.code = "INVALID_STATE_TRANSITION";
        error.details = { from: fromState, to: toState };
        throw error;
      }

      req.logger.info(
        {
          driverId,
          fromState,
          toState,
        },
        "driver status transition"
      );

      driver = await driversRepository.updateDriverStatus(driverId, toState, {
        latitude: req.body.currentLatitude,
        longitude: req.body.currentLongitude,
      });
    }

    const updates = mapDriverUpdate(req.body);
    const hasUpdates = Object.values(updates).some((value) => value !== undefined);
    if (hasUpdates) {
      driver = await driversRepository.updateDriverById(driverId, updates);
    }

    return res.json({ data: toApiDriver(driver) });
  } catch (err) {
    return next(err);
  }
}

router.patch(
  "/:id",
  requireAuth,
  authorizeDriverSelf,
  validateRequest({ params: driverIdParamsSchema, body: updateDriverBodySchema }),
  handlePatchDriver
);

router.patch(
  "/:id/status",
  requireAuth,
  authorizeDriverSelf,
  validateRequest({ params: driverIdParamsSchema, body: statusOnlyBodySchema }),
  handlePatchDriver
);

router.patch(
  "/:id/location",
  requireAuth,
  authorizeDriverSelf,
  validateRequest({ params: driverIdParamsSchema, body: updateLocationBodySchema }),
  async (req, res, next) => {
  try {
    const driverId = req.params.id;
    const updated = await driversRepository.updateDriverLocation(driverId, {
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      recordedAt: new Date(),
    });
    if (!updated) {
      const error = new Error("Driver not found");
      error.statusCode = 404;
      error.code = "NOT_FOUND";
      throw error;
    }

    const payload = {
      driverId,
      latitude: updated.current_latitude,
      longitude: updated.current_longitude,
      recordedAt: updated.current_location_updated_at,
    };

    const valid = validateDriverLocation(payload);
    if (!valid) {
      const error = new Error("Event payload validation failed");
      error.statusCode = 500;
      error.code = "EVENT_VALIDATION_FAILED";
      error.details = validateDriverLocation.errors;
      throw error;
    }

    const eventId = req.headers["x-event-id"] || crypto.randomUUID();
    const envelope = {
      eventId,
      traceId: req.traceId,
      occurredAt: new Date().toISOString(),
      type: topics.DriverLocationUpdated,
      version: "1.0.0",
      payload,
    };

    const outboxEvent = await outboxEventsRepository.insertOutboxEvent({
      eventId,
      traceId: req.traceId,
      occurredAt: envelope.occurredAt,
      type: envelope.type,
      version: envelope.version,
      payload: envelope.payload,
      topic: topics.DriverLocationUpdated,
      partitionKey: driverId,
    });

    if (!outboxEvent || outboxEvent.published) {
      return res.json({ data: toApiDriver(updated) });
    }

    try {
      await publishMessage({
        topic: topics.DriverLocationUpdated,
        key: driverId,
        value: envelope,
        headers: { "x-trace-id": req.traceId },
      });
      await outboxEventsRepository.markOutboxEventPublished(eventId);
    } catch (err) {
      await outboxEventsRepository.markOutboxEventFailed(eventId, err.message);
      try {
        await publishMessage({
          topic: `${topics.DriverLocationUpdated}.dlq`,
          key: driverId,
          value: {
            error: err.message,
            envelope,
          },
          headers: { "x-trace-id": req.traceId },
        });
      } catch (dlqErr) {
        console.error(
          "[driver-service][kafka] TODO: ensure DLQ topic exists",
          dlqErr
        );
      }
      throw err;
    }

    return res.json({ data: toApiDriver(updated) });
  } catch (err) {
    return next(err);
  }
  }
);

router.delete(
  "/:id",
  requireAuth,
  validateRequest({ params: driverIdParamsSchema }),
  async (req, res, next) => {
  try {
    const driver = await driversRepository.getDriverById(req.params.id);
    if (!driver) {
      const error = new Error("Driver not found");
      error.statusCode = 404;
      error.code = "NOT_FOUND";
      throw error;
    }
    await driversRepository.deleteDriverById(req.params.id);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
  }
);

module.exports = router;

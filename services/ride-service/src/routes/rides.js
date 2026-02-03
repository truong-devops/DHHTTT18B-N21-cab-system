const express = require("express");
const crypto = require("crypto");
const {
  createRide,
  getRideById,
  listRides,
  updateRideFields,
  updateRideStatus,
  addStatusHistory
} = require("../repository/rideRepository");
const {
  getByKey,
  createKey,
  setResponse
} = require("../repository/idempotencyRepository");
const { requireAuth } = require("../middleware/auth");
const { ApiError } = require("../utils/errors");
const { asyncHandler } = require("../utils/asyncHandler");
const { encodeCursor, decodeCursor } = require("@libs/http");
const { validateRequest } = require("../middleware/validateRequest");
const {
  normalizeStatus,
  isValidTransition
} = require("../domain/rideStateMachine");
const {
  buildIdempotencyKey,
  buildLockKey,
  getCachedResponse,
  saveCachedResponse,
  acquireLock,
  releaseLock
} = require("../idempotency/store");

const router = express.Router();

router.use(requireAuth);

function toRideResponse(row) {
  return {
    id: row.id,
    externalRideId: row.external_ride_id,
    bookingId: row.booking_id,
    riderId: row.rider_id,
    driverId: row.driver_id,
    pickupLat: row.pickup_lat,
    pickupLng: row.pickup_lng,
    dropoffLat: row.dropoff_lat,
    dropoffLng: row.dropoff_lng,
    status: row.status,
    statusUpdatedAt: row.status_updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

router.post(
  "/",
  validateRequest({
    bodySchema: {
      required: ["pickupLat", "pickupLng"],
      properties: {
        pickupLat: { type: "number" },
        pickupLng: { type: "number" },
        dropoffLat: { type: "number" },
        dropoffLng: { type: "number" },
        bookingId: { type: "string" },
        driverId: { type: "string" },
        status: { type: "string" }
      }
    },
    custom: (req, errors) => {
      if (!req.header("Idempotency-Key")) {
        errors.push({
          path: "headers.Idempotency-Key",
          message: "is required"
        });
      }
    }
  }),
  asyncHandler(async (req, res) => {
    const idempotencyKey = req.header("Idempotency-Key");

    const routeKey = "rides:create";
    const requestHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(req.body || {}))
      .digest("hex");
    const cacheKey = buildIdempotencyKey({
      routeKey,
      userId: req.userId,
      idempotencyKey
    });
    const lockKey = buildLockKey({
      routeKey,
      userId: req.userId,
      idempotencyKey
    });

    const cached = await getCachedResponse(cacheKey);
    if (cached) {
      if (
        cached.requestHash &&
        cached.requestHash !== requestHash
      ) {
        throw new ApiError(
          409,
          "CONFLICT",
          "Idempotency key reuse with different request"
        );
      }
      if (cached.headers) {
        Object.entries(cached.headers).forEach(([key, value]) => {
          const headerKey = String(key).toLowerCase();
          if (
            headerKey === "x-trace-id" ||
            headerKey === "x-request-id"
          ) {
            return;
          }
          if (value) {
            res.setHeader(key, value);
          }
        });
      }
      return res.status(cached.status).json(cached.body);
    }

    let lockAcquired = false;
    lockAcquired = await acquireLock(lockKey);
    if (!lockAcquired) {
      throw new ApiError(
        409,
        "IDEMPOTENCY_IN_PROGRESS",
        "Idempotency key is being processed"
      );
    }

    let responseBody;
    let responseStatus = 201;

    try {
      const existing = await getByKey({
        routeKey,
        userId: req.userId,
        idempotencyKey
      });
      if (existing && existing.request_hash !== requestHash) {
        throw new ApiError(
          409,
          "CONFLICT",
          "Idempotency key reuse with different request"
        );
      }
      if (existing && existing.response_status) {
        const responseHeaders =
          existing.response_headers || {};
        Object.entries(responseHeaders).forEach(([key, value]) => {
          const headerKey = String(key).toLowerCase();
          if (
            headerKey === "x-trace-id" ||
            headerKey === "x-request-id"
          ) {
            return;
          }
          if (value) {
            res.setHeader(key, value);
          }
        });

        responseBody = existing.response_body;
        await saveCachedResponse(cacheKey, {
          status: existing.response_status,
          headers: responseHeaders,
          body: responseBody,
          requestHash,
          createdAt: new Date().toISOString()
        });

        return res
          .status(existing.response_status)
          .json(responseBody);
      }
      if (existing && !existing.response_status) {
        throw new ApiError(
          409,
          "CONFLICT",
          "Idempotency key is being processed"
        );
      }

      await createKey({
        routeKey,
        userId: req.userId,
        idempotencyKey,
        requestHash
      });

      const ride = await createRide({
        externalRideId: crypto.randomUUID(),
        bookingId: req.body.bookingId,
        riderId: req.userId,
        driverId: req.body.driverId,
        pickupLat: req.body.pickupLat,
        pickupLng: req.body.pickupLng,
        dropoffLat: req.body.dropoffLat,
        dropoffLng: req.body.dropoffLng,
        status: req.body.status || "requested",
        traceId: req.traceId
      });

      await addStatusHistory({
        rideId: ride.id,
        fromStatus: null,
        toStatus: ride.status,
        actorId: req.userId,
        traceId: req.traceId
      });

      responseBody = { data: toRideResponse(ride) };

      const responseHeaders = {
        "content-type": "application/json",
        "x-trace-id": req.traceId,
        "x-request-id": req.requestId
      };

      await setResponse({
        routeKey,
        userId: req.userId,
        idempotencyKey,
        responseStatus,
        responseHeaders,
        responseBody
      });

      await saveCachedResponse(cacheKey, {
        status: responseStatus,
        headers: responseHeaders,
        body: responseBody,
        requestHash,
        createdAt: new Date().toISOString()
      });
    } finally {
      if (lockAcquired) {
        await releaseLock(lockKey);
      }
    }

    return res.status(responseStatus).json(responseBody);
  })
);

router.get(
  "/:id",
  validateRequest({
    paramsSchema: {
      required: ["id"],
      properties: {
        id: { type: "string" }
      }
    }
  }),
  asyncHandler(async (req, res) => {
    const ride = await getRideById(req.params.id);
    if (!ride) {
      throw new ApiError(404, "NOT_FOUND", "Ride not found");
    }

    return res.json({ data: toRideResponse(ride) });
  })
);

router.get(
  "/",
  validateRequest({
    querySchema: {
      properties: {
        status: { type: "string" },
        riderId: { type: "string" },
        limit: { type: "string" },
        cursor: { type: "string" },
        sort: { type: "string" }
      }
    },
    custom: (req, errors) => {
      const sort = req.query.sort || "-createdAt";
      if (!["-createdAt", "createdAt"].includes(sort)) {
        errors.push({
          path: "query.sort",
          message: "must be createdAt or -createdAt"
        });
      }

      let cursor = null;
      if (req.query.cursor) {
        cursor = decodeCursor(req.query.cursor);
        if (!cursor) {
          errors.push({
            path: "query.cursor",
            message: "is invalid"
          });
        }
      }

      const hasLimit = req.query.limit !== undefined;
      const limitRaw = Number(req.query.limit || 20);
      const limit = Number.isFinite(limitRaw) ? limitRaw : 20;
      if (hasLimit && !Number.isFinite(limitRaw)) {
        errors.push({
          path: "query.limit",
          message: "must be a number"
        });
      }
      if (limit < 1 || limit > 100) {
        errors.push({
          path: "query.limit",
          message: "must be between 1 and 100"
        });
      }

      req.pagination = {
        limit: Math.min(Math.max(limit, 1), 100),
        cursor,
        sort
      };
    }
  }),
  asyncHandler(async (req, res) => {
    const { limit, cursor, sort } = req.pagination;

    const rows = await listRides({
      limit,
      cursor,
      status: req.query.status,
      riderId: req.query.riderId || req.userId,
      sort: sort === "-createdAt" ? "-created_at" : "created_at"
    });

    const data = rows.map(toRideResponse);
    const last = rows[rows.length - 1];
    const nextCursor =
      rows.length === limit && last
        ? encodeCursor({
            createdAt: last.created_at,
            id: last.id
          })
        : null;

    return res.json({ data, nextCursor });
  })
);

router.patch(
  "/:id",
  validateRequest({
    paramsSchema: {
      required: ["id"],
      properties: {
        id: { type: "string" }
      }
    },
    bodySchema: {
      properties: {
        driverId: { type: "string" },
        pickupLat: { type: "number" },
        pickupLng: { type: "number" },
        dropoffLat: { type: "number" },
        dropoffLng: { type: "number" },
        status: { type: "string" },
        statusReason: { type: "string" }
      }
    },
    custom: (req, errors) => {
      const hasUpdatableFields = [
        "driverId",
        "pickupLat",
        "pickupLng",
        "dropoffLat",
        "dropoffLng",
        "status"
      ].some((field) => req.body?.[field] !== undefined);
      if (!hasUpdatableFields) {
        errors.push({
          path: "body",
          message: "at least one field is required"
        });
      }
    }
  }),
  asyncHandler(async (req, res) => {
    let ride = await getRideById(req.params.id);
    if (!ride) {
      throw new ApiError(404, "NOT_FOUND", "Ride not found");
    }

    let fromStatus = null;
    let toStatus = null;
    if (req.body.status) {
      fromStatus = normalizeStatus(ride.status);
      toStatus = normalizeStatus(req.body.status);
      const reason = req.body.statusReason || null;
      const actor = req.userId;
      if (!isValidTransition(fromStatus, toStatus)) {
        console.log(
          `[ride-service] transition rejected traceId=${req.traceId} rideId=${ride.id} ${fromStatus}->${toStatus} actor=${actor} reason=${reason}`
        );
        throw new ApiError(
          409,
          "INVALID_STATE_TRANSITION",
          `Invalid transition from ${fromStatus} to ${toStatus}`
        );
      }
      console.log(
        `[ride-service] transition traceId=${req.traceId} rideId=${ride.id} ${fromStatus}->${toStatus} actor=${actor} reason=${reason}`
      );
    }

    if (
      req.body.driverId !== undefined ||
      req.body.pickupLat !== undefined ||
      req.body.pickupLng !== undefined ||
      req.body.dropoffLat !== undefined ||
      req.body.dropoffLng !== undefined
    ) {
      ride = await updateRideFields(req.params.id, {
        driverId: req.body.driverId,
        pickupLat: req.body.pickupLat,
        pickupLng: req.body.pickupLng,
        dropoffLat: req.body.dropoffLat,
        dropoffLng: req.body.dropoffLng
      });
    }

    if (req.body.status) {
      ride = await updateRideStatus({
        id: req.params.id,
        status: String(req.body.status).toLowerCase(),
        fromStatus,
        reason: req.body.statusReason || null,
        actorId: req.userId,
        traceId: req.traceId
      });
    }

    return res.json({ data: toRideResponse(ride) });
  })
);

router.delete(
  "/:id",
  validateRequest({
    paramsSchema: {
      required: ["id"],
      properties: {
        id: { type: "string" }
      }
    }
  }),
  asyncHandler(async (req, res) => {
    const ride = await getRideById(req.params.id);

    if (!ride) {
      throw new ApiError(404, "NOT_FOUND", "Ride not found");
    }

    const fromStatus = normalizeStatus(ride.status);
    const toStatus = "CANCELLED";
    if (!isValidTransition(fromStatus, toStatus)) {
      throw new ApiError(
        409,
        "INVALID_STATE_TRANSITION",
        `Invalid transition from ${fromStatus} to ${toStatus}`
      );
    }

    console.log(
      `[ride-service] transition traceId=${req.traceId} rideId=${ride.id} ${fromStatus}->${toStatus}`
    );

    const updated = await updateRideStatus({
      id: req.params.id,
      status: "cancelled",
      fromStatus,
      reason: req.body?.reason || null,
      actorId: req.userId,
      traceId: req.traceId
    });

    return res.json({ data: toRideResponse(updated) });
  })
);

module.exports = router;

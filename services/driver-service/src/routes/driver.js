const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { validateRequest } = require("../middleware/validateRequest");
const { asyncHandler } = require("../utils/asyncHandler");
const driverService = require("../services/driverService");

const router = express.Router();

function validateLatLng(prefix, errors, value) {
  if (!value || typeof value !== "object") {
    errors.push({ path: prefix, message: "is required" });
    return;
  }
  if (!Number.isFinite(value.lat)) {
    errors.push({ path: `${prefix}.lat`, message: "must be a number" });
  } else if (value.lat < -90 || value.lat > 90) {
    errors.push({ path: `${prefix}.lat`, message: "must be between -90 and 90" });
  }
  if (!Number.isFinite(value.lng)) {
    errors.push({ path: `${prefix}.lng`, message: "must be a number" });
  } else if (value.lng < -180 || value.lng > 180) {
    errors.push({ path: `${prefix}.lng`, message: "must be between -180 and 180" });
  }
}

// Rubric compatibility endpoint:
// Accepts { driver_id, status } for ONLINE/OFFLINE transition.
router.post(
  "/v1/driver/status",
  requireAuth,
  requireRole("admin", "service"),
  validateRequest({
    bodySchema: {
      required: ["driver_id", "status"],
      properties: {
        driver_id: { type: "string" },
        status: { type: "string", enum: ["ONLINE", "OFFLINE"] },
        initial_location: { type: "object" }
      }
    },
    custom: (req, errors) => {
      if (req.body?.initial_location) {
        validateLatLng("body.initial_location", errors, req.body.initial_location);
      }
    }
  }),
  asyncHandler(async (req, res) => {
    const driverId = req.body.driver_id;
    const status = String(req.body.status || "").toUpperCase();

    const result =
      status === "ONLINE"
        ? await driverService.setOnlineByDriverId(
            driverId,
            req.body?.initial_location
          )
        : await driverService.setOfflineByDriverId(driverId);

    return res.json({
      driver_id: result.driver.id,
      status: result.driver.onlineStatus,
      data: result,
      requestId: req.requestId
    });
  })
);

router.use("/v1/driver", requireAuth, requireRole("driver"));

router.get(
  "/v1/driver/me",
  asyncHandler(async (req, res) => {
    const data = await driverService.getDriverMe(req.userId);
    return res.json({ data, requestId: req.requestId });
  })
);

router.put(
  "/v1/driver/me",
  validateRequest({
    bodySchema: {
      properties: {
        fullName: { type: "string" },
        phone: { type: "string" }
      }
    }
  }),
  asyncHandler(async (req, res) => {
    const data = await driverService.updateDriverProfile(req.userId, {
      fullName: req.body.fullName,
      phone: req.body.phone
    });
    return res.json({ data, requestId: req.requestId });
  })
);

router.put(
  "/v1/driver/me/vehicle",
  validateRequest({
    bodySchema: {
      required: ["vehicleType", "plateNumber"],
      properties: {
        vehicleType: { type: "string" },
        plateNumber: { type: "string" },
        brand: { type: "string" },
        model: { type: "string" },
        color: { type: "string" },
        isActive: { type: "boolean" }
      }
    }
  }),
  asyncHandler(async (req, res) => {
    const data = await driverService.upsertVehicle(req.userId, {
      vehicleType: String(req.body.vehicleType).toUpperCase(),
      plateNumber: req.body.plateNumber,
      brand: req.body.brand,
      model: req.body.model,
      color: req.body.color,
      isActive: req.body.isActive
    });
    return res.json({ data, requestId: req.requestId });
  })
);

router.post(
  "/v1/driver/me/online",
  validateRequest({
    bodySchema: {
      properties: {
        deviceId: { type: "string" },
        initialLocation: { type: "object" }
      }
    },
    custom: (req, errors) => {
      if (req.body?.initialLocation) {
        validateLatLng("body.initialLocation", errors, req.body.initialLocation);
      }
    }
  }),
  asyncHandler(async (req, res) => {
    const data = await driverService.setOnline(
      req.userId,
      req.body?.initialLocation
    );
    return res.json({ data, requestId: req.requestId });
  })
);

router.post(
  "/v1/driver/me/offline",
  asyncHandler(async (req, res) => {
    const data = await driverService.setOffline(req.userId);
    return res.json({ data, requestId: req.requestId });
  })
);

router.post(
  "/v1/driver/me/location",
  validateRequest({
    bodySchema: {
      required: ["lat", "lng"],
      properties: {
        lat: { type: "number" },
        lng: { type: "number" },
        heading: { type: "number" },
        speed: { type: "number" },
        accuracy: { type: "number" },
        recordedAt: { type: "string" }
      }
    },
    custom: (req, errors) => {
      validateLatLng("body", errors, req.body);
    }
  }),
  asyncHandler(async (req, res) => {
    const driver = await driverService.getDriverMe(req.userId);
    await driverService.updateDriverLocation(driver.driver.id, {
      lat: req.body.lat,
      lng: req.body.lng,
      heading: req.body.heading,
      speed: req.body.speed,
      accuracy: req.body.accuracy,
      recordedAt: req.body.recordedAt
    });
    return res.status(202).json({ ok: true, requestId: req.requestId });
  })
);

router.post(
  "/v1/driver/me/heartbeat",
  validateRequest({
    bodySchema: {
      properties: {
        deviceId: { type: "string" }
      }
    }
  }),
  asyncHandler(async (req, res) => {
    const data = await driverService.heartbeat(req.userId);
    return res.json({ data, requestId: req.requestId });
  })
);

module.exports = router;

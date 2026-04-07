const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const { asyncHandler } = require('../utils/asyncHandler');
const driverService = require('../services/driverService');

const router = express.Router();

router.use('/v1/internal', requireAuth, requireRole('service', 'admin'));

router.get(
  '/v1/internal/drivers/available',
  validateRequest({
    custom: (req, errors) => {
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);
      if (!Number.isFinite(lat)) {
        errors.push({ path: 'query.lat', message: 'must be a number' });
      }
      if (!Number.isFinite(lng)) {
        errors.push({ path: 'query.lng', message: 'must be a number' });
      }
      if (req.query.radiusMeters !== undefined) {
        const radius = Number(req.query.radiusMeters);
        if (!Number.isFinite(radius)) {
          errors.push({ path: 'query.radiusMeters', message: 'must be a number' });
        }
      }
      if (req.query.limit !== undefined) {
        const limit = Number(req.query.limit);
        if (!Number.isFinite(limit)) {
          errors.push({ path: 'query.limit', message: 'must be a number' });
        }
      }
    }
  }),
  asyncHandler(async (req, res) => {
    const data = await driverService.listAvailableDrivers({
      lat: Number(req.query.lat),
      lng: Number(req.query.lng),
      radiusMeters: req.query.radiusMeters,
      limit: req.query.limit,
      vehicleType: req.query.vehicleType ? String(req.query.vehicleType).toUpperCase() : null
    });
    return res.json({ data, requestId: req.requestId });
  })
);

router.get(
  '/v1/internal/drivers/:driverId/location',
  validateRequest({
    paramsSchema: {
      required: ['driverId'],
      properties: { driverId: { type: 'string' } }
    }
  }),
  asyncHandler(async (req, res) => {
    const data = await driverService.getLocationInternal(req.params.driverId);
    return res.json({ data, requestId: req.requestId });
  })
);

router.get(
  '/v1/internal/drivers/:driverId',
  validateRequest({
    paramsSchema: {
      required: ['driverId'],
      properties: { driverId: { type: 'string' } }
    }
  }),
  asyncHandler(async (req, res) => {
    const data = await driverService.getDriverInternal(req.params.driverId);
    return res.json({ data, requestId: req.requestId });
  })
);

router.post(
  '/v1/internal/drivers/:driverId/mark-busy',
  validateRequest({
    paramsSchema: {
      required: ['driverId'],
      properties: { driverId: { type: 'string' } }
    },
    bodySchema: {
      required: ['rideId'],
      properties: { rideId: { type: 'string' } }
    }
  }),
  asyncHandler(async (req, res) => {
    const data = await driverService.markBusy(req.params.driverId, req.body.rideId);
    return res.json({ data, requestId: req.requestId });
  })
);

router.post(
  '/v1/internal/drivers/:driverId/mark-available',
  validateRequest({
    paramsSchema: {
      required: ['driverId'],
      properties: { driverId: { type: 'string' } }
    },
    bodySchema: {
      properties: { rideId: { type: 'string' } }
    }
  }),
  asyncHandler(async (req, res) => {
    const data = await driverService.markAvailable(req.params.driverId, req.body.rideId);
    return res.json({ data, requestId: req.requestId });
  })
);

router.post(
  '/v1/internal/drivers/bulk',
  validateRequest({
    custom: (req, errors) => {
      if (!Array.isArray(req.body?.driverIds)) {
        errors.push({ path: 'body.driverIds', message: 'must be an array' });
      }
      if (req.body?.fields && !Array.isArray(req.body.fields)) {
        errors.push({ path: 'body.fields', message: 'must be an array' });
      }
    }
  }),
  asyncHandler(async (req, res) => {
    const data = await driverService.bulkSnapshot(req.body.driverIds, req.body.fields);
    return res.json({ data, requestId: req.requestId });
  })
);

module.exports = router;

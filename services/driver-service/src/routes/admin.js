const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const { asyncHandler } = require('../utils/asyncHandler');
const driverService = require('../services/driverService');

const router = express.Router();

router.use('/v1/admin', requireAuth, requireRole('admin', 'service'));

router.post(
  '/v1/admin/drivers',
  validateRequest({
    bodySchema: {
      required: ['userId'],
      properties: {
        userId: { type: 'string' },
        fullName: { type: 'string' },
        phone: { type: 'string' }
      }
    }
  }),
  asyncHandler(async (req, res) => {
    const data = await driverService.createDriverAdmin({
      userId: req.body.userId,
      fullName: req.body.fullName,
      phone: req.body.phone
    });
    return res.status(data.created ? 201 : 200).json({
      data,
      requestId: req.requestId
    });
  })
);

router.patch(
  '/v1/admin/drivers/:driverId/approve',
  validateRequest({
    paramsSchema: {
      required: ['driverId'],
      properties: { driverId: { type: 'string' } }
    }
  }),
  asyncHandler(async (req, res) => {
    const data = await driverService.approveDriver(req.params.driverId);
    return res.json({ data, requestId: req.requestId });
  })
);

router.patch(
  '/v1/admin/drivers/:driverId/suspend',
  validateRequest({
    paramsSchema: {
      required: ['driverId'],
      properties: { driverId: { type: 'string' } }
    }
  }),
  asyncHandler(async (req, res) => {
    const data = await driverService.suspendDriver(req.params.driverId);
    return res.json({ data, requestId: req.requestId });
  })
);

router.get(
  '/v1/admin/drivers',
  validateRequest({
    custom: (req, errors) => {
      if (req.query.page !== undefined) {
        const page = Number(req.query.page);
        if (!Number.isFinite(page)) {
          errors.push({ path: 'query.page', message: 'must be a number' });
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
    const data = await driverService.listDriversAdmin({
      status: req.query.status,
      onlineStatus: req.query.online,
      page: req.query.page,
      limit: req.query.limit
    });
    return res.json({ data, requestId: req.requestId });
  })
);

module.exports = router;

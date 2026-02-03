const express = require("express");
const { ApiError } = require("../utils/errors");
const { asyncHandler } = require("../utils/asyncHandler");
const {
  createNotification,
  createBatch,
  getNotificationById,
  retryNotification,
  cancelNotification
} = require("../services/notificationService");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

function hasRole(req, roles) {
  return req.user?.roles?.some((role) => roles.includes(role));
}

router.post(
  "/v1/notifications",
  requireAuth,
  requireRole("service", "admin"),
  asyncHandler(async (req, res) => {
    const context = {
      traceId: req.traceId,
      requestId: req.requestId,
      correlationId: req.correlationId,
      forwardedFor: req.forwardedFor,
      realIp: req.realIp,
      authorization: req.header("authorization"),
      userId: req.user?.id
    };

    const result = await createNotification(req.body, context);
    return res.status(result.created ? 201 : 200).json({
      id: result.notification.id,
      status: result.notification.status,
      perChannelStatus: result.notification.perChannelStatus,
      requestId: req.requestId,
      created: result.created
    });
  })
);

router.post(
  "/v1/notifications/batch",
  requireAuth,
  requireRole("service", "admin"),
  asyncHandler(async (req, res) => {
    const context = {
      traceId: req.traceId,
      requestId: req.requestId,
      correlationId: req.correlationId,
      forwardedFor: req.forwardedFor,
      realIp: req.realIp,
      authorization: req.header("authorization"),
      userId: req.user?.id
    };

    const results = await createBatch(req.body, context);
    return res.status(207).json({ results, requestId: req.requestId });
  })
);

router.get(
  "/v1/notifications/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const notification = await getNotificationById(req.params.id);
    const allowed = hasRole(req, ["service", "admin"]);
    if (!allowed && notification.userId !== req.user?.id) {
      throw new ApiError(403, "FORBIDDEN", "Forbidden");
    }
    return res.json({ data: notification, requestId: req.requestId });
  })
);

router.post(
  "/v1/notifications/:id/retry",
  requireAuth,
  requireRole("service", "admin"),
  asyncHandler(async (req, res) => {
    const notification = await retryNotification(req.params.id);
    return res.json({ data: notification, requestId: req.requestId });
  })
);

router.patch(
  "/v1/notifications/:id/cancel",
  requireAuth,
  requireRole("service", "admin"),
  asyncHandler(async (req, res) => {
    const notification = await cancelNotification(req.params.id);
    return res.json({ data: notification, requestId: req.requestId });
  })
);

module.exports = router;

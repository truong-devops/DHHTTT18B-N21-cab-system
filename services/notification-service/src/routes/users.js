const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { ApiError } = require("../utils/errors");
const {
  listNotificationsByUser,
  getPreferences,
  updatePreferences
} = require("../services/notificationService");
const { requireAuth, requireSelfOrRoles } = require("../middleware/auth");

const router = express.Router();

router.get(
  "/v1/users/:userId/notifications",
  requireAuth,
  requireSelfOrRoles("userId", ["admin", "service"]),
  asyncHandler(async (req, res) => {
    const { status, channel, from, to, page, limit } = req.query;
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    if (fromDate && Number.isNaN(fromDate.getTime())) {
      throw new ApiError(400, "VALIDATION_ERROR", "Invalid from date");
    }
    if (toDate && Number.isNaN(toDate.getTime())) {
      throw new ApiError(400, "VALIDATION_ERROR", "Invalid to date");
    }
    const filters = {
      status: status ? String(status).toUpperCase() : null,
      channel: channel ? String(channel).toUpperCase() : null,
      from: fromDate,
      to: toDate,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20
    };

    const result = await listNotificationsByUser(
      req.params.userId,
      filters
    );

    return res.json({ data: result, requestId: req.requestId });
  })
);

router.get(
  "/v1/users/:userId/preferences",
  requireAuth,
  requireSelfOrRoles("userId", ["admin", "service"]),
  asyncHandler(async (req, res) => {
    const prefs = await getPreferences(req.params.userId);
    return res.json({ data: prefs, requestId: req.requestId });
  })
);

router.put(
  "/v1/users/:userId/preferences",
  requireAuth,
  requireSelfOrRoles("userId", ["admin", "service"]),
  asyncHandler(async (req, res) => {
    const prefs = await updatePreferences(
      req.params.userId,
      req.body?.channels || {}
    );
    return res.json({ data: prefs, requestId: req.requestId });
  })
);

module.exports = router;

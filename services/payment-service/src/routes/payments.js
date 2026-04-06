const express = require("express");

const { asyncHandler } = require("../utils/asyncHandler");
const {
  listPaymentsController,
  createPaymentController,
  createPaymentInternalController,
  getPaymentController,
  updatePaymentStatusController,
  getVietQrController,
  confirmPaymentDevController
} = require("../controllers/paymentsController");
const config = require("../config");
const {
  validateCreatePayment,
  validateListPayments,
  validateStatusUpdate,
  validatePaymentParams
} = require("../middleware/validatePayments");
const { requireAuth, requireRole } = require("../middleware/auth");
const { ApiError } = require("../utils/errors");

const router = express.Router();

function requireInternalApiKey(req, _res, next) {
  const provided = String(req.get("x-internal-api-key") || "");
  if (!provided || provided !== String(config.internalApiKey || "")) {
    return next(
      new ApiError(401, "UNAUTHORIZED", "Unauthorized")
    );
  }
  return next();
}

router.post(
  "/internal/init",
  requireInternalApiKey,
  validateCreatePayment,
  asyncHandler(createPaymentInternalController)
);

router.use(requireAuth);

router.get(
  "/",
  validateListPayments,
  asyncHandler(listPaymentsController)
);

router.post(
  "/",
  validateCreatePayment,
  asyncHandler(createPaymentController)
);

router.get(
  "/:id",
  validatePaymentParams,
  asyncHandler(getPaymentController)
);

router.patch(
  "/:id",
  requireRole("admin"),
  validateStatusUpdate,
  asyncHandler(updatePaymentStatusController)
);

router.get(
  "/:id/vietqr-codes",
  validatePaymentParams,
  asyncHandler(getVietQrController)
);

router.post(
  "/:id/confirm-dev",
  requireRole("admin"),
  validatePaymentParams,
  asyncHandler(confirmPaymentDevController)
);

module.exports = router;

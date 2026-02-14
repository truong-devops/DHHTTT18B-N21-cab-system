const express = require("express");

const { asyncHandler } = require("../utils/asyncHandler");
const {
  listPaymentsController,
  createPaymentController,
  getPaymentController,
  updatePaymentStatusController,
  getVietQrController,
  confirmPaymentDevController
} = require("../controllers/paymentsController");
const {
  validateCreatePayment,
  validateListPayments,
  validateStatusUpdate,
  validatePaymentParams
} = require("../middleware/validatePayments");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

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

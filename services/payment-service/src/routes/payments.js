const express = require('express');

const { asyncHandler } = require('../utils/asyncHandler');
const {
  listPaymentsController,
  createPaymentController,
  createPaymentInternalController,
  getPaymentController,
  updatePaymentStatusController,
  getVietQrController,
  confirmPaymentDevController,
  getWalletSummaryController,
  listWithdrawalsController,
  createWithdrawalController,
  updateWithdrawalStatusController
} = require('../controllers/paymentsController');
const config = require('../config');
const {
  validateCreatePayment,
  validateListPayments,
  validateStatusUpdate,
  validatePaymentParams,
  validateWalletSummary,
  validateListWithdrawals,
  validateCreateWithdrawal,
  validateWithdrawalStatusUpdate
} = require('../middleware/validatePayments');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ApiError } = require('../utils/errors');

const router = express.Router();

function requireInternalApiKey(req, _res, next) {
  const provided = String(req.get('x-internal-api-key') || '');
  if (!provided || provided !== String(config.internalApiKey || '')) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Unauthorized'));
  }
  return next();
}

router.post('/internal/init', requireInternalApiKey, validateCreatePayment, asyncHandler(createPaymentInternalController));

router.use(requireAuth);

router.get('/', validateListPayments, asyncHandler(listPaymentsController));

router.post('/', validateCreatePayment, asyncHandler(createPaymentController));

router.get('/wallet/summary', validateWalletSummary, asyncHandler(getWalletSummaryController));

router.get('/withdrawals', validateListWithdrawals, asyncHandler(listWithdrawalsController));

router.post('/withdrawals', validateCreateWithdrawal, asyncHandler(createWithdrawalController));

router.patch('/withdrawals/:id', requireRole('admin', 'ops'), validateWithdrawalStatusUpdate, asyncHandler(updateWithdrawalStatusController));

router.get('/:id', validatePaymentParams, asyncHandler(getPaymentController));

router.patch('/:id', requireRole('admin', 'ops'), validateStatusUpdate, asyncHandler(updatePaymentStatusController));

router.get('/:id/vietqr-codes', validatePaymentParams, asyncHandler(getVietQrController));

router.post('/:id/confirm-dev', requireRole('admin', 'ops'), validatePaymentParams, asyncHandler(confirmPaymentDevController));

module.exports = router;

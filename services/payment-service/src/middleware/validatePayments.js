const { createAjv, formatAjvErrors } = require('../../../../libs/validation');
const { ApiError } = require('../utils/errors');
const { STATUSES } = require('../domain/paymentStatus');

const ajv = createAjv();
const WITHDRAWAL_STATUSES = ['REQUESTED', 'APPROVED', 'REJECTED', 'PAID', 'FAILED', 'CANCELED'];

const emptyObjectSchema = {
  type: 'object',
  additionalProperties: false
};

const paymentIdParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: {
    id: { type: 'string', minLength: 1 }
  }
};

const listPaymentsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    cursor: { type: 'string', minLength: 1 },
    sort: { type: 'string', enum: ['createdAt', '-createdAt'], default: '-createdAt' },
    status: { type: 'string', enum: Object.values(STATUSES) },
    rideId: { type: 'string', minLength: 1 }
  }
};

const createPaymentBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['rideId', 'amount', 'currency'],
  properties: {
    rideId: { type: 'string', minLength: 1 },
    amount: { type: 'string', pattern: '^\\d+(\\.\\d{1,2})?$' },
    currency: { type: 'string', minLength: 3, maxLength: 3 },
    method: { type: 'string' },
    userId: { type: 'string', pattern: '^[0-9]{8}$' },
    note: { type: 'string' }
  }
};

const statusUpdateBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: {
    status: { type: 'string', enum: Object.values(STATUSES) },
    failureReason: { type: 'string' }
  }
};

const walletSummaryQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    driverUserId: { type: 'string', pattern: '^[0-9]{8}$' }
  }
};

const listWithdrawalsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    cursor: { type: 'string', minLength: 1 },
    sort: { type: 'string', enum: ['requestedAt', '-requestedAt'], default: '-requestedAt' },
    status: { type: 'string', enum: WITHDRAWAL_STATUSES },
    driverUserId: { type: 'string', pattern: '^[0-9]{8}$' }
  }
};

const createWithdrawalBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['amount'],
  properties: {
    amount: { type: 'string', pattern: '^\\d+(\\.\\d{1,2})?$' },
    note: { type: 'string' }
  }
};

const withdrawalStatusUpdateBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: {
    status: { type: 'string', enum: WITHDRAWAL_STATUSES },
    rejectionReason: { type: 'string' }
  }
};

const validators = {
  emptyObject: ajv.compile(emptyObjectSchema),
  paymentIdParams: ajv.compile(paymentIdParamsSchema),
  listPaymentsQuery: ajv.compile(listPaymentsQuerySchema),
  createPaymentBody: ajv.compile(createPaymentBodySchema),
  statusUpdateBody: ajv.compile(statusUpdateBodySchema),
  walletSummaryQuery: ajv.compile(walletSummaryQuerySchema),
  listWithdrawalsQuery: ajv.compile(listWithdrawalsQuerySchema),
  createWithdrawalBody: ajv.compile(createWithdrawalBodySchema),
  withdrawalStatusUpdateBody: ajv.compile(withdrawalStatusUpdateBodySchema)
};

function normalizeParams(params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return {};
  }
  const nextParams = { ...params };
  if (typeof nextParams.id === 'string') {
    nextParams.id = nextParams.id.trim();
  }
  return nextParams;
}

function normalizeListQuery(query) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    return {};
  }
  const nextQuery = { ...query };
  // Some clients append cache-busting query params (e.g. "_=timestamp").
  // Ignore them so list validation stays strict for business params.
  delete nextQuery._;
  delete nextQuery.cacheBust;
  delete nextQuery.cb;
  if (typeof nextQuery.limit === 'string') {
    const parsedLimit = Number(nextQuery.limit);
    if (Number.isFinite(parsedLimit)) {
      nextQuery.limit = parsedLimit;
    } else {
      delete nextQuery.limit;
    }
  }
  if (typeof nextQuery.status === 'string') {
    nextQuery.status = nextQuery.status.trim().toUpperCase();
  }
  if (typeof nextQuery.rideId === 'string') {
    nextQuery.rideId = nextQuery.rideId.trim();
  }
  if (typeof nextQuery.cursor === 'string') {
    nextQuery.cursor = nextQuery.cursor.trim();
  }
  if (typeof nextQuery.sort === 'string') {
    nextQuery.sort = nextQuery.sort.trim();
  }
  return nextQuery;
}

function normalizeCreatePayment(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {};
  }
  const nextBody = { ...body };
  if (typeof nextBody.rideId === 'string') {
    nextBody.rideId = nextBody.rideId.trim();
  }
  if (typeof nextBody.amount === 'string') {
    nextBody.amount = nextBody.amount.trim();
  }
  if (typeof nextBody.currency === 'string') {
    nextBody.currency = nextBody.currency.trim().toUpperCase();
  }
  if (typeof nextBody.method === 'string') {
    nextBody.method = nextBody.method.trim().toUpperCase();
  }
  if (typeof nextBody.userId === 'string') {
    nextBody.userId = nextBody.userId.trim();
  }
  if (typeof nextBody.note === 'string') {
    nextBody.note = nextBody.note.trim();
  }
  if (typeof nextBody.amount === 'number') {
    nextBody.amount = nextBody.amount.toString();
  }
  return nextBody;
}

function normalizeStatusUpdate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {};
  }
  const nextBody = { ...body };
  if (typeof nextBody.status === 'string') {
    nextBody.status = nextBody.status.trim().toUpperCase();
  }
  if (typeof nextBody.failureReason === 'string') {
    nextBody.failureReason = nextBody.failureReason.trim();
  }
  return nextBody;
}

function normalizeWalletQuery(query) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    return {};
  }
  const nextQuery = { ...query };
  delete nextQuery._;
  delete nextQuery.cacheBust;
  delete nextQuery.cb;
  if (typeof nextQuery.driverUserId === 'string') {
    nextQuery.driverUserId = nextQuery.driverUserId.trim();
  }
  return nextQuery;
}

function normalizeWithdrawalsQuery(query) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    return {};
  }
  const nextQuery = { ...query };
  delete nextQuery._;
  delete nextQuery.cacheBust;
  delete nextQuery.cb;
  if (typeof nextQuery.limit === 'string') {
    const parsedLimit = Number(nextQuery.limit);
    if (Number.isFinite(parsedLimit)) {
      nextQuery.limit = parsedLimit;
    } else {
      delete nextQuery.limit;
    }
  }
  if (typeof nextQuery.status === 'string') {
    nextQuery.status = nextQuery.status.trim().toUpperCase();
  }
  if (typeof nextQuery.driverUserId === 'string') {
    nextQuery.driverUserId = nextQuery.driverUserId.trim();
  }
  if (typeof nextQuery.cursor === 'string') {
    nextQuery.cursor = nextQuery.cursor.trim();
  }
  if (typeof nextQuery.sort === 'string') {
    nextQuery.sort = nextQuery.sort.trim();
  }
  return nextQuery;
}

function normalizeCreateWithdrawal(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {};
  }
  const nextBody = { ...body };
  if (typeof nextBody.amount === 'number') {
    nextBody.amount = nextBody.amount.toString();
  }
  if (typeof nextBody.amount === 'string') {
    nextBody.amount = nextBody.amount.trim();
  }
  if (typeof nextBody.note === 'string') {
    nextBody.note = nextBody.note.trim();
  }
  return nextBody;
}

function normalizeWithdrawalStatusUpdate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {};
  }
  const nextBody = { ...body };
  if (typeof nextBody.status === 'string') {
    nextBody.status = nextBody.status.trim().toUpperCase();
  }
  if (typeof nextBody.rejectionReason === 'string') {
    nextBody.rejectionReason = nextBody.rejectionReason.trim();
  }
  return nextBody;
}

function buildDetails(errors) {
  return errors.map((err) => `${err.path}: ${err.message}`);
}

function collectErrors(targetErrors, validator, data, prefix) {
  if (!validator(data)) {
    targetErrors.push(...formatAjvErrors(validator.errors, prefix));
  }
}

function validateRequest({ paramsValidator, queryValidator, bodyValidator, normalize, postValidate }) {
  return (req, _res, next) => {
    let params = normalizeParams(req.params);
    let query = req.query || {};
    let body = req.body;

    if (normalize) {
      const normalized = normalize({ params, query, body });
      params = normalized.params;
      query = normalized.query;
      body = normalized.body;
    }

    const errors = [];
    if (paramsValidator) {
      collectErrors(errors, paramsValidator, params, 'params');
    }
    if (queryValidator) {
      collectErrors(errors, queryValidator, query, 'query');
    }
    if (bodyValidator) {
      collectErrors(errors, bodyValidator, body, 'body');
    }
    if (postValidate) {
      errors.push(...postValidate({ params, query, body }));
    }

    if (errors.length) {
      return next(new ApiError(400, 'VALIDATION_ERROR', 'Validation failed', buildDetails(errors)));
    }

    req.validatedParams = params;
    req.validatedQuery = query;
    req.validatedBody = body;
    return next();
  };
}

function validateCreatePaymentCustom(body) {
  const errors = [];
  const amount = body ? body.amount : null;
  const numeric = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    errors.push({ path: 'body.amount', message: 'must be greater than zero' });
  }
  if (body && body.method === 'VIETQR' && body.currency !== 'VND') {
    errors.push({ path: 'body.currency', message: 'must be VND when method is VIETQR' });
  }
  if (body && body.method === 'PAYOS') {
    if (body.currency !== 'VND') {
      errors.push({ path: 'body.currency', message: 'must be VND when method is PAYOS' });
    }
    if (Number.isFinite(numeric) && !Number.isInteger(numeric)) {
      errors.push({ path: 'body.amount', message: 'must be an integer when method is PAYOS' });
    }
  }
  return errors;
}

function validateStatusUpdateCustom(body) {
  const errors = [];
  if (body && body.status === STATUSES.FAILED && !body.failureReason) {
    errors.push({ path: 'body.failureReason', message: 'is required for FAILED status' });
  }
  return errors;
}

function validateCreateWithdrawalCustom(body) {
  const errors = [];
  const amount = body ? body.amount : null;
  const numeric = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    errors.push({ path: 'body.amount', message: 'must be greater than zero' });
  }
  return errors;
}

function validateWithdrawalStatusCustom(body) {
  const errors = [];
  if (!body || !body.status) {
    return errors;
  }
  if ((body.status === 'REJECTED' || body.status === 'FAILED') && !body.rejectionReason) {
    errors.push({ path: 'body.rejectionReason', message: 'is required for REJECTED or FAILED status' });
  }
  return errors;
}

function validateListPayments(req, res, next) {
  const middleware = validateRequest({
    paramsValidator: validators.emptyObject,
    queryValidator: validators.listPaymentsQuery,
    bodyValidator: validators.emptyObject,
    normalize: ({ params, query, body }) => ({
      params,
      query: normalizeListQuery(query),
      body: body || {}
    })
  });
  return middleware(req, res, next);
}

function validateCreatePayment(req, res, next) {
  const middleware = validateRequest({
    paramsValidator: validators.emptyObject,
    queryValidator: validators.emptyObject,
    bodyValidator: validators.createPaymentBody,
    normalize: ({ params, query, body }) => ({
      params,
      query: query || {},
      body: normalizeCreatePayment(body || {})
    }),
    postValidate: ({ body }) => validateCreatePaymentCustom(body)
  });
  return middleware(req, res, next);
}

function validateStatusUpdate(req, res, next) {
  const middleware = validateRequest({
    paramsValidator: validators.paymentIdParams,
    queryValidator: validators.emptyObject,
    bodyValidator: validators.statusUpdateBody,
    normalize: ({ params, query, body }) => ({
      params: normalizeParams(params),
      query: query || {},
      body: normalizeStatusUpdate(body || {})
    }),
    postValidate: ({ body }) => validateStatusUpdateCustom(body)
  });
  return middleware(req, res, next);
}

function validatePaymentParams(req, res, next) {
  const middleware = validateRequest({
    paramsValidator: validators.paymentIdParams,
    queryValidator: validators.emptyObject,
    bodyValidator: validators.emptyObject,
    normalize: ({ params, query, body }) => ({
      params: normalizeParams(params),
      query: query || {},
      body: body || {}
    })
  });
  return middleware(req, res, next);
}

function validateWalletSummary(req, res, next) {
  const middleware = validateRequest({
    paramsValidator: validators.emptyObject,
    queryValidator: validators.walletSummaryQuery,
    bodyValidator: validators.emptyObject,
    normalize: ({ params, query, body }) => ({
      params,
      query: normalizeWalletQuery(query),
      body: body || {}
    })
  });
  return middleware(req, res, next);
}

function validateListWithdrawals(req, res, next) {
  const middleware = validateRequest({
    paramsValidator: validators.emptyObject,
    queryValidator: validators.listWithdrawalsQuery,
    bodyValidator: validators.emptyObject,
    normalize: ({ params, query, body }) => ({
      params,
      query: normalizeWithdrawalsQuery(query),
      body: body || {}
    })
  });
  return middleware(req, res, next);
}

function validateCreateWithdrawal(req, res, next) {
  const middleware = validateRequest({
    paramsValidator: validators.emptyObject,
    queryValidator: validators.emptyObject,
    bodyValidator: validators.createWithdrawalBody,
    normalize: ({ params, query, body }) => ({
      params,
      query: query || {},
      body: normalizeCreateWithdrawal(body || {})
    }),
    postValidate: ({ body }) => validateCreateWithdrawalCustom(body)
  });
  return middleware(req, res, next);
}

function validateWithdrawalStatusUpdate(req, res, next) {
  const middleware = validateRequest({
    paramsValidator: validators.paymentIdParams,
    queryValidator: validators.emptyObject,
    bodyValidator: validators.withdrawalStatusUpdateBody,
    normalize: ({ params, query, body }) => ({
      params: normalizeParams(params),
      query: query || {},
      body: normalizeWithdrawalStatusUpdate(body || {})
    }),
    postValidate: ({ body }) => validateWithdrawalStatusCustom(body)
  });
  return middleware(req, res, next);
}

module.exports = {
  validateCreatePayment,
  validateListPayments,
  validateStatusUpdate,
  validatePaymentParams,
  validateWalletSummary,
  validateListWithdrawals,
  validateCreateWithdrawal,
  validateWithdrawalStatusUpdate
};

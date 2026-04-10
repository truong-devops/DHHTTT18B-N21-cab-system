const express = require('express');
const crypto = require('crypto');
const { decodeCursor } = require('@libs/http');
const {
  createReview,
  getReviewById,
  getReviewByRideAndRider,
  listReviews,
  updateReviewFields,
  updateReviewStatus,
  addStatusHistory
} = require('../repository/reviewRepository');
const { getByKey, createKey, setResponse } = require('../repository/idempotencyRepository');
const { requireAuth } = require('../middleware/auth');
const { ApiError } = require('../utils/errors');
const { asyncHandler } = require('../utils/asyncHandler');
const { encodeCursor } = require('@libs/http');
const { normalizeStatus, isValidTransition } = require('../domain/reviewStateMachine');
const logger = require('../utils/logger');
const { buildIdempotencyKey, buildLockKey, getCachedResponse, saveCachedResponse, acquireLock, releaseLock } = require('../idempotency/store');
const { validateRequest } = require('../middleware/validateRequest');
const monitoring = require('../monitoring');

const router = express.Router();

router.use(requireAuth);

function toReviewResponse(row) {
  return {
    id: row.id,
    rideId: row.ride_id,
    riderId: row.rider_id,
    driverId: row.driver_id,
    rating: row.rating,
    comment: row.comment,
    tipAmount: row.tip_amount,
    status: row.status,
    statusUpdatedAt: row.status_updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function isReviewUniqueConstraintError(error) {
  if (!error || error.code !== '23505') {
    return false;
  }

  if (error.constraint === 'reviews_ride_rider_uq') {
    return true;
  }

  return String(error.detail || '').includes('(ride_id, rider_id)');
}

router.post(
  '/',
  validateRequest({
    bodySchema: {
      required: ['rideId', 'driverId', 'rating'],
      properties: {
        rideId: { type: 'string' },
        driverId: { type: 'string' },
        rating: { type: 'integer', minimum: 1, maximum: 5 },
        comment: { type: 'string' },
        tipAmount: { type: 'integer', minimum: 0 },
        status: { type: 'string' }
      }
    },
    custom: (req, errors) => {
      if (!req.header('Idempotency-Key')) {
        errors.push({
          path: 'headers.Idempotency-Key',
          message: 'is required'
        });
      }
    }
  }),
  asyncHandler(async (req, res) => {
    const idempotencyKey = req.header('Idempotency-Key');

    const routeKey = 'reviews:create';
    let responseBody;
    let responseStatus = 201;
    const responseHeaders = {
      'content-type': 'application/json',
      'x-trace-id': req.traceId,
      'x-request-id': req.requestId
    };
    const requestHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(req.body || {}))
      .digest('hex');

    let lockAcquired = false;
    try {
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
        if (cached.requestHash && cached.requestHash !== requestHash) {
          throw new ApiError(409, 'CONFLICT', 'Idempotency key reuse with different request');
        }

        if (cached.headers) {
          Object.entries(cached.headers).forEach(([key, value]) => {
            if (value) {
              res.setHeader(key, value);
            }
          });
        }
        return res.status(cached.status).json(cached.body);
      }

      const existing = await getByKey({
        routeKey,
        userId: req.userId,
        idempotencyKey
      });
      if (existing && existing.request_hash !== requestHash) {
        throw new ApiError(409, 'CONFLICT', 'Idempotency key reuse with different request');
      }

      if (existing && existing.response_status) {
        if (existing.response_headers) {
          Object.entries(existing.response_headers).forEach(([key, value]) => {
            if (value) {
              res.setHeader(key, value);
            }
          });
        }

        const response = existing.response_body || null;
        await saveCachedResponse(cacheKey, {
          status: existing.response_status,
          headers: existing.response_headers,
          body: response,
          requestHash,
          createdAt: new Date().toISOString()
        });

        return res.status(existing.response_status).json(response);
      }

      lockAcquired = await acquireLock(lockKey);
      if (!lockAcquired) {
        throw new ApiError(409, 'CONFLICT', 'Idempotency key is being processed');
      }

      await createKey({
        routeKey,
        userId: req.userId,
        idempotencyKey,
        requestHash
      });

      let review;
      try {
        review = await createReview({
          rideId: req.body.rideId,
          riderId: req.userId,
          driverId: req.body.driverId,
          rating: req.body.rating,
          comment: req.body.comment,
          tipAmount: req.body.tipAmount,
          status: req.body.status || 'submitted'
        });
      } catch (error) {
        if (isReviewUniqueConstraintError(error)) {
          const existingReview = await getReviewByRideAndRider({
            rideId: req.body.rideId,
            riderId: req.userId
          });

          if (existingReview) {
            responseStatus = 200;
            responseBody = { data: toReviewResponse(existingReview) };

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

            return res.status(responseStatus).json(responseBody);
          }

          throw new ApiError(409, 'CONFLICT', 'Review already exists for this ride');
        }

        if (error?.code === '22P02') {
          throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid rideId, driverId, or riderId format');
        }

        throw error;
      }
      monitoring.recordReviewCreated('success', {
        status: String(review.status || 'submitted').toLowerCase()
      });

      responseBody = { data: toReviewResponse(review) };
      await setResponse({
        routeKey,
        userId: req.userId,
        idempotencyKey,
        responseStatus,
        responseHeaders,
        responseBody
      });

      await addStatusHistory({
        reviewId: review.id,
        status: review.status,
        actorId: req.userId,
        traceId: req.traceId
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
        const lockKey = buildLockKey({
          routeKey,
          userId: req.userId,
          idempotencyKey
        });
        await releaseLock(lockKey);
      }
    }

    return res.status(responseStatus).json(responseBody);
  })
);

router.get(
  '/:id',
  validateRequest({
    paramsSchema: {
      required: ['id'],
      properties: {
        id: { type: 'string' }
      }
    }
  }),
  asyncHandler(async (req, res) => {
    const review = await getReviewById(req.params.id);
    if (!review) {
      throw new ApiError(404, 'NOT_FOUND', 'Review not found');
    }

    return res.json({ data: toReviewResponse(review) });
  })
);

router.get(
  '/',
  validateRequest({
    querySchema: {
      properties: {
        status: { type: 'string' },
        riderId: { type: 'string' },
        limit: { type: 'string' },
        cursor: { type: 'string' },
        sort: { type: 'string' }
      }
    },
    custom: (req, errors) => {
      const sort = req.query.sort || '-createdAt';
      if (!['-createdAt', 'createdAt'].includes(sort)) {
        errors.push({
          path: 'query.sort',
          message: 'must be createdAt or -createdAt'
        });
      }

      let cursor = null;
      if (req.query.cursor) {
        cursor = decodeCursor(req.query.cursor);
        if (!cursor) {
          errors.push({
            path: 'query.cursor',
            message: 'is invalid'
          });
        }
      }

      const hasLimit = req.query.limit !== undefined;
      const limitRaw = Number(req.query.limit || 20);
      const limit = Number.isFinite(limitRaw) ? limitRaw : 20;
      if (hasLimit && !Number.isFinite(limitRaw)) {
        errors.push({
          path: 'query.limit',
          message: 'must be a number'
        });
      }
      if (limit < 1 || limit > 100) {
        errors.push({
          path: 'query.limit',
          message: 'must be between 1 and 100'
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

    const rows = await listReviews({
      limit,
      cursor,
      status: req.query.status,
      riderId: req.query.riderId || req.userId,
      sort: sort === '-createdAt' ? '-created_at' : 'created_at'
    });

    const data = rows.map(toReviewResponse);
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
  '/:id',
  validateRequest({
    paramsSchema: {
      required: ['id'],
      properties: {
        id: { type: 'string' }
      }
    },
    bodySchema: {
      properties: {
        rating: { type: 'integer', minimum: 1, maximum: 5 },
        comment: { type: 'string' },
        tipAmount: { type: 'integer', minimum: 0 },
        status: { type: 'string' },
        statusReason: { type: 'string' }
      }
    },
    custom: (req, errors) => {
      const hasUpdatableFields = ['rating', 'comment', 'tipAmount', 'status'].some((field) => req.body?.[field] !== undefined);
      if (!hasUpdatableFields) {
        errors.push({
          path: 'body',
          message: 'at least one field is required'
        });
      }
    }
  }),
  asyncHandler(async (req, res) => {
    let review = await getReviewById(req.params.id);
    if (!review) {
      throw new ApiError(404, 'NOT_FOUND', 'Review not found');
    }

    let fromStatus = null;
    let toStatus = null;
    if (req.body.status) {
      fromStatus = normalizeStatus(review.status);
      toStatus = normalizeStatus(req.body.status);
      if (!isValidTransition(fromStatus, toStatus)) {
        throw new ApiError(409, 'INVALID_STATE_TRANSITION', `Invalid transition from ${fromStatus} to ${toStatus}`);
      }
    }

    if (req.body.rating !== undefined || req.body.comment !== undefined || req.body.tipAmount !== undefined) {
      review = await updateReviewFields(req.params.id, {
        rating: req.body.rating,
        comment: req.body.comment,
        tipAmount: req.body.tipAmount
      });
    }

    if (req.body.status) {
      logger.info(
        {
          traceId: req.traceId,
          reviewId: review.id,
          fromStatus,
          toStatus,
          actor: req.userId,
          reason: req.body.statusReason || null
        },
        'review status transition'
      );

      review = await updateReviewStatus({
        id: req.params.id,
        status: String(req.body.status).toLowerCase(),
        reason: req.body.statusReason || null,
        actorId: req.userId,
        traceId: req.traceId
      });
    }

    return res.json({ data: toReviewResponse(review) });
  })
);

router.delete(
  '/:id',
  validateRequest({
    paramsSchema: {
      required: ['id'],
      properties: {
        id: { type: 'string' }
      }
    }
  }),
  asyncHandler(async (req, res) => {
    const review = await getReviewById(req.params.id);

    if (!review) {
      throw new ApiError(404, 'NOT_FOUND', 'Review not found');
    }

    const fromStatus = normalizeStatus(review.status);
    const toStatus = 'DELETED';
    if (!isValidTransition(fromStatus, toStatus)) {
      throw new ApiError(409, 'INVALID_STATE_TRANSITION', `Invalid transition from ${fromStatus} to ${toStatus}`);
    }

    logger.info(
      {
        traceId: req.traceId,
        reviewId: review.id,
        fromStatus,
        toStatus,
        actor: req.userId,
        reason: req.body?.reason || null
      },
      'review status transition'
    );

    const updated = await updateReviewStatus({
      id: req.params.id,
      status: 'deleted',
      reason: req.body?.reason || null,
      actorId: req.userId,
      traceId: req.traceId
    });

    return res.json({ data: toReviewResponse(updated) });
  })
);

module.exports = router;

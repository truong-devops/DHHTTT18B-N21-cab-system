const express = require('express');
const crypto = require('crypto');
const { CreateBookingSchema } = require('../schemas/bookingSchemas');
const bookingRepo = require('../repositories/bookingRepo');
const outboxRepo = require('../repositories/outboxRepo');
const { reserveIdempotencyKey, completeIdempotencyKey } = require('../repositories/idempotencyRepo');
const { withTransaction } = require('../db/pool');
const config = require('../config');
const { getQuote, PricingServiceError } = require('../clients/pricingClient');
const { estimateEta, EtaServiceError } = require('../clients/etaClient');
const { getDriverAvailability, listAvailableDrivers, selectBestDriver } = require('../clients/driverClient');
const { createPayment } = require('../clients/paymentClient');
const { sendNotification } = require('../clients/notificationClient');
const { hashRequest } = require('../utils/idempotency');

const topics = require('../messaging/topics');
const monitoring = require('../monitoring');
const logger = require('../utils/logger');

const router = express.Router();

function buildEnvelope({ eventId, type, traceId, payload }) {
  return {
    eventId,
    traceId: traceId || null,
    occurredAt: new Date().toISOString(),
    type,
    version: 1,
    payload
  };
}

function buildOutboxRecord({ eventId, topic, eventType, aggregateId, partitionKey, envelope }) {
  return {
    eventId,
    aggregateType: 'booking',
    aggregateId,
    eventType,
    topic,
    partitionKey,
    payload: envelope,
    occurredAt: envelope.occurredAt,
    maxAttempts: config.outbox.maxAttempts
  };
}

function resolveUserId(req, payload) {
  return req.userId || req.header('x-user-id') || payload.user_id || 'anonymous-user';
}

function hasLatLngTypeIssue(issues) {
  return (issues || []).some((issue) => {
    if (issue?.code !== 'invalid_type') {
      return false;
    }
    const path = (issue.path || []).join('.');
    return (
      path.includes('pickup.lat') ||
      path.includes('pickup.lng') ||
      path.includes('drop.lat') ||
      path.includes('drop.lng') ||
      path.includes('dropoff.lat') ||
      path.includes('dropoff.lng')
    );
  });
}

function normalizeDrop(body) {
  return body.drop || body.dropoff || null;
}

function mapBookingCompat(booking) {
  if (!booking || typeof booking !== 'object') {
    return booking;
  }
  return {
    ...booking,
    booking_id: booking.bookingId || booking.booking_id || null,
    ride_id: booking.rideId || booking.ride_id || null,
    user_id: booking.userId || booking.user_id || null,
    vehicle_type: booking.vehicleType || booking.vehicle_type || null,
    distance_km: booking.distanceKm != null ? booking.distanceKm : booking.distance_km != null ? booking.distance_km : null,
    eta_minutes: booking.etaMinutes != null ? booking.etaMinutes : booking.eta_minutes != null ? booking.eta_minutes : null,
    created_at: booking.createdAt || booking.created_at || null,
    canceled_at: booking.canceledAt || booking.canceled_at || null
  };
}

function mapBookingListCompat(items) {
  return (items || []).map(mapBookingCompat);
}

function mapCreateResponseCompat(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }
  return {
    ...body,
    booking: mapBookingCompat(body.booking)
  };
}

function buildNoDriversPriceSnapshot() {
  return {
    quoteId: null,
    estimatedFare: 0,
    surge: 1,
    currency: 'VND',
    distanceKm: null,
    durationMin: null,
    reason: 'No drivers available'
  };
}

function normalizePaymentMethod(paymentMethod) {
  const method = String(paymentMethod || 'CASH').toUpperCase();
  if (['CASH', 'VIETQR', 'PAYOS'].includes(method)) {
    return method;
  }
  return 'CASH';
}

function resolveAmountFromQuote(quote) {
  const amount = Number(quote?.estimatedFare);
  if (!Number.isFinite(amount) || amount <= 0) {
    return 10000;
  }
  return Math.max(1, Math.round(amount));
}

async function buildAiDriverDecision({ pickup, vehicleType, authorization, traceId }) {
  let drivers = await listAvailableDrivers({
    pickup,
    vehicleType,
    authorization,
    traceId,
    limit: Number(process.env.AI_DRIVER_CANDIDATE_LIMIT || 5)
  });

  // Fallback for partially onboarded drivers that are ONLINE but missing vehicle metadata.
  if (!drivers.length && vehicleType) {
    drivers = await listAvailableDrivers({
      pickup,
      vehicleType: null,
      authorization,
      traceId,
      limit: Number(process.env.AI_DRIVER_CANDIDATE_LIMIT || 5)
    });
  }

  const selected = selectBestDriver(drivers);
  return {
    availableDrivers: drivers,
    selectedDriver: selected
  };
}

async function runBookingIntegrationFlow({ booking, quote, paymentMethod, authorization, traceId, simulatePaymentTimeout = false }) {
  const integrations = {
    payment: null,
    notification: null,
    flow: 'skipped'
  };

  const paymentResult = await createPayment({
    rideId: booking.rideId,
    amount: resolveAmountFromQuote(quote),
    currency: quote?.currency || 'VND',
    method: normalizePaymentMethod(paymentMethod),
    userId: booking.userId,
    authorization,
    traceId,
    idempotencyKey: `booking-payment-${booking.bookingId}`,
    simulateTimeout: simulatePaymentTimeout
  });
  integrations.payment = paymentResult;

  const notificationMessage = paymentResult.ok
    ? `Booking ${booking.bookingId} created. Payment initialized`
    : `Booking ${booking.bookingId} created. Payment initialization pending`;

  const notificationResult = await sendNotification({
    userId: booking.userId,
    title: 'Booking Created',
    message: notificationMessage,
    sourceService: 'booking-service',
    sourceAction: 'BOOKING_PAYMENT_INIT',
    authorization,
    traceId
  });
  integrations.notification = notificationResult;

  integrations.flow = paymentResult.ok && notificationResult.ok ? 'success' : 'partial';

  return integrations;
}

async function compensateBookingAfterPaymentFailure({ bookingId, traceId, reason }) {
  return withTransaction(async (client) => {
    const existing = await bookingRepo.getByIdForUpdate(client, bookingId);
    if (!existing) {
      return null;
    }

    const currentStatus = String(existing.status || '').toUpperCase();
    if (currentStatus === 'CANCELLED') {
      return {
        booking: existing,
        publishedEvent: null,
        alreadyCancelled: true
      };
    }

    const cancelled = await bookingRepo.cancel(client, bookingId);
    const eventId = crypto.randomUUID();
    const envelope = buildEnvelope({
      eventId,
      traceId,
      type: 'RideCancelled',
      payload: {
        rideId: cancelled.rideId,
        reason: reason || 'PAYMENT_INITIALIZATION_FAILED',
        timestamp: new Date().toISOString()
      }
    });

    await outboxRepo.insertOutboxEvent(
      client,
      buildOutboxRecord({
        eventId,
        topic: topics.RideCancelled,
        eventType: 'RideCancelled',
        aggregateId: cancelled.bookingId,
        partitionKey: cancelled.rideId,
        envelope
      })
    );

    return {
      booking: cancelled,
      alreadyCancelled: false,
      publishedEvent: {
        topic: topics.RideCancelled,
        eventId,
        queued: true
      }
    };
  });
}

router.get('/', async (req, res, next) => {
  try {
    const requestedUserId = req.query.user_id || req.userId || req.header('x-user-id') || null;
    const items = await bookingRepo.list(requestedUserId ? { userId: String(requestedUserId) } : {});
    return res.json({ data: mapBookingListCompat(items) });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const booking = await bookingRepo.getById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    return res.json({ data: mapBookingCompat(booking) });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res) => {
  let currentUserId = null;
  try {
    if (!req.body?.pickup) {
      monitoring.recordBookingStatus('created', 'error', {
        reason: 'pickup_required'
      });
      return res.status(400).json({
        error: 'pickup is required'
      });
    }

    const drop = normalizeDrop(req.body || {});
    if (!drop) {
      monitoring.recordBookingStatus('created', 'error', {
        reason: 'drop_required'
      });
      return res.status(400).json({
        error: 'drop is required'
      });
    }
    if (req.body?.payment_method && !['CASH', 'VIETQR', 'PAYOS'].includes(String(req.body.payment_method).toUpperCase())) {
      monitoring.recordBookingStatus('created', 'error', {
        reason: 'invalid_payment_method'
      });
      return res.status(400).json({
        error: 'Invalid payment method'
      });
    }

    const parsed = CreateBookingSchema.safeParse({
      ...(req.body || {}),
      drop
    });
    if (!parsed.success) {
      const schemaIssues = parsed.error.issues || [];
      const statusCode = hasLatLngTypeIssue(schemaIssues) ? 422 : 400;
      monitoring.recordBookingStatus('created', 'error', {
        reason: 'validation_error'
      });
      return res.status(statusCode).json({
        error: statusCode === 422 ? 'Validation error from schema' : 'Invalid payload',
        details: parsed.error.flatten()
      });
    }

    const { pickup, vehicleType, distance_km, traffic_level } = parsed.data;
    const normalizedDrop = parsed.data.drop || parsed.data.dropoff;
    const userId = resolveUserId(req, parsed.data);
    currentUserId = userId;
    const idempotencyKey = req.header('idempotency-key') || null;
    const routeKey = '/v1/bookings';
    const requestPayload = {
      pickup,
      drop: normalizedDrop,
      vehicleType,
      distance_km,
      traffic_level
    };
    const requestHash = idempotencyKey ? hashRequest(req.method, routeKey, requestPayload) : null;
    const traceId = req.traceId || req.header('x-trace-id');
    const authorization = req.header('authorization') || '';
    const simulatePricingTimeout = req.body?.simulate_pricing_timeout === true || req.body?.simulatePricingTimeout === true;
    const simulatePaymentTimeout = req.body?.simulate_payment_timeout === true || req.body?.simulatePaymentTimeout === true;
    const simulateTxFailureAfterInsert =
      req.body?.simulate_tx_failure_after_insert === true || req.body?.simulateTransactionFailureAfterInsert === true;

    const availability = await getDriverAvailability({
      pickup,
      vehicleType,
      authorization,
      traceId
    });

    const noDriversAvailable = availability.checked && !availability.available;

    const [quote, eta] = await Promise.all([
      getQuote({
        pickup,
        dropoff: normalizedDrop,
        vehicleType,
        simulateTimeout: simulatePricingTimeout
      }),
      estimateEta({
        pickup,
        drop: normalizedDrop,
        distanceKm: distance_km,
        trafficLevel: traffic_level
      })
    ]);

    const resolvedDistanceKm = Number.isFinite(distance_km)
      ? distance_km
      : Number.isFinite(eta.distanceKm)
        ? eta.distanceKm
        : Number.isFinite(Number(quote.distanceKm))
          ? Number(quote.distanceKm)
          : null;
    const result = await withTransaction(async (client) => {
      if (idempotencyKey) {
        const reservation = await reserveIdempotencyKey(client, {
          routeKey,
          userId,
          idemKey: idempotencyKey,
          requestHash
        });

        if (reservation.state === 'conflict') {
          const error = new Error('Idempotency-Key payload mismatch');
          error.statusCode = 409;
          error.code = 'IDEMPOTENCY_KEY_CONFLICT';
          throw error;
        }
        if (reservation.state === 'in_progress') {
          const error = new Error('Idempotency-Key is being processed');
          error.statusCode = 409;
          error.code = 'IDEMPOTENCY_IN_PROGRESS';
          throw error;
        }
        if (reservation.state === 'replay' && reservation.record) {
          return {
            replay: true,
            responseCode: reservation.record.responseCode || 200,
            responseBody: reservation.record.responseBody
          };
        }
      }

      const bookingId = `bk_${crypto.randomUUID()}`;
      const rideId = `ride_${crypto.randomUUID()}`;
      const rideCreatedEventId = crypto.randomUUID();
      const rideRequestedEventId = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      const created = await bookingRepo.create(client, {
        bookingId,
        rideId,
        userId,
        pickup,
        dropoff: normalizedDrop,
        vehicleType,
        distanceKm: resolvedDistanceKm,
        etaMinutes: eta.etaMinutes,
        priceSnapshot: quote,
        status: 'REQUESTED',
        createdAt
      });

      if (simulateTxFailureAfterInsert) {
        const error = new Error('Simulated transaction failure after booking insert');
        error.code = 'SIMULATED_TX_FAILURE';
        throw error;
      }

      const rideCreatedEnvelope = buildEnvelope({
        eventId: rideCreatedEventId,
        traceId,
        type: 'RideCreated',
        payload: {
          rideId,
          bookingId,
          riderId: userId,
          pickup: { lat: pickup.lat, lng: pickup.lng },
          dropoff: {
            lat: normalizedDrop.lat,
            lng: normalizedDrop.lng
          },
          vehicleType,
          timestamp: createdAt
        }
      });

      await outboxRepo.insertOutboxEvent(
        client,
        buildOutboxRecord({
          eventId: rideCreatedEventId,
          topic: topics.RideCreated,
          eventType: 'RideCreated',
          aggregateId: bookingId,
          partitionKey: rideId,
          envelope: rideCreatedEnvelope
        })
      );

      const rideRequestedEnvelope = buildEnvelope({
        eventId: rideRequestedEventId,
        traceId,
        type: 'RideRequested',
        payload: {
          event_type: 'ride_requested',
          ride_id: rideId,
          booking_id: bookingId,
          user_id: userId,
          pickup: { lat: pickup.lat, lng: pickup.lng },
          drop: {
            lat: normalizedDrop.lat,
            lng: normalizedDrop.lng
          },
          distance_km: resolvedDistanceKm,
          eta_minutes: eta.etaMinutes,
          timestamp: createdAt
        }
      });

      await outboxRepo.insertOutboxEvent(
        client,
        buildOutboxRecord({
          eventId: rideRequestedEventId,
          topic: topics.RideEvents,
          eventType: 'RideRequested',
          aggregateId: bookingId,
          partitionKey: rideId,
          envelope: rideRequestedEnvelope
        })
      );

      const responseBody = {
        booking: mapBookingCompat(created),
        publishedEvent: {
          topic: topics.RideCreated,
          eventId: rideCreatedEventId,
          queued: true
        },
        additionalEvents: [
          {
            topic: topics.RideEvents,
            eventId: rideRequestedEventId,
            eventType: 'ride_requested',
            queued: true
          }
        ]
      };

      if (idempotencyKey) {
        await completeIdempotencyKey(client, {
          routeKey,
          userId,
          idemKey: idempotencyKey,
          responseCode: 201,
          responseBody
        });
      }

      return {
        replay: false,
        responseCode: 201,
        responseBody
      };
    });

    monitoring.recordBookingStatus('created', 'success', {
      vehicle_type: vehicleType
    });

    const responsePayload = mapCreateResponseCompat(result.responseBody);
    if (responsePayload?.booking?.priceSnapshot) {
      const surge = Number(responsePayload.booking.priceSnapshot.surge);
      responsePayload.booking.priceSnapshot.surge = Number.isFinite(surge) && surge >= 1 ? surge : 1;
    }

    if (!result.replay && responsePayload?.booking) {
      const aiDecision = await buildAiDriverDecision({
        pickup,
        vehicleType,
        authorization,
        traceId
      });
      responsePayload.ai_driver_decision = {
        available_drivers: aiDecision.availableDrivers,
        selected_driver: aiDecision.selectedDriver
      };

      if (noDriversAvailable) {
        responsePayload.message = 'No drivers available';
      }

      if (parsed.data.payment_method) {
        responsePayload.integration_flow = await runBookingIntegrationFlow({
          booking: responsePayload.booking,
          quote,
          paymentMethod: parsed.data.payment_method,
          authorization,
          traceId,
          simulatePaymentTimeout
        });

        if (responsePayload.integration_flow?.payment?.ok === false) {
          const compensation = await compensateBookingAfterPaymentFailure({
            bookingId: responsePayload.booking.bookingId,
            traceId,
            reason: 'PAYMENT_INITIALIZATION_FAILED'
          });
          if (compensation?.booking) {
            responsePayload.booking = mapBookingCompat(compensation.booking);
          }
          responsePayload.integration_flow.compensation = {
            applied: Boolean(compensation?.booking),
            booking_status: compensation?.booking?.status || null,
            published_event: compensation?.publishedEvent || null
          };
        }
      }
    }

    return res.status(result.responseCode).json(responsePayload);
  } catch (e) {
    if (e instanceof PricingServiceError) {
      monitoring.recordBookingStatus('created', 'error', {
        reason: 'pricing_unavailable'
      });
      logger.withTrace(req).error(
        {
          err: {
            message: e.message,
            code: e.code,
            cause: e.cause?.message || null
          }
        },
        'failed to create booking due to pricing dependency'
      );
      return res.status(e.statusCode).json({
        error: e.message,
        code: e.code
      });
    }
    if (e instanceof EtaServiceError) {
      monitoring.recordBookingStatus('created', 'error', {
        reason: 'eta_unavailable'
      });
      logger.withTrace(req).error(
        {
          err: {
            message: e.message,
            code: e.code,
            cause: e.cause?.message || null
          }
        },
        'failed to create booking due to eta dependency'
      );
      return res.status(e.statusCode).json({
        error: e.message,
        code: e.code
      });
    }
    if (e?.code === '23505') {
      const constraint = String(e?.constraint || '');
      if (constraint === 'bookings_one_active_per_user_idx') {
        const activeBooking = currentUserId && currentUserId !== 'anonymous-user' ? await bookingRepo.findActiveByUser(currentUserId) : null;
        return res.status(409).json({
          error: 'An active booking already exists for this user',
          code: 'ACTIVE_BOOKING_EXISTS',
          booking: activeBooking ? mapBookingCompat(activeBooking) : null
        });
      }
      return res.status(409).json({
        error: 'Duplicate booking conflict',
        code: 'BOOKING_CONFLICT'
      });
    }
    if (e?.statusCode && e?.code) {
      return res.status(e.statusCode).json({
        error: e.message,
        code: e.code
      });
    }

    monitoring.recordBookingStatus('created', 'error');
    logger.withTrace(req).error(
      {
        err: {
          message: e.message,
          code: e.code || 'UNKNOWN'
        }
      },
      'failed to create booking'
    );
    return res.status(500).json({ error: e.message });
  }
});

router.post('/ai/select-driver', async (req, res) => {
  try {
    const pickup = req.body?.pickup || null;
    const vehicleType = req.body?.vehicleType || 'CAR';
    if (!pickup || !Number.isFinite(Number(pickup.lat)) || !Number.isFinite(Number(pickup.lng))) {
      return res.status(400).json({
        error: 'pickup.lat and pickup.lng are required'
      });
    }

    const traceId = req.traceId || req.header('x-trace-id');
    const authorization = req.header('authorization') || '';
    const decision = await buildAiDriverDecision({
      pickup,
      vehicleType,
      authorization,
      traceId
    });

    return res.json({
      data: {
        pickup,
        vehicle_type: vehicleType,
        available_drivers: decision.availableDrivers,
        selected_driver: decision.selectedDriver,
        decision_valid: Boolean(decision.selectedDriver)
      }
    });
  } catch (error) {
    logger.withTrace(req).error({ err: { message: error.message, code: error.code || 'UNKNOWN' } }, 'failed to select driver with ai decision');
    return res.status(500).json({ error: error.message });
  }
});

router.get('/:id/mcp-context', async (req, res) => {
  try {
    const booking = await bookingRepo.getById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const traceId = req.traceId || req.header('x-trace-id');
    const authorization = req.header('authorization') || '';
    const trafficLevel = Number.isFinite(Number(req.query.traffic_level)) ? Math.max(0, Math.min(1, Number(req.query.traffic_level))) : 0.7;
    const demandIndex = Number.isFinite(Number(req.query.demand_index)) ? Math.max(0, Number(req.query.demand_index)) : 1.5;
    const supplyIndex = Number.isFinite(Number(req.query.supply_index)) ? Math.max(0, Number(req.query.supply_index)) : 0.8;

    const [eta, quote, driverDecision] = await Promise.all([
      estimateEta({
        pickup: booking.pickup,
        drop: booking.dropoff,
        distanceKm: booking.distanceKm,
        trafficLevel
      }),
      getQuote({
        pickup: booking.pickup,
        dropoff: booking.dropoff,
        vehicleType: booking.vehicleType
      }),
      buildAiDriverDecision({
        pickup: booking.pickup,
        vehicleType: booking.vehicleType,
        authorization,
        traceId
      })
    ]);

    return res.json({
      data: {
        ride_id: booking.bookingId,
        pickup: booking.pickup,
        drop: booking.dropoff,
        available_drivers: driverDecision.availableDrivers,
        selected_driver: driverDecision.selectedDriver,
        traffic_level: trafficLevel,
        demand_index: demandIndex,
        supply_index: supplyIndex,
        eta_minutes: eta.etaMinutes,
        pricing: {
          price: Number(quote.estimatedFare || 0),
          surge: Number(quote.surge || 1),
          currency: quote.currency || 'VND'
        },
        permission_ok: true
      }
    });
  } catch (error) {
    logger.withTrace(req).error({ err: { message: error.message, code: error.code || 'UNKNOWN' } }, 'failed to build mcp context');
    return res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const bookingId = req.params.id;
    const requestedStatus = String(req.body?.status || '').toUpperCase();
    if (!requestedStatus) {
      return res.status(400).json({ error: 'status is required' });
    }
    if (requestedStatus !== 'ACCEPTED') {
      return res.status(400).json({
        error: 'Only ACCEPTED is supported in this endpoint'
      });
    }

    const driverId = String(req.body?.driver_id || req.body?.driverId || '').trim();
    if (!driverId) {
      return res.status(400).json({
        error: 'driver_id is required for ACCEPTED status'
      });
    }

    const traceId = req.traceId || req.header('x-trace-id');
    const authorization = req.header('authorization') || '';

    const eventId = crypto.randomUUID();
    const outcome = await withTransaction(async (client) => {
      const existing = await bookingRepo.getByIdForUpdate(client, bookingId);
      if (!existing) {
        return null;
      }

      const fromStatus = String(existing.status || '').toUpperCase();
      if (fromStatus !== 'REQUESTED' && fromStatus !== 'ACCEPTED' && fromStatus !== 'CONFIRMED') {
        const err = new Error(`Invalid transition from ${fromStatus} to ACCEPTED`);
        err.statusCode = 409;
        err.code = 'INVALID_STATE_TRANSITION';
        throw err;
      }

      const updated = fromStatus === 'ACCEPTED' ? existing : await bookingRepo.updateStatus(client, bookingId, 'ACCEPTED');

      if (fromStatus !== 'ACCEPTED') {
        const envelope = buildEnvelope({
          eventId,
          traceId,
          type: 'RideAccepted',
          payload: {
            event_type: 'ride_accepted',
            booking_id: updated.bookingId,
            ride_id: updated.rideId,
            driver_id: driverId,
            status: 'ACCEPTED',
            timestamp: new Date().toISOString()
          }
        });

        await outboxRepo.insertOutboxEvent(
          client,
          buildOutboxRecord({
            eventId,
            topic: topics.RideAccepted,
            eventType: 'RideAccepted',
            aggregateId: updated.bookingId,
            partitionKey: updated.rideId,
            envelope
          })
        );
      }

      return {
        booking: updated,
        eventQueued: fromStatus !== 'ACCEPTED'
      };
    });

    if (!outcome) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const notification = await sendNotification({
      userId: driverId,
      title: 'Ride Assigned',
      message: `Booking ${bookingId} has been accepted`,
      sourceService: 'booking-service',
      sourceAction: 'BOOKING_ACCEPTED',
      authorization,
      traceId
    });

    return res.json({
      booking: mapBookingCompat(outcome.booking),
      publishedEvent: outcome.eventQueued
        ? {
            topic: topics.RideAccepted,
            eventId,
            eventType: 'ride_accepted',
            queued: true
          }
        : null,
      notification
    });
  } catch (error) {
    if (error?.statusCode && error?.code) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }
    logger.withTrace(req).error({ err: { message: error.message, code: error.code || 'UNKNOWN' } }, 'failed to update booking status');
    return res.status(500).json({ error: error.message });
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const bookingId = req.params.id;
    const traceId = req.traceId || req.header('x-trace-id');
    const eventId = crypto.randomUUID();

    const canceled = await withTransaction(async (client) => {
      const existing = await bookingRepo.getByIdForUpdate(client, bookingId);
      if (!existing) {
        return null;
      }

      const updated = existing.status === 'CANCELLED' ? existing : await bookingRepo.cancel(client, bookingId);

      const envelope = buildEnvelope({
        eventId,
        traceId,
        type: 'RideCancelled',
        payload: {
          rideId: updated.rideId,
          reason: 'CANCELLED_BY_CUSTOMER',
          timestamp: new Date().toISOString()
        }
      });

      await outboxRepo.insertOutboxEvent(
        client,
        buildOutboxRecord({
          eventId,
          topic: topics.RideCancelled,
          eventType: 'RideCancelled',
          aggregateId: bookingId,
          partitionKey: updated.rideId,
          envelope
        })
      );

      return updated;
    });

    if (!canceled) {
      monitoring.recordBookingStatus('cancelled', 'error', {
        reason: 'not_found'
      });
      return res.status(404).json({ error: 'Booking not found' });
    }

    monitoring.recordBookingStatus('cancelled', 'success');

    return res.status(200).json({
      booking: mapBookingCompat(canceled),
      publishedEvent: {
        topic: topics.RideCancelled,
        eventId,
        queued: true
      }
    });
  } catch (e) {
    monitoring.recordBookingStatus('cancelled', 'error');
    logger.withTrace(req).error(
      {
        err: {
          message: e.message,
          code: e.code || 'UNKNOWN'
        }
      },
      'failed to cancel booking'
    );
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;

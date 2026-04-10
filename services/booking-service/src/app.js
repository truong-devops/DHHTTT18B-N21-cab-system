const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('crypto');
const bookingsRouter = require('./routes/bookings');
const monitoring = require('./monitoring');
const { traceMiddleware } = require('./middleware/trace');
const { requestLogger } = require('./middleware/requestLogger');
const { requireAuth, requireTrustedGateway } = require('./middleware/auth');
const logger = require('./utils/logger');

const DEMO_MAX_ASYNC_INFLIGHT = Number(process.env.DEMO_MAX_ASYNC_INFLIGHT || 2000);
let demoAsyncInflight = 0;

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(traceMiddleware);
app.use(requestLogger);
app.use(monitoring.createHttpMetricsMiddleware());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/v1/bookings', requireTrustedGateway, requireAuth, bookingsRouter);
// DEMO endpoint: publish RideCreated event
app.post('/demo/ride-created', async (req, res) => {
  try {
    const { publish } = require('./messaging/producer');
    const topics = require('./messaging/topics');

    const event = {
      eventId: crypto.randomUUID(),
      type: 'RideCreated',
      rideId: 'ride_' + Date.now(),
      pickup: { lat: 10.7, lng: 106.6 },
      timestamp: new Date().toISOString()
    };

    const asyncPublish = String(process.env.DEMO_RIDE_CREATED_ASYNC || 'true') !== 'false';
    const canQueueAsync =
      Number.isFinite(DEMO_MAX_ASYNC_INFLIGHT) && DEMO_MAX_ASYNC_INFLIGHT > 0
        ? demoAsyncInflight < DEMO_MAX_ASYNC_INFLIGHT
        : true;

    if (asyncPublish) {
      if (canQueueAsync) {
        demoAsyncInflight += 1;
        publish(topics.RideCreated, event, { key: event.rideId })
          .catch((publishError) => {
            logger.withTrace(req).error(
              {
                err: {
                  message: publishError.message,
                  code: publishError.code || 'UNKNOWN'
                }
              },
              'async demo ride.created publish failed'
            );
          })
          .finally(() => {
            demoAsyncInflight = Math.max(0, demoAsyncInflight - 1);
          });
      }
    } else {
      await publish(topics.RideCreated, event, {
        key: event.rideId
      });
    }

    return res.json({
      published: true,
      queued: asyncPublish && canQueueAsync,
      dropped: asyncPublish && !canQueueAsync,
      topic: topics.RideCreated,
      event
    });
  } catch (e) {
    logger.withTrace(req).error(
      {
        err: {
          message: e.message,
          code: e.code || 'UNKNOWN'
        }
      },
      'failed to publish demo ride.created'
    );
    return res.status(500).json({ error: e.message });
  }
});

module.exports = app;

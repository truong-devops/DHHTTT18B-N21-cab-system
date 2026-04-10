const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createPlacesRouter } = require('./routes/places');
const { sendError } = require('./utils/http');

function createApp({ searchService, recentRepository, defaultLimit, maxLimit }) {
  if (!searchService || typeof searchService.search !== 'function') {
    throw new Error('searchService.search is required');
  }
  if (!recentRepository || typeof recentRepository.listByUser !== 'function' || typeof recentRepository.upsertByUser !== 'function') {
    throw new Error('recentRepository with listByUser/upsertByUser is required');
  }

  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.get('/healthz', (_req, res) => res.json({ ok: true }));
  app.get('/readyz', (_req, res) => res.json({ ok: true }));

  app.use(
    createPlacesRouter({
      searchService,
      recentRepository,
      defaultLimit,
      maxLimit
    })
  );

  app.use((err, _req, res, next) => {
    if (err) {
      return sendError(res, 500, 'INTERNAL', 'Internal server error');
    }
    return next();
  });

  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        details: []
      }
    });
  });

  return app;
}

module.exports = { createApp };

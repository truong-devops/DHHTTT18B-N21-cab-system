const express = require('express');
const { sendError } = require('../utils/http');
const { toFiniteNumber } = require('../utils/normalize');

function parseLimit(value, defaultLimit, maxLimit) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultLimit;
  return Math.min(maxLimit, Math.floor(parsed));
}

function resolveUserId(req) {
  return String(req.header('x-user-id') || '').trim() || 'anonymous';
}

function normalizePlacePayload(body) {
  const label = String(body?.label || body?.place?.label || '').trim();
  const address = String(body?.address || body?.place?.address || '').trim();
  const lat = toFiniteNumber(body?.lat ?? body?.location?.lat ?? body?.place?.location?.lat);
  const lng = toFiniteNumber(body?.lng ?? body?.location?.lng ?? body?.place?.location?.lng);
  const explicitId = String(body?.id || body?.placeId || body?.place?.id || body?.place?.placeId || '').trim();

  return {
    id: explicitId || label,
    label,
    address: address || label,
    lat,
    lng
  };
}

function mapToApiItem(item) {
  const payload = {
    id: String(item?.id || item?.label || ''),
    label: String(item?.label || '').trim(),
    description: String(item?.address || item?.label || '').trim(),
    address: String(item?.address || item?.label || '').trim()
  };

  const lat = toFiniteNumber(item?.lat);
  const lng = toFiniteNumber(item?.lng);
  if (lat !== null && lng !== null) {
    payload.location = { lat, lng };
  }
  return payload;
}

function runAsync(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function createPlacesRouter({ searchService, recentRepository, defaultLimit, maxLimit }) {
  const router = express.Router();

  router.get(
    '/v1/places/autocomplete',
    runAsync(async (req, res) => {
      const q = String(req.query.q || '').trim();
      const limit = parseLimit(req.query.limit, defaultLimit, maxLimit);
      const lat = toFiniteNumber(req.query.lat);
      const lng = toFiniteNumber(req.query.lng);

      const items = await searchService.search({ query: q, limit, lat, lng });
      return res.json({
        data: {
          items: items.map(mapToApiItem)
        }
      });
    })
  );

  router.get(
    '/v1/places/recent',
    runAsync(async (req, res) => {
      const userId = resolveUserId(req);
      const limit = parseLimit(req.query.limit, defaultLimit, maxLimit);
      const items = await recentRepository.listByUser(userId, limit);

      return res.json({
        data: {
          items: items.map(mapToApiItem)
        }
      });
    })
  );

  router.post(
    '/v1/places/recent',
    runAsync(async (req, res) => {
      const userId = resolveUserId(req);
      const payload = normalizePlacePayload(req.body || {});

      if (!payload.label) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'label is required', [
          {
            path: 'body.label',
            message: 'is required'
          }
        ]);
      }

      if (payload.label.length > 120) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'label exceeds 120 characters', [
          {
            path: 'body.label',
            message: 'max length is 120'
          }
        ]);
      }

      await recentRepository.upsertByUser(userId, payload);
      const items = await recentRepository.listByUser(userId, defaultLimit);

      return res.status(201).json({
        ok: true,
        data: {
          items: items.map(mapToApiItem)
        }
      });
    })
  );

  return router;
}

module.exports = { createPlacesRouter, parseLimit, resolveUserId, mapToApiItem, normalizePlacePayload };

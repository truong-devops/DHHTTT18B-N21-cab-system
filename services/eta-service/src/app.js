const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const monitoring = require('./monitoring');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(monitoring.createHttpMetricsMiddleware());

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function haversineKm(from, to) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const lat1 = toNumber(from?.lat);
  const lng1 = toNumber(from?.lng);
  const lat2 = toNumber(to?.lat);
  const lng2 = toNumber(to?.lng);

  if (lat1 === null || lng1 === null || lat2 === null || lng2 === null) {
    return null;
  }

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.get('/readyz', (_req, res) => res.json({ ok: true }));

app.post('/v1/eta/estimate', (req, res) => {
  const body = req.body || {};
  const distanceInput = toNumber(body.distance_km);
  const computedDistance = haversineKm(body.pickup, body.drop);
  const distanceKm = distanceInput !== null && distanceInput >= 0 ? distanceInput : computedDistance !== null ? computedDistance : null;

  if (distanceKm === null || distanceKm < 0) {
    return res.status(400).json({
      error: 'distance_km or pickup/drop coordinates are required'
    });
  }

  const trafficLevelRaw = toNumber(body.traffic_level);
  const trafficLevel = trafficLevelRaw === null ? 0.4 : Math.min(1, Math.max(0, trafficLevelRaw));

  if (distanceKm === 0) {
    monitoring.recordBusinessEvent({
      domain: 'eta',
      event: 'estimate',
      outcome: 'success',
      attributes: { bucket: 'zero_distance' }
    });
    return res.json({
      data: {
        distance_km: 0,
        traffic_level: trafficLevel,
        eta_minutes: 0
      }
    });
  }

  const speedKmh = Math.max(8, 30 - trafficLevel * 16);
  const etaMinutes = Math.max(1, Math.round((distanceKm / speedKmh) * 60));

  monitoring.recordBusinessEvent({
    domain: 'eta',
    event: 'estimate',
    outcome: 'success'
  });

  return res.json({
    data: {
      distance_km: Number(distanceKm.toFixed(3)),
      traffic_level: trafficLevel,
      eta_minutes: etaMinutes
    }
  });
});

module.exports = app;

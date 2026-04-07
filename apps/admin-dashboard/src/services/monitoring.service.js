import { isMock } from './api.service.js';
import { mockMonitoring } from './mock.data.js';
import { driverService } from './driver.service.js';
import { rideService } from './ride.service.js';

const REALTIME_WS_URL = import.meta.env.VITE_REALTIME_WS_URL;
let realtimeSocket = null;
let realtimeReconnect = null;
let liveMarkers = null;
const mapSubscribers = new Set();

let mockPositions = null;

const MOCK_BOUNDS = {
  minLat: 10.72,
  maxLat: 10.82,
  minLng: 106.62,
  maxLng: 106.74
};

function randomDelta(scale = 0.00045) {
  return (Math.random() - 0.5) * scale;
}

function initMockPositions() {
  mockPositions = mockMonitoring.map.map((marker) => ({
    ...marker,
    lat: Number(marker.lat),
    lng: Number(marker.lng),
    vx: randomDelta(0.0006),
    vy: randomDelta(0.0006)
  }));
}

function stepMockPositions() {
  if (!mockPositions || mockPositions.length !== mockMonitoring.map.length) {
    initMockPositions();
  }

  mockPositions = mockPositions.map((marker) => {
    let lat = marker.lat + marker.vx + randomDelta(0.00025);
    let lng = marker.lng + marker.vy + randomDelta(0.00025);
    let vx = marker.vx;
    let vy = marker.vy;

    if (lat < MOCK_BOUNDS.minLat || lat > MOCK_BOUNDS.maxLat) {
      vx = -vx;
      lat = Math.min(MOCK_BOUNDS.maxLat, Math.max(MOCK_BOUNDS.minLat, lat));
    }

    if (lng < MOCK_BOUNDS.minLng || lng > MOCK_BOUNDS.maxLng) {
      vy = -vy;
      lng = Math.min(MOCK_BOUNDS.maxLng, Math.max(MOCK_BOUNDS.minLng, lng));
    }

    return { ...marker, lat, lng, vx, vy };
  });

  return mockPositions.map(({ id, type, lat, lng }) => ({ id, type, lat, lng }));
}

function normalizeMarkerList(markers) {
  if (!Array.isArray(markers)) return [];
  return markers
    .map((marker) => ({
      ...marker,
      lat: Number(marker.lat),
      lng: Number(marker.lng)
    }))
    .filter((marker) => Number.isFinite(marker.lat) && Number.isFinite(marker.lng));
}

function notifyMapSubscribers(markers) {
  liveMarkers = normalizeMarkerList(markers);
  mapSubscribers.forEach((handler) => handler(liveMarkers));
}

function scheduleRealtimeReconnect() {
  if (realtimeReconnect || !REALTIME_WS_URL) return;
  realtimeReconnect = setTimeout(() => {
    realtimeReconnect = null;
    connectRealtime();
  }, 1500);
}

function connectRealtime() {
  if (!REALTIME_WS_URL || typeof WebSocket === 'undefined') return;
  if (realtimeSocket && (realtimeSocket.readyState === WebSocket.OPEN || realtimeSocket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  realtimeSocket = new WebSocket(REALTIME_WS_URL);

  realtimeSocket.addEventListener('message', (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (Array.isArray(payload)) {
        notifyMapSubscribers(payload);
        return;
      }

      const messageType = payload?.type;
      const markers = payload?.payload ?? payload?.markers ?? payload?.data;
      if (messageType === 'positions' || messageType === 'map') {
        notifyMapSubscribers(markers);
      }
    } catch (error) {
      // ignore malformed frames
    }
  });

  realtimeSocket.addEventListener('close', () => {
    realtimeSocket = null;
    if (mapSubscribers.size > 0) {
      scheduleRealtimeReconnect();
    }
  });

  realtimeSocket.addEventListener('error', () => {
    if (realtimeSocket) {
      realtimeSocket.close();
    }
  });
}

function disconnectRealtime() {
  if (realtimeReconnect) {
    clearTimeout(realtimeReconnect);
    realtimeReconnect = null;
  }
  if (realtimeSocket) {
    realtimeSocket.close();
    realtimeSocket = null;
  }
  liveMarkers = null;
}

function subscribeMapStream(handler) {
  if (!REALTIME_WS_URL || typeof WebSocket === 'undefined') {
    return () => {};
  }

  mapSubscribers.add(handler);
  connectRealtime();

  if (liveMarkers) {
    handler(liveMarkers);
  }

  return () => {
    mapSubscribers.delete(handler);
    if (mapSubscribers.size === 0) {
      disconnectRealtime();
    }
  };
}

function hasLiveMapStream() {
  return Boolean(REALTIME_WS_URL && typeof WebSocket !== 'undefined');
}

export const monitoringService = {
  async getCounters() {
    if (isMock) {
      return mockMonitoring.counters;
    }

    const [driversResult, ridesResult] = await Promise.all([driverService.list({}), rideService.list({ limit: 100 })]);

    const drivers = driversResult.items || [];
    const rides = ridesResult.items || [];

    const activeDrivers = drivers.filter((driver) => driver.onlineStatus === 'ONLINE').length;
    const busyDrivers = drivers.filter((driver) => driver.onlineStatus === 'BUSY').length;
    const ridesInProgress = rides.filter((ride) => !['completed', 'cancelled'].includes(ride.status)).length;
    const alerts = drivers.filter((driver) => driver.status === 'SUSPENDED').length;

    return { activeDrivers, busyDrivers, ridesInProgress, alerts };
  },

  async getMapSnapshot() {
    if (hasLiveMapStream() && liveMarkers) {
      return liveMarkers;
    }

    if (isMock) {
      return stepMockPositions();
    }

    const [driversResult, ridesResult] = await Promise.all([driverService.list({}), rideService.list({ limit: 50 })]);

    const driverMarkers = (driversResult.items || [])
      .filter((driver) => driver.location?.lat && driver.location?.lng)
      .map((driver) => ({
        id: driver.id,
        type: 'driver',
        lat: driver.location.lat,
        lng: driver.location.lng
      }));

    const rideMarkers = (ridesResult.items || [])
      .filter((ride) => ride.pickupLat && ride.pickupLng)
      .map((ride) => ({
        id: ride.id,
        type: 'ride',
        lat: ride.pickupLat,
        lng: ride.pickupLng
      }));

    return [...driverMarkers, ...rideMarkers].slice(0, 30);
  },

  hasLiveMapStream,
  subscribeMapStream
};

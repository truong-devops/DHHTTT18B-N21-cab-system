import http from 'k6/http';
import encoding from 'k6/encoding';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || __ENV.BOOKING_URL || 'http://host.docker.internal:3000';
const USER_TOKEN = __ENV.USER_TOKEN || '';
const INTERNAL_API_KEY = __ENV.INTERNAL_API_KEY || 'dev-internal-key';

function parseTokens() {
  if (__ENV.CASE61_TOKENS_FILE) {
    try {
      const raw = open(__ENV.CASE61_TOKENS_FILE);
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((t) => String(t)).filter(Boolean);
      }
    } catch (_e) {
      // fallback below
    }
  }
  if (__ENV.CASE61_TOKENS_B64) {
    try {
      const json = encoding.b64decode(__ENV.CASE61_TOKENS_B64, 'std', 's');
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((t) => String(t)).filter(Boolean);
      }
    } catch (_e) {
      // fallback below
    }
  }
  if (__ENV.CASE61_TOKENS_JSON) {
    try {
      const parsed = JSON.parse(__ENV.CASE61_TOKENS_JSON);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((t) => String(t)).filter(Boolean);
      }
    } catch (_e) {
      // fallback below
    }
  }
  return USER_TOKEN ? [USER_TOKEN] : [];
}

const TOKENS = parseTokens();

const successRate = new Rate('case61_success_rate');
const serverErrorRate = new Rate('case61_server_error_rate');

export const options = {
  scenarios: {
    case61_booking_rps: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.CASE61_RATE || 1000),
      timeUnit: '1s',
      duration: __ENV.CASE61_DURATION || '20s',
      preAllocatedVUs: Number(__ENV.CASE61_VUS || 300),
      maxVUs: Number(__ENV.CASE61_MAX_VUS || 1200)
    }
  },
  thresholds: {
    case61_server_error_rate: ['rate<0.01'],
    case61_success_rate: ['rate>0.95'],
    http_req_failed: ['rate<0.05'],
    'http_req_duration{case:61}': ['p(95)<450', 'p(99)<900']
  }
};

export default function () {
  const payload = JSON.stringify({
    pickup: { lat: 10.762622, lng: 106.660172 },
    drop: { lat: 10.780403, lng: 106.700928 },
    vehicleType: 'CAR'
  });

  const token = TOKENS.length > 0 ? TOKENS[(__VU + __ITER) % TOKENS.length] : '';
  const headers = {
    'Content-Type': 'application/json',
    'x-internal-api-key': INTERNAL_API_KEY,
    'X-Load-Test': '1'
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = http.post(`${BASE_URL}/v1/bookings`, payload, {
    headers,
    timeout: __ENV.CASE61_TIMEOUT || '3s',
    tags: { case: '61', endpoint: 'bookings' }
  });

  const timedOut = Boolean(res.error_code);
  const statusOk = res.status >= 200 && res.status < 300;
  const success = statusOk && !timedOut;
  const serverError = res.status >= 500;

  successRate.add(success);
  serverErrorRate.add(serverError);

  check(res, {
    'case61 status success': () => statusOk,
    'case61 no timeout': () => !timedOut
  });

  sleep(0.001);
}

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://host.docker.internal:3000';
const USER_TOKEN = __ENV.USER_TOKEN || '';
const INTERNAL_API_KEY = __ENV.INTERNAL_API_KEY || 'dev-internal-key';

function parseTokens() {
  if (__ENV.CASE69_TOKENS_FILE) {
    try {
      const raw = open(__ENV.CASE69_TOKENS_FILE);
      const parsed = JSON.parse(raw);
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

const successRate = new Rate('case69_success_rate');
const timeoutRate = new Rate('case69_timeout_rate');
const serverErrorRate = new Rate('case69_server_error_rate');

export const options = {
  scenarios: {
    case69_peak_ramp: {
      executor: 'ramping-arrival-rate',
      startRate: Number(__ENV.CASE69_START_RATE || 100),
      timeUnit: '1s',
      preAllocatedVUs: Number(__ENV.CASE69_VUS || 250),
      maxVUs: Number(__ENV.CASE69_MAX_VUS || 1200),
      stages: [
        { target: Number(__ENV.CASE69_STAGE1 || 250), duration: __ENV.CASE69_STAGE1_DURATION || '5s' },
        { target: Number(__ENV.CASE69_STAGE2 || 500), duration: __ENV.CASE69_STAGE2_DURATION || '5s' },
        { target: Number(__ENV.CASE69_STAGE3 || 800), duration: __ENV.CASE69_STAGE3_DURATION || '5s' },
        { target: Number(__ENV.CASE69_STAGE4 || 1000), duration: __ENV.CASE69_STAGE4_DURATION || '5s' }
      ]
    }
  },
  thresholds: {
    case69_success_rate: ['rate>0.95'],
    case69_timeout_rate: ['rate==0'],
    case69_server_error_rate: ['rate<0.01'],
    http_req_failed: ['rate<0.05'],
    'http_req_duration{case:69}': ['p(95)<300', 'p(99)<900'],
    dropped_iterations: ['count<500']
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
    'X-Load-Test': '1',
    'x-internal-api-key': INTERNAL_API_KEY
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = http.post(`${BASE_URL}/v1/bookings`, payload, {
    headers,
    timeout: __ENV.CASE69_TIMEOUT || '3s',
    tags: { case: '69', endpoint: 'bookings' }
  });

  const timedOut =
    res.timedOut === true ||
    res.status === 0 ||
    String(res.error || '').toLowerCase().includes('timeout');
  const statusOk = res.status >= 200 && res.status < 300;
  const serverError = res.status >= 500;

  successRate.add(statusOk && !timedOut);
  timeoutRate.add(timedOut);
  serverErrorRate.add(serverError);

  check(res, {
    'case69 status success': () => statusOk,
    'case69 no timeout': () => !timedOut
  });

  sleep(0.001);
}

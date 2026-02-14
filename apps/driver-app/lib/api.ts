import { API_BASE_URL, requireApiBaseUrl } from './config';
import { addLog } from './log-store';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './token-store';

export type ApiError = {
  status: number;
  code?: string;
  message: string;
  details?: unknown;
  raw?: unknown;
};

export type RequestOptions = {
  method?: string;
  path: string;
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
  retryAuth?: boolean;
  timeoutMs?: number;
};

let onAuthFailure: (() => void) | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setOnAuthFailure(handler: (() => void) | null) {
  onAuthFailure = handler;
}

function buildUrl(path: string, params?: RequestOptions['params']) {
  const base = requireApiBaseUrl();
  const url = new URL(path, base);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined) return;
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

async function parseResponseBody(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  const refreshToken = getRefreshToken();
  if (!refreshToken || !API_BASE_URL) {
    return null;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });
      const json = await parseResponseBody(res);
      if (!res.ok) {
        await clearTokens();
        onAuthFailure?.();
        return null;
      }
      const accessToken = json?.tokens?.accessToken;
      const nextRefreshToken = json?.tokens?.refreshToken;
      if (accessToken && nextRefreshToken) {
        await setTokens(accessToken, nextRefreshToken);
        return accessToken;
      }
      await clearTokens();
      onAuthFailure?.();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function apiRequest<T>(options: RequestOptions): Promise<T> {
  const {
    method = 'GET',
    path,
    params,
    body,
    headers = {},
    auth = true,
    retryAuth = true,
    timeoutMs = 15000,
  } = options;

  const url = buildUrl(path, params);
  const start = Date.now();
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    ...headers,
  };

  if (auth) {
    const token = getAccessToken();
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }
  }

  const res = await fetchWithTimeout(
    url,
    {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    },
    timeoutMs,
  );

  const durationMs = Date.now() - start;
  const payload = await parseResponseBody(res);
  const requestId =
    (payload && (payload.requestId || payload.traceId || payload?.meta?.requestId)) ||
    res.headers.get('x-request-id') ||
    res.headers.get('x-correlation-id') ||
    undefined;

  if (res.status === 401 && auth && retryAuth) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiRequest<T>({ ...options, retryAuth: false });
    }
  }

  if (!res.ok) {
    const error: ApiError = {
      status: res.status,
      code: payload?.error?.code || payload?.code,
      message: payload?.error?.message || payload?.message || res.statusText,
      details: payload?.error?.details || payload?.details,
      raw: payload,
    };

    addLog({
      id: `${Date.now()}-${Math.random()}`,
      ts: Date.now(),
      method,
      url,
      status: res.status,
      durationMs,
      requestId: requestId ?? undefined,
      error: error.message,
    });

    if (__DEV__) {
      // Do not log tokens, only metadata
      console.warn('[API]', method, url, res.status, `${durationMs}ms`, error.message);
    }

    throw error;
  }

  addLog({
    id: `${Date.now()}-${Math.random()}`,
    ts: Date.now(),
    method,
    url,
    status: res.status,
    durationMs,
    requestId: requestId ?? undefined,
  });

  if (__DEV__) {
    console.info('[API]', method, url, res.status, `${durationMs}ms`);
  }

  return payload as T;
}

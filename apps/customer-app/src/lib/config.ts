import Constants from 'expo-constants';

function inferApiBaseUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const protocol = window.location.protocol || 'http:';
    return `${protocol}//${window.location.hostname}:3000`;
  }

  const hostUri = Constants.expoConfig?.hostUri || '';
  const host = hostUri.split(':')[0];
  if (host) {
    return `http://${host}:3000`;
  }

  return 'http://127.0.0.1:3000';
}

export const API_BASE_URL = inferApiBaseUrl();

export function requireApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error('Thiếu địa chỉ API base URL');
  }
  return API_BASE_URL;
}

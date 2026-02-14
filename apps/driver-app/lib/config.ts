export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || '';
export const WS_BASE_URL = process.env.EXPO_PUBLIC_WS_URL || '';

export function requireApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error('Missing EXPO_PUBLIC_API_BASE_URL');
  }
  return API_BASE_URL;
}

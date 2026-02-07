import { apiRequest } from '../api';

export type AuthResponse = {
  data: {
    id: string;
    email: string;
    username?: string | null;
    role: string;
    status: string;
    createdAt: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
  };
};

export async function login(identifier: string, password: string) {
  return apiRequest<AuthResponse>({
    method: 'POST',
    path: '/v1/auth/login',
    body: { identifier, password },
    auth: false,
  });
}

export async function refresh(refreshToken: string) {
  return apiRequest<AuthResponse>({
    method: 'POST',
    path: '/v1/auth/refresh',
    body: { refreshToken },
    auth: false,
    retryAuth: false,
  });
}

export async function getMe() {
  return apiRequest<{ data: AuthResponse['data'] }>({
    method: 'GET',
    path: '/v1/auth/me',
  });
}

export async function logout(refreshToken: string) {
  return apiRequest<{ ok: boolean }>({
    method: 'POST',
    path: '/v1/auth/logout',
    body: { refreshToken },
    auth: false,
    retryAuth: false,
  });
}

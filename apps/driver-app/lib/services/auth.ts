import { apiRequest } from '../api';
import { endpoints } from '../endpoints';

export type AuthResponse = {
  data: {
    id: string;
    email?: string | null;
    username?: string | null;
    role?: string | null;
    status?: string | null;
    createdAt?: string | null;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
  };
};

export type VerifyResponse = {
  data: {
    userId: string;
    role?: string | null;
    roles?: string[] | null;
  };
};

export async function login(identifier: string, password: string) {
  return apiRequest<AuthResponse>({
    method: 'POST',
    path: endpoints.auth.login,
    body: { identifier, password },
    auth: false,
  });
}

export async function refresh(refreshToken: string) {
  return apiRequest<AuthResponse>({
    method: 'POST',
    path: endpoints.auth.refresh,
    body: { refreshToken },
    auth: false,
    retryAuth: false,
  });
}

export async function getMe() {
  return apiRequest<VerifyResponse>({
    method: 'GET',
    path: endpoints.auth.verify,
  });
}

export async function logout(refreshToken: string) {
  return apiRequest<{ ok: boolean }>({
    method: 'POST',
    path: endpoints.auth.logout,
    body: { refreshToken },
    auth: false,
    retryAuth: false,
  });
}

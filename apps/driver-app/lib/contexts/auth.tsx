import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authApi from '@/lib/services/auth';
import { hydrateTokens, setTokens, clearTokens, getRefreshToken } from '@/lib/token-store';
import { setOnAuthFailure } from '@/lib/api';

export type AuthUser = {
  id: string;
  email: string;
  username?: string | null;
  role: string;
  status: string;
  createdAt: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isReady: boolean;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const syncTokens = useCallback((nextAccess: string | null, nextRefresh: string | null) => {
    setAccessToken(nextAccess);
    setRefreshToken(nextRefresh);
  }, []);

  const logout = useCallback(async () => {
    const refresh = getRefreshToken();
    if (refresh) {
      try {
        await authApi.logout(refresh);
      } catch {
        // ignore logout errors
      }
    }
    await clearTokens();
    syncTokens(null, null);
    setUser(null);
  }, [syncTokens]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const result = await authApi.login(identifier, password);
      await setTokens(result.tokens.accessToken, result.tokens.refreshToken);
      syncTokens(result.tokens.accessToken, result.tokens.refreshToken);
      setUser(result.data);
    },
    [syncTokens],
  );

  useEffect(() => {
    setOnAuthFailure(() => {
      void logout();
    });
  }, [logout]);

  useEffect(() => {
    let mounted = true;
    hydrateTokens()
      .then(async ({ accessToken: storedAccess, refreshToken: storedRefresh }) => {
        if (!mounted) return;
        syncTokens(storedAccess, storedRefresh);
        if (storedAccess) {
          try {
            const me = await authApi.getMe();
            if (mounted) setUser(me.data);
          } catch {
            await clearTokens();
            if (mounted) {
              syncTokens(null, null);
              setUser(null);
            }
          }
        }
      })
      .finally(() => {
        if (mounted) setIsReady(true);
      });

    return () => {
      mounted = false;
    };
  }, [syncTokens]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      refreshToken,
      isReady,
      isAuthenticated: Boolean(accessToken),
      login,
      logout,
    }),
    [user, accessToken, refreshToken, isReady, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

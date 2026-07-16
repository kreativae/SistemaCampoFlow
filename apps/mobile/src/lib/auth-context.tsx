import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiFetch, ApiError } from './api';
import type { AuthResponse, User } from './types';

const AUTH_KEY = 'campoflow.auth';

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string, mfaCode?: string) => Promise<{ mfaRequired: boolean }>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  accessToken: null,
  loading: true,
  login: async () => ({ mfaRequired: false }),
  register: async () => {},
  loginWithTokens: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(AUTH_KEY);
        if (raw) {
          const stored = JSON.parse(raw);
          setAccessToken(stored.accessToken);
          setUser(stored.user);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (data: AuthResponse) => {
    setUser(data.user ?? null);
    setAccessToken(data.accessToken ?? null);
    await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify(data));
  }, []);

  const login = useCallback(async (email: string, password: string, mfaCode?: string) => {
    const body: Record<string, string> = { email, password };
    if (mfaCode) body.mfaCode = mfaCode;

    const data = await apiFetch<AuthResponse & { mfaRequired?: boolean }>('/auth/login', {
      method: 'POST',
      body,
    });

    if (data.mfaRequired) return { mfaRequired: true };

    await persist(data);
    return { mfaRequired: false };
  }, [persist]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const data = await apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: { email, password, name },
    });
    await persist(data);
  }, [persist]);

  const loginWithTokens = useCallback(async (at: string, rt: string) => {
    const me = await apiFetch<User>('/auth/me', { token: at });
    const data: AuthResponse = { user: me, accessToken: at, refreshToken: rt };
    await persist(data);
  }, [persist]);

  const logout = useCallback(async () => {
    setUser(null);
    setAccessToken(null);
    await SecureStore.deleteItemAsync(AUTH_KEY);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!accessToken) return;
    try {
      const me = await apiFetch<User>('/auth/me', { token: accessToken });
      setUser(me);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await logout();
      }
    }
  }, [accessToken, logout]);

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, register, loginWithTokens, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

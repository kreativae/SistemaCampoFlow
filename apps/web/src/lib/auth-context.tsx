'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch, setTokenRefresher } from './api';
import type { AuthResponse, User } from './types';

const STORAGE_KEY = 'campoflow.auth';

interface StoredAuth {
  user: User;
  accessToken: string;
  refreshToken: string;
}

/**
 * "Lembrar-me" escolhe onde a sessão fica guardada: localStorage sobrevive ao
 * fechar o navegador, sessionStorage morre com a aba. Em computador
 * compartilhado — escritório da fazenda, lan house — desmarcar garante que a
 * sessão não fique para o próximo.
 */
function readStored(): StoredAuth | null {
  for (const store of [localStorage, sessionStorage]) {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) continue;
    try {
      return JSON.parse(raw) as StoredAuth;
    } catch {
      store.removeItem(STORAGE_KEY);
    }
  }
  return null;
}

function persist(auth: StoredAuth | null, remember?: boolean) {
  if (!auth) {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  // Sem `remember` explícito (renovação de token, refreshUser, cadastro, login
  // social), só fica em sessionStorage quem já estava lá — assim uma sessão
  // marcada como temporária não vira permanente pelo caminho.
  const target =
    remember === undefined
      ? sessionStorage.getItem(STORAGE_KEY)
        ? sessionStorage
        : localStorage
      : remember
        ? localStorage
        : sessionStorage;
  const other = target === localStorage ? sessionStorage : localStorage;
  other.removeItem(STORAGE_KEY);
  target.setItem(STORAGE_KEY, JSON.stringify(auth));
}

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (
    email: string,
    password: string,
    mfaCode?: string,
    remember?: boolean,
  ) => Promise<{ mfaRequired: boolean }>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  // Platform staff have no customer features (no Account/Subscription of their
  // own — see AuthService.register) and the API blocks them from every non-/admin,
  // non-/auth route. Mirrors the inverse check in admin/layout.tsx, but lives here
  // so it applies app-wide instead of only inside the customer pages staff would
  // otherwise be allowed to land on.
  useEffect(() => {
    if (loading || !user) return;
    if (user.isPlatformAdmin && !pathname.startsWith('/admin')) {
      router.replace('/admin');
    }
  }, [loading, user, pathname, router]);

  useEffect(() => {
    const stored = readStored();
    if (stored) {
      // Hydrating client-only auth state from storage on mount is the intended use case here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser(stored.user);
      setAccessToken(stored.accessToken);
    }
    setLoading(false);
  }, []);

  // Ensina o apiFetch a renovar o access token expirado sem derrubar o usuário.
  useEffect(() => {
    setTokenRefresher(async () => {
      const stored = readStored();
      if (!stored?.refreshToken) return null;
      try {
        const res = await apiFetch<AuthResponse>('/auth/refresh', {
          method: 'POST',
          body: { refreshToken: stored.refreshToken },
        });
        setAccessToken(res.accessToken!);
        persist({
          user: stored.user,
          accessToken: res.accessToken!,
          refreshToken: res.refreshToken!,
        });
        return res.accessToken!;
      } catch {
        // Refresh token vencido ou revogado: aí sim a sessão acabou.
        setUser(null);
        setAccessToken(null);
        persist(null);
        return null;
      }
    });
    return () => setTokenRefresher(null);
  }, []);

  async function login(email: string, password: string, mfaCode?: string, remember = true) {
    const res = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password, mfaCode },
    });
    if (res.mfaRequired) {
      return { mfaRequired: true };
    }
    setUser(res.user!);
    setAccessToken(res.accessToken!);
    persist(
      { user: res.user!, accessToken: res.accessToken!, refreshToken: res.refreshToken! },
      remember,
    );
    return { mfaRequired: false };
  }

  async function register(email: string, password: string, name: string) {
    const res = await apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: { email, password, name },
    });
    setUser(res.user!);
    setAccessToken(res.accessToken!);
    persist({ user: res.user!, accessToken: res.accessToken!, refreshToken: res.refreshToken! });
  }

  async function loginWithTokens(accessToken: string, refreshToken: string) {
    const fetchedUser = await apiFetch<User>('/auth/me', { token: accessToken });
    setUser(fetchedUser);
    setAccessToken(accessToken);
    persist({ user: fetchedUser, accessToken, refreshToken });
  }

  function logout() {
    setUser(null);
    setAccessToken(null);
    persist(null);
  }

  async function refreshUser() {
    if (!accessToken) return;
    const freshUser = await apiFetch<User>('/auth/me', { token: accessToken });
    setUser(freshUser);
    const stored = readStored();
    if (stored) {
      persist({ ...stored, user: freshUser });
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, accessToken, loading, login, register, loginWithTokens, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return ctx;
}

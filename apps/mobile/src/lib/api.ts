import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as SecureStore from 'expo-secure-store';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

let _globalToken: string | null = null;
export function setGlobalToken(token: string | null) { _globalToken = token; }

let _onTokenRefreshed: ((accessToken: string, refreshToken: string) => void) | null = null;
export function setOnTokenRefreshed(cb: ((accessToken: string, refreshToken: string) => void) | null) {
  _onTokenRefreshed = cb;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
  _retried?: boolean;
}

let _refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  try {
    const raw = await SecureStore.getItemAsync('campoflow.auth');
    if (!raw) return null;
    const stored = JSON.parse(raw);
    if (!stored.refreshToken) return null;

    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: stored.refreshToken }),
    });
    if (!res.ok) return null;

    const data = await res.json();
    _globalToken = data.accessToken;
    if (_onTokenRefreshed) _onTokenRefreshed(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = options.token ?? _globalToken;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401 && !options._retried && !options.token) {
    if (!_refreshPromise) _refreshPromise = tryRefresh().finally(() => { _refreshPromise = null; });
    const newToken = await _refreshPromise;
    if (newToken) {
      return apiFetch<T>(path, { ...options, _retried: true });
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data = (await response.json().catch(() => null)) as
    | (T & { message?: string | string[] })
    | null;

  if (!response.ok) {
    const message = data?.message
      ? Array.isArray(data.message)
        ? data.message.join(', ')
        : data.message
      : 'Erro inesperado ao comunicar com o servidor';
    throw new ApiError(message, response.status);
  }

  return data as T;
}

export async function apiUpload<T>(
  path: string,
  formData: FormData,
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {};
  const t = token ?? _globalToken;
  if (t) {
    headers.Authorization = `Bearer ${t}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = (await response.json().catch(() => null)) as
    | (T & { message?: string | string[] })
    | null;

  if (!response.ok) {
    const message = data?.message
      ? Array.isArray(data.message)
        ? data.message.join(', ')
        : data.message
      : 'Erro ao enviar arquivo';
    throw new ApiError(message, response.status);
  }

  return data as T;
}

export async function apiDownload(
  path: string,
  fileName: string,
  token?: string | null,
): Promise<void> {
  const uri = `${API_URL}${path}`;
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
  const result = await FileSystem.downloadAsync(uri, fileUri, {
    headers: (token ?? _globalToken) ? { Authorization: `Bearer ${token ?? _globalToken}` } : {},
  });
  if (result.status !== 200) throw new ApiError('Erro ao baixar arquivo', result.status);

  await Sharing.shareAsync(result.uri);
}

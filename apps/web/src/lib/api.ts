export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

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
  /** Uso interno: impede que a própria retentativa dispare outra renovação. */
  skipRefresh?: boolean;
}

/**
 * O access token dura 15 minutos. Sem renovar, o usuário era desconectado nesse
 * intervalo mesmo com a sessão guardada — o AuthProvider registra aqui como
 * trocar o refresh token por um novo par, e o apiFetch repete a requisição.
 */
type TokenRefresher = () => Promise<string | null>;

let refreshHandler: TokenRefresher | null = null;
let inFlightRefresh: Promise<string | null> | null = null;

export function setTokenRefresher(handler: TokenRefresher | null) {
  refreshHandler = handler;
}

/**
 * Uma renovação por vez: as telas disparam várias requisições em paralelo e
 * todas tomam 401 juntas — sem isso, cada uma queimaria o refresh token, e
 * como a API rotaciona o token a cada uso, as demais falhariam.
 */
function refreshAccessToken(): Promise<string | null> {
  if (!refreshHandler) return Promise.resolve(null);
  inFlightRefresh ??= refreshHandler().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401 && options.token && !options.skipRefresh) {
    const renewed = await refreshAccessToken();
    if (renewed) {
      return apiFetch<T>(path, { ...options, token: renewed, skipRefresh: true });
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
  if (token) {
    headers.Authorization = `Bearer ${token}`;
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
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, { headers });
  if (!response.ok) {
    throw new ApiError('Erro ao baixar arquivo', response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

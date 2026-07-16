import { File, Paths, DownloadTask, Directory } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

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
  const uri = `${API_URL}${path}`;
  const cacheDir = new Directory(Paths.cache);
  const task = new DownloadTask(uri, cacheDir, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const file = await task.downloadAsync();
  if (!file) throw new ApiError('Erro ao baixar arquivo', 0);

  await Sharing.shareAsync(file.uri);
}

import {
  type CreateTableRequest,
  CreateTableResponseSchema,
  LobbyResponseSchema,
} from './api.schema';

const API_BASE = '/api';

interface ApiError extends Error {
  status?: number;
  code?: string;
}

async function request<T>(
  path: string,
  options?: RequestInit & { signal?: AbortSignal },
): Promise<T> {
  const startTime = performance.now();
  const requestId = crypto.randomUUID?.() || Math.random().toString(36);
  console.log(`[API] ${requestId} -> ${options?.method || 'GET'} ${path}`);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        ...options?.headers,
      },
    });

    const duration = performance.now() - startTime;
    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[API] ${requestId} <- ${response.status} in ${duration.toFixed(0)}ms: ${errorText}`,
      );
      const err: ApiError = new Error(`HTTP ${response.status}: ${errorText.slice(0, 100)}`);
      err.status = response.status;
      throw err;
    }

    const data = await response.json();
    console.log(`[API] ${requestId} <- ${response.status} in ${duration.toFixed(0)}ms`);
    return data;
  } catch (err) {
    console.error(`[API] ${requestId} network error:`, err);
    throw err;
  }
}

export async function fetchLobby(signal?: AbortSignal) {
  const data = await request('/lobby', { signal });
  return LobbyResponseSchema.parse(data);
}

export async function createTable(data: CreateTableRequest, signal?: AbortSignal) {
  const response = await request('/tables', {
    method: 'POST',
    body: JSON.stringify(data),
    signal,
  });
  return CreateTableResponseSchema.parse(response);
}

import { getToken } from './token';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: HeadersInit = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  if (!res.ok) {
    // FIX: The backend returns { "error": "..." }, so we parse errorData.error
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || errorData.message || res.statusText);
  }

  return res.json();
}

// FIX: Changed username to email
export interface LoginCredentials { email: string; password: string; }
export interface RegisterData { username: string; email: string; password: string; }

// FIX: User object only contains ID based on backend response
export interface AuthResponse { token: string; user: { id: string; }; }

export const authApi = {
  login: (creds: LoginCredentials) => request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(creds) }),
  register: (data: RegisterData) => request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
};

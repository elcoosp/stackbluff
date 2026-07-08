import { getToken } from './token';

const API_BASE = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers, credentials: 'include' });
  if (!res.ok) throw new Error((await res.json().catch(() => ({ message: res.statusText }))).message);
  return res.json();
}

export interface LoginCredentials { email: string; password: string; }
export interface RegisterData { username: string; email: string; password: string; }
export interface AuthResponse { token: string; user: { id: string; username: string; email: string; }; balance?: number; }

export const authApi = {
  login: (creds: LoginCredentials) => request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(creds) }),
  register: (data: RegisterData) => request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  forgotPassword: async (email: string) => {
    const response = await apiClient.post('/auth/forgot-password', { email });
    if (!response.ok) {
      throw new Error('Failed to send reset link');
    }
    return response.json();
  },
};

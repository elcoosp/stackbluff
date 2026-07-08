import { apiClient } from "../api/client";
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
    const response = await fetch('/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    if (!response.ok) {
      throw new Error('Failed to send reset link');
    }
    return response.json();
  },
  resetPassword: async (token: string, new_password: string) => {
    const response = await fetch('/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password }),
    });
    if (!response.ok) {
      throw new Error('Failed to reset password');
    }
    return response.json();
  },
  verifyEmail: async (token: string) => {
    const response = await fetch(`/auth/verify-email?token=${encodeURIComponent(token)}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Verification failed" }));
      throw new Error(error.message || "Verification failed");
    }
    return response.json();
  },
};

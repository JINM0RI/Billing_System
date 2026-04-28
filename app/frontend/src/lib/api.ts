const API_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api/v1';

export type AuthResponse = {
  access_token: string;
  token_type: string;
  role: string;
};

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('billing_token');
  const headers = new Headers(options.headers ?? {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `Request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function setSession(token: string, role: string) {
  localStorage.setItem('billing_token', token);
  localStorage.setItem('billing_role', role);
}

export function clearSession() {
  localStorage.removeItem('billing_token');
  localStorage.removeItem('billing_role');
}

export function getSessionRole() {
  return localStorage.getItem('billing_role');
}

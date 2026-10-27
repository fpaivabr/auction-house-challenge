export type UserRole = 'AUCTIONEER' | 'BIDDER';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
};

export type AuthResult = {
  user: AuthUser;
  accessToken: string;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/auth${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    let message = 'Não foi possível concluir a operação.';

    if (payload && typeof payload === 'object') {
      if ('error' in payload && typeof payload.error === 'string') {
        message = payload.error;
      } else if ('message' in payload && typeof payload.message === 'string') {
        message = payload.message;
      }
    }

    throw new Error(message);
  }

  return payload as T;
}

export function login(email: string, password: string) {
  return request<AuthResult>('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function register(name: string, email: string, password: string) {
  return request<AuthResult>('/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
}

export function getCurrentUser(token: string) {
  return request<{ user: AuthUser }>('/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

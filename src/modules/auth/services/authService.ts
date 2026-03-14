import { PublicHttp, clearStoredToken, getStoredToken, setStoredToken } from '../../../config/http';
import type { AuthResult, AuthUser, LoginInput, SignupInput } from '../types/model';

const AUTH_USER_STORAGE_KEY = 'qa_tracker_auth_user';

function normalizeText(value?: string) {
  return (value || '').trim();
}

function mapAuthUser(payload: { id: number; username: string; email: string }): AuthUser {
  return {
    id: payload.id,
    username: payload.username,
    email: payload.email,
  };
}

export function getStoredAuthUser() {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setStoredAuthUser(user: AuthUser | null) {
  if (typeof window === 'undefined') return;

  if (!user) {
    window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredAuthSession() {
  clearStoredToken();
  setStoredAuthUser(null);
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const response = await PublicHttp.post('/api/auth/local', {
    identifier: normalizeText(input?.identifier),
    password: input?.password || '',
  });

  const result: AuthResult = {
    jwt: response.data?.jwt,
    user: mapAuthUser(response.data?.user),
  };

  setStoredToken(result.jwt);
  setStoredAuthUser(result.user);
  return result;
}

export async function signup(input: SignupInput): Promise<AuthResult> {
  const response = await PublicHttp.post('/api/auth/signup', {
    username: normalizeText(input?.username),
    email: normalizeText(input?.email).toLowerCase(),
    password: input?.password || '',
    organizationName: normalizeText(input?.organizationName) || undefined,
  });

  const result: AuthResult = {
    jwt: response.data?.jwt,
    user: mapAuthUser(response.data?.user),
  };

  setStoredToken(result.jwt);
  setStoredAuthUser(result.user);
  return result;
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const token = getStoredToken();
  if (!token) return null;

  const response = await PublicHttp.get('/api/users/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const user = mapAuthUser(response.data);
  setStoredAuthUser(user);
  return user;
}

import {
  PublicHttp,
  clearStoredToken,
  getAccessRestrictionReason,
  getStoredToken,
  setStoredToken,
} from '../../../config/http';
import type { WorkspaceDto } from '../../workspace/types/api';
import type {
  AuthResult,
  AuthUser,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
  SignupInput,
} from '../types/model';

const AUTH_USER_STORAGE_KEY = 'qa_tracker_auth_user';
const INACTIVE_MEMBERSHIP_ACCESS_MESSAGE =
  'Tu membresía está inactiva. Pide a un administrador de tu organización que la reactive para volver a entrar.';
const INACTIVE_ORGANIZATION_ACCESS_MESSAGE =
  'Tu organización está inactiva. Un superadmin debe reactivarla para que el equipo recupere el acceso.';

function normalizeText(value?: string) {
  return (value || '').trim();
}

function mapAuthUser(payload: { id: number; username: string; email: string; isSuperAdmin?: boolean }): AuthUser {
  return {
    id: payload.id,
    username: payload.username,
    email: payload.email,
    isSuperAdmin: Boolean(payload.isSuperAdmin),
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

async function fetchWorkspaceAuthUser(token: string): Promise<AuthUser> {
  const response = await PublicHttp.get<WorkspaceDto>('/api/me/workspace', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const user = response.data?.user;

  if (!user?.id || !user.username || !user.email) {
    throw new Error('No se pudo validar la sesión actual.');
  }

  return mapAuthUser({
    id: user.id,
    username: user.username,
    email: user.email,
    isSuperAdmin: user.isSuperAdmin,
  });
}

export async function login(input: LoginInput): Promise<AuthResult> {
  try {
    const response = await PublicHttp.post('/api/auth/local', {
      identifier: normalizeText(input?.identifier),
      password: input?.password || '',
    });

    const jwt = response.data?.jwt as string | undefined;

    if (!jwt) {
      throw new Error('La autenticacion no devolvio un token valido.');
    }

    const user = await fetchWorkspaceAuthUser(jwt);
    const result: AuthResult = {
      jwt,
      user,
    };

    setStoredToken(result.jwt);
    setStoredAuthUser(result.user);
    return result;
  } catch (error) {
    clearStoredAuthSession();

    const accessRestrictionReason = getAccessRestrictionReason(error);

    if (accessRestrictionReason === 'inactive_organization') {
      throw new Error(INACTIVE_ORGANIZATION_ACCESS_MESSAGE);
    }

    if (accessRestrictionReason === 'inactive_membership') {
      throw new Error(INACTIVE_MEMBERSHIP_ACCESS_MESSAGE);
    }

    throw error;
  }
}

export async function signup(input: SignupInput): Promise<AuthResult> {
  const response = await PublicHttp.post('/api/auth/signup', {
    username: normalizeText(input?.username),
    email: normalizeText(input?.email).toLowerCase(),
    password: input?.password || '',
    passwordConfirmation: input?.passwordConfirmation || '',
    contactNumber: normalizeText(input?.contactNumber),
    organizationName: normalizeText(input?.organizationName),
  });

  const result: AuthResult = {
    jwt: response.data?.jwt,
    user: mapAuthUser(response.data?.user),
  };

  setStoredToken(result.jwt);
  setStoredAuthUser(result.user);
  return result;
}

export async function requestPasswordReset(input: ForgotPasswordInput) {
  await PublicHttp.post('/api/auth/password/forgot', {
    email: normalizeText(input?.email).toLowerCase(),
  });
}

export async function resetPassword(input: ResetPasswordInput) {
  await PublicHttp.post('/api/auth/reset-password', {
    code: normalizeText(input?.code),
    password: input?.password || '',
    passwordConfirmation: input?.passwordConfirmation || '',
  });
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const token = getStoredToken();
  if (!token) return null;

  const user = await fetchWorkspaceAuthUser(token);
  setStoredAuthUser(user);
  return user;
}

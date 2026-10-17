import {
  PublicHttp,
  clearStoredToken,
  getAccessRestrictionReason,
  getStoredToken,
  setStoredToken,
} from '../../../config/http';
import {
  clearLegacyLocalValue,
  migrateLegacyLocalValue,
  readSessionValue,
  writeSessionValue,
} from '../utils/sessionStorage';
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
const INVALID_INVITATION = 'La invitación no es válida o venció. Solicita que te reenvíen el correo.';

export function readInvitationToken(hash: string) {
  return new URLSearchParams(hash.replace(/^#/, '')).get('invitationToken') || '';
}

export function authNavigationTarget(mode: 'login' | 'signup' | 'forgot-password', documentId: string, token: string) {
  const search = new URLSearchParams({ mode });
  if (documentId) search.set('invitation', documentId);
  const fragment = token ? `#${new URLSearchParams({ invitationToken: token })}` : '';
  return `/auth?${search}${fragment}`;
}

export function invitationProofForSubmit(documentId: string, token: string, verified: boolean) {
  if (!documentId && !token) return {};
  if (!documentId || !verified || !/^[a-f0-9]{64}$/.test(token)) throw new Error(INVALID_INVITATION);
  return { invitationDocumentId: documentId, invitationToken: token };
}

export async function fetchPublicInvitation(documentId: string, token: string) {
  invitationProofForSubmit(documentId, token, true);
  if (!documentId) throw new Error(INVALID_INVITATION);
  return PublicHttp.get(`/api/organization-team/invitations/${encodeURIComponent(documentId)}/public`, {
    headers: { 'X-Invitation-Token': token },
  });
}
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

  const raw =
    readSessionValue(AUTH_USER_STORAGE_KEY) ?? migrateLegacyLocalValue(AUTH_USER_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    writeSessionValue(AUTH_USER_STORAGE_KEY, null);
    clearLegacyLocalValue(AUTH_USER_STORAGE_KEY);
    return null;
  }
}

export function setStoredAuthUser(user: AuthUser | null) {
  if (typeof window === 'undefined') return;

  if (!user) {
    writeSessionValue(AUTH_USER_STORAGE_KEY, null);
    clearLegacyLocalValue(AUTH_USER_STORAGE_KEY);
    return;
  }

  writeSessionValue(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
  clearLegacyLocalValue(AUTH_USER_STORAGE_KEY);
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
    const isInvitation = input.invitationDocumentId !== undefined || input.invitationToken !== undefined;
    const response = isInvitation
      ? await PublicHttp.post('/api/auth/invitations/accept', {
          email: normalizeText(input.identifier).toLowerCase(), password: input.password || '',
          invitationDocumentId: input.invitationDocumentId, invitationToken: input.invitationToken,
        })
      : await PublicHttp.post('/api/auth/local', {
          identifier: normalizeText(input?.identifier), password: input?.password || '',
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
    invitationDocumentId: input?.invitationDocumentId,
    invitationToken: input?.invitationToken,
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

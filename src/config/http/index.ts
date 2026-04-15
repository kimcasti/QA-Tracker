'use client';

import axios, {
  AxiosError,
  AxiosInstance,
  HttpStatusCode,
  InternalAxiosRequestConfig,
  isAxiosError,
} from 'axios';
import { apiIdentifier, apiPassword, apiUrl, useServiceAuth } from '..';

const JWT_STORAGE_KEY = 'qa_tracker_api_jwt';
const AUTH_CLEARED_EVENT = 'qa-tracker-auth-cleared';
export const ACTIVE_MEMBERSHIP_REQUIRED_MESSAGE =
  'An active organization membership is required.';

export interface ApiError {
  error?: {
    status?: number;
    name?: string;
    message?: string;
    details?: unknown;
  };
  name?: string;
  code?: string | number;
  message?: string;
  request?: {
    url?: string;
  };
}

export type AxiosResponseError = AxiosError<ApiError>;

export const Http: AxiosInstance = axios.create({
  baseURL: apiUrl || undefined,
});

export const PublicHttp: AxiosInstance = axios.create({
  baseURL: apiUrl || undefined,
});

let authTokenPromise: Promise<string | null> | null = null;

export function isApiConfigured() {
  return Boolean(apiUrl);
}

export function getStoredToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(JWT_STORAGE_KEY);
}

export function setStoredToken(token: string | null) {
  if (typeof window === 'undefined') return;

  if (!token) {
    window.localStorage.removeItem(JWT_STORAGE_KEY);
    window.dispatchEvent(new Event(AUTH_CLEARED_EVENT));
    return;
  }

  window.localStorage.setItem(JWT_STORAGE_KEY, token);
}

export function clearStoredToken() {
  setStoredToken(null);
}

export function toApiError(error: unknown) {
  if (isAxiosError<ApiError>(error)) {
    const responseMessage =
      error.response?.data?.error?.message || error.response?.data?.message || error.message;

    return {
      status: error.response?.status,
      message: responseMessage || 'Unexpected API error.',
      originalError: error,
    };
  }

  return {
    status: undefined,
    message: error instanceof Error ? error.message : 'Unexpected API error.',
    originalError: error,
  };
}

export function isActiveMembershipRequiredError(error: unknown) {
  if (!isAxiosError<ApiError>(error)) {
    return false;
  }

  const message =
    error.response?.data?.error?.message || error.response?.data?.message || error.message;

  return (
    error.response?.status === HttpStatusCode.Forbidden &&
    message === ACTIVE_MEMBERSHIP_REQUIRED_MESSAGE
  );
}

export function isDomainBackendError<T = any, D = any>(error: unknown): error is AxiosError<T, D> {
  return isAxiosError(error) && error.response?.status === HttpStatusCode.UnprocessableEntity;
}

export async function ensureAuthToken(forceRefresh = false): Promise<string | null> {
  if (!isApiConfigured()) {
    throw new Error('Backend API is not configured. Set VITE_API_URL.');
  }

  const existingToken = getStoredToken();
  if (!forceRefresh && existingToken) {
    return existingToken;
  }

  if (!useServiceAuth) {
    return null;
  }

  if (!apiIdentifier || !apiPassword) {
    throw new Error(
      'Backend service auth is not configured. Set VITE_API_IDENTIFIER and VITE_API_PASSWORD.',
    );
  }

  if (!authTokenPromise || forceRefresh) {
    authTokenPromise = PublicHttp.post('/api/auth/local', {
      identifier: apiIdentifier,
      password: apiPassword,
    })
      .then(response => {
        const token = response.data?.jwt as string | undefined;
        if (!token) {
          throw new Error('Backend authentication succeeded but no JWT was returned.');
        }

        setStoredToken(token);
        return token;
      })
      .catch(error => {
        clearStoredToken();
        throw error;
      })
      .finally(() => {
        authTokenPromise = null;
      });
  }

  return authTokenPromise;
}

export function getAuthClearedEventName() {
  return AUTH_CLEARED_EVENT;
}

async function withAuthHeader(config: InternalAxiosRequestConfig) {
  const token = await ensureAuthToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
}

Http.interceptors.request.use(async config => withAuthHeader(config));

Http.interceptors.response.use(
  response => response,
  (error: AxiosResponseError) => {
    if (
      error.response?.status === HttpStatusCode.Unauthorized ||
      isActiveMembershipRequiredError(error)
    ) {
      clearStoredToken();
    }

    if (isAxiosError(error)) {
      const requestUrl = error.config?.url ?? 'unknown URL';
      console.error(`API request failed for ${requestUrl}:`, error);
    }

    return Promise.reject(error);
  },
);

PublicHttp.interceptors.response.use(
  response => response,
  (error: AxiosResponseError) => {
    if (
      error.response?.status === HttpStatusCode.Unauthorized ||
      isActiveMembershipRequiredError(error)
    ) {
      clearStoredToken();
    }

    if (isAxiosError(error)) {
      const requestUrl = error.config?.url ?? 'unknown URL';
      console.error(`Public API request failed for ${requestUrl}:`, error);
    }

    return Promise.reject(error);
  },
);

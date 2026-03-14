import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getAuthClearedEventName, getStoredToken } from '../../../config/http';
import {
  clearStoredAuthSession,
  fetchCurrentUser,
  getStoredAuthUser,
  login as loginRequest,
  signup as signupRequest,
} from '../services/authService';
import type { AuthUser, LoginInput, SignupInput } from '../types/model';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthSessionValue = {
  status: AuthStatus;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<AuthUser>;
  signup: (input: SignupInput) => Promise<AuthUser>;
  logout: () => void;
};

const AuthSessionContext = createContext<AuthSessionValue | null>(null);

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(getStoredAuthUser());

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (!getStoredToken()) {
        if (!cancelled) {
          setUser(null);
          setStatus('unauthenticated');
        }
        return;
      }

      try {
        const currentUser = await fetchCurrentUser();
        if (!cancelled) {
          setUser(currentUser);
          setStatus(currentUser ? 'authenticated' : 'unauthenticated');
        }
      } catch {
        clearStoredAuthSession();
        queryClient.clear();
        if (!cancelled) {
          setUser(null);
          setStatus('unauthenticated');
        }
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  useEffect(() => {
    const handleAuthCleared = () => {
      setUser(null);
      setStatus('unauthenticated');
      queryClient.clear();
    };

    window.addEventListener(getAuthClearedEventName(), handleAuthCleared);
    return () => window.removeEventListener(getAuthClearedEventName(), handleAuthCleared);
  }, [queryClient]);

  const value = useMemo<AuthSessionValue>(
    () => ({
      status,
      user,
      isAuthenticated: status === 'authenticated' && Boolean(user),
      async login(input: LoginInput) {
        const result = await loginRequest(input);
        setUser(result.user);
        setStatus('authenticated');
        queryClient.clear();
        return result.user;
      },
      async signup(input: SignupInput) {
        const result = await signupRequest(input);
        setUser(result.user);
        setStatus('authenticated');
        queryClient.clear();
        return result.user;
      },
      logout() {
        clearStoredAuthSession();
        setUser(null);
        setStatus('unauthenticated');
        queryClient.clear();
      },
    }),
    [queryClient, status, user],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error('useAuthSession must be used inside AuthSessionProvider.');
  }

  return context;
}

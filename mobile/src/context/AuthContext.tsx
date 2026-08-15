import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loginRequest, meRequest, registerRequest } from '../api/auth';
import { apiErrorMessage, hydrateAuthToken, setAuthToken, TOKEN_KEY } from '../api/client';
import { UserDTO } from '../api/types';
import { cacheClearAll } from '../utils/apiCache';
import { ensurePerfQueueFlushOnForeground, prefetchAthleteData } from '../utils/prefetch';
import { deleteItemAsync } from '../utils/secureStorage';

interface AuthContextValue {
  user: UserDTO | null;
  isLoading: boolean;
  isAuthenticating: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (payload: { username: string; password: string; display_name?: string }) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensurePerfQueueFlushOnForeground();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const token = await hydrateAuthToken();
        if (token) {
          const me = await meRequest();
          setUser(me);
          void prefetchAthleteData(me);
        }
      } catch {
        try {
          await setAuthToken(null);
          await deleteItemAsync(TOKEN_KEY);
        } catch {
          // Le stockage sécurisé n'est pas pleinement supporté sur web ; on ignore.
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setIsAuthenticating(true);
    setError(null);
    try {
      const { token, user: loggedInUser } = await loginRequest(username, password);
      await setAuthToken(token);
      setUser(loggedInUser);
      void prefetchAthleteData(loggedInUser);
    } catch (err) {
      setError(apiErrorMessage(err, 'Connexion impossible'));
      throw err;
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const register = useCallback(async (payload: { username: string; password: string; display_name?: string }) => {
    setIsAuthenticating(true);
    setError(null);
    try {
      const { token, user: loggedInUser } = await registerRequest(payload);
      await setAuthToken(token);
      setUser(loggedInUser);
      void prefetchAthleteData(loggedInUser);
    } catch (err) {
      setError(apiErrorMessage(err, 'Inscription impossible'));
      throw err;
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await meRequest();
      setUser(me);
    } catch {
      // ignore
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await setAuthToken(null);
    } catch {
      // Idem : ignoré si la plateforme (ex: web) ne supporte pas la suppression.
    }
    await cacheClearAll();
    setUser(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({ user, isLoading, isAuthenticating, error, login, register, logout, clearError, refreshUser }),
    [user, isLoading, isAuthenticating, error, login, register, logout, clearError, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

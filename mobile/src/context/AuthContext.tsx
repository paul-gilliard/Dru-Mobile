import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { deleteItemAsync, getItemAsync, setItemAsync } from '../utils/secureStorage';
import { loginRequest, meRequest } from '../api/auth';
import { apiErrorMessage, TOKEN_KEY } from '../api/client';
import { UserDTO } from '../api/types';
import { ensurePerfQueueFlushOnForeground, prefetchAthleteData } from '../utils/prefetch';

interface AuthContextValue {
  user: UserDTO | null;
  isLoading: boolean;
  isAuthenticating: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
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
        const token = await getItemAsync(TOKEN_KEY);
        if (token) {
          const me = await meRequest();
          setUser(me);
          void prefetchAthleteData(me);
        }
      } catch {
        try {
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
      await setItemAsync(TOKEN_KEY, token);
      setUser(loggedInUser);
      void prefetchAthleteData(loggedInUser);
    } catch (err) {
      setError(apiErrorMessage(err, 'Connexion impossible'));
      throw err;
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await deleteItemAsync(TOKEN_KEY);
    } catch {
      // Idem : ignoré si la plateforme (ex: web) ne supporte pas la suppression.
    }
    setUser(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({ user, isLoading, isAuthenticating, error, login, logout, clearError }),
    [user, isLoading, isAuthenticating, error, login, logout, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

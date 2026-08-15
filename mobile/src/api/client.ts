import axios from 'axios';
import { deleteItemAsync, getItemAsync, setItemAsync } from '../utils/secureStorage';
import { API_URL } from './config';

export const TOKEN_KEY = 'dru_mobile_token';

/** Token en mémoire pour éviter un SecureStore read à chaque requête Axios. */
let memoryToken: string | null = null;

export function getAuthToken(): string | null {
  return memoryToken;
}

export async function setAuthToken(token: string | null): Promise<void> {
  memoryToken = token;
  if (token) {
    await setItemAsync(TOKEN_KEY, token);
  } else {
    try {
      await deleteItemAsync(TOKEN_KEY);
    } catch {
      // ignore
    }
  }
}

export async function hydrateAuthToken(): Promise<string | null> {
  if (memoryToken) return memoryToken;
  try {
    memoryToken = await getItemAsync(TOKEN_KEY);
  } catch {
    memoryToken = null;
  }
  return memoryToken;
}

export const apiClient = axios.create({
  baseURL: API_URL,
  // 20s : Railway peut être froid au premier hit ; 10s était trop juste
  // et provoquait souvent « Le serveur met trop de temps à répondre ».
  timeout: 20000,
});

apiClient.interceptors.request.use(async (config) => {
  try {
    const token = memoryToken ?? (await hydrateAuthToken());
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // Le stockage n'est pas disponible (ex: web sans polyfill) : on part sans token.
  }
  return config;
});

export function apiErrorMessage(error: unknown, fallback = 'Une erreur est survenue'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
    if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message)) {
      return 'Le serveur met trop de temps à répondre. Réessaie dans un instant.';
    }
    if (error.message === 'Network Error') {
      return "Impossible de contacter le serveur. Vérifie que le backend tourne et que l'IP configurée est correcte.";
    }
    if (error.response?.status) {
      return `Erreur serveur (${error.response.status}). Réessaie.`;
    }
    if (error.message) return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

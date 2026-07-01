import axios from 'axios';
import { getItemAsync } from '../utils/secureStorage';
import { API_URL } from './config';

export const TOKEN_KEY = 'dru_mobile_token';

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

apiClient.interceptors.request.use(async (config) => {
  try {
    const token = await getItemAsync(TOKEN_KEY);
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
    if (error.message === 'Network Error') {
      return "Impossible de contacter le serveur. Vérifie que le backend tourne et que l'IP configurée est correcte.";
    }
  }
  return fallback;
}

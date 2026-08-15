import { apiClient } from './client';
import { UserDTO } from './types';

export async function loginRequest(username: string, password: string) {
  const { data } = await apiClient.post<{ token: string; user: UserDTO }>('/auth/login', {
    username,
    password,
  });
  return data;
}

export async function registerRequest(payload: {
  username: string; password: string; display_name?: string;
}) {
  const { data } = await apiClient.post<{ token: string; user: UserDTO }>('/auth/register', payload);
  return data;
}

export async function meRequest() {
  const { data } = await apiClient.get<UserDTO>('/auth/me');
  return data;
}

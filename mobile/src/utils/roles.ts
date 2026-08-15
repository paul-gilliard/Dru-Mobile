import { UserDTO } from '../api/types';

export function isStaff(user?: Pick<UserDTO, 'role'> | null): boolean {
  return user?.role === 'coach' || user?.role === 'admin';
}

export function isAdmin(user?: Pick<UserDTO, 'role'> | null): boolean {
  return user?.role === 'admin';
}

export function isCoach(user?: Pick<UserDTO, 'role'> | null): boolean {
  return user?.role === 'coach';
}

export const SUBSCRIPTION_LABELS: Record<number, string> = {
  0: 'Essai — 1 athlète',
  1: 'Niveau 1 — 3 athlètes',
  2: 'Niveau 2 — 6 athlètes',
  3: 'Niveau 3 — illimité',
};

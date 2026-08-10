import { AppState } from 'react-native';
import { getProgram, listPerformance, listPrograms } from '../api/resources';
import { UserDTO } from '../api/types';
import { flushPerfQueue, loadPerfQueue } from './offlinePerfQueue';

/** Précharge programmes + perfs récentes dès la connexion. */
export async function prefetchAthleteData(user: UserDTO) {
  const athleteId = user.role === 'athlete' ? user.id : null;
  await loadPerfQueue();
  void flushPerfQueue();

  if (!athleteId) return;

  try {
    const programs = await listPrograms(athleteId);
    const active = programs.find((p) => p.is_active) ?? programs[0];
    if (active) {
      await getProgram(active.id);
    }
    await listPerformance({ athlete_id: athleteId });
  } catch {
    // silent — le cache / écrans rechargeront
  }
}

let appStateHooked = false;

export function ensurePerfQueueFlushOnForeground() {
  if (appStateHooked) return;
  appStateHooked = true;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void loadPerfQueue().then(() => flushPerfQueue());
    }
  });
}

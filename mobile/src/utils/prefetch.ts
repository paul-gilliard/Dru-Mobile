import { AppState } from 'react-native';
import {
  getAthleteDashboard,
  getCoachDashboard,
  getProgram,
  getStatsBootstrap,
  getWeeklyBilan,
  listMealPlans,
  listPerformance,
  listPrograms,
} from '../api/resources';
import { UserDTO } from '../api/types';
import { flushPerfQueue, loadPerfQueue } from './offlinePerfQueue';

/** Précharge les données chaudes dès la connexion (athlète ou coach). */
export async function prefetchAthleteData(user: UserDTO) {
  await loadPerfQueue();
  void flushPerfQueue();

  if (user.role === 'athlete') {
    try {
      void getAthleteDashboard();
      const programs = await listPrograms(user.id);
      const active = programs.find((p) => p.is_active) ?? programs[0];
      if (active) await getProgram(active.id);
      await listPerformance({ athlete_id: user.id });
      void listMealPlans(user.id, { withMeals: true });
    } catch {
      // silent — le cache / écrans rechargeront
    }
    return;
  }

  if (user.role === 'coach' || user.role === 'admin') {
    try {
      const dash = await getCoachDashboard();
      void getWeeklyBilan();
      const first = dash.athletes?.[0]?.athlete;
      if (first?.id) {
        void getStatsBootstrap(first.id, { days: 180, weeks: 24 });
        void listPrograms(first.id);
      }
    } catch {
      // silent
    }
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

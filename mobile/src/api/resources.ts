import { apiClient } from './client';
import { cacheInvalidate, swrFetch } from '../utils/apiCache';
import {
  AthleteDashboardDTO, AttentionPanelDTO, AvailabilityDTO, BulkImportEntryPayload, BulkImportResultDTO,
  CoachDashboardDTO, DailyActivityDTO, DashboardDTO, ExerciseBankDTO, ExerciseHistoryDTO, ExerciseEntryDTO,
  FoodDTO, JournalEntryDTO, JournalFillStatusDTO, JournalTrendDTO, MealPlanDTO,
  MuscleExercisesDTO, ObjectiveDTO, PerformanceEntryDTO, ProgramDTO, ProgramSessionDTO, RegularityPointDTO,
  RemarkDTO, SeriesBreakdownDTO, StatsExerciseDTO, TonnageByMuscleDTO, UserDTO, WeeklyBilanEntryDTO,
  WeeklyComparisonDTO, WeeklyOverviewDTO,
} from './types';

/** TTL par famille de ressources (ms). */
export const TTL = {
  dashboard: 45_000,
  programs: 5 * 60_000,
  perf: 60_000,
  perfLast: 2 * 60_000,
  journal: 60_000,
  mealPlans: 3 * 60_000,
  stats: 2 * 60_000,
  bilan: 90_000,
  banks: 15 * 60_000,
  objectives: 2 * 60_000,
  availability: 5 * 60_000,
  remarks: 2 * 60_000,
} as const;

export type StatsBootstrapDTO = {
  daily_activity: DailyActivityDTO[];
  journal_trend: JournalTrendDTO[];
  weekly_overview: WeeklyOverviewDTO;
  exercises_by_muscle: MuscleExercisesDTO[];
};

export async function getDashboard() {
  return swrFetch('dashboard:me', async () => {
    const { data } = await apiClient.get<DashboardDTO>('/dashboard');
    return data;
  }, { staleMs: TTL.dashboard });
}

export async function getCoachDashboard() {
  return swrFetch('dashboard:coach', async () => {
    const { data } = await apiClient.get<CoachDashboardDTO>('/dashboard');
    return data;
  }, { staleMs: TTL.dashboard });
}

export async function getAthleteDashboard() {
  return swrFetch('dashboard:athlete', async () => {
    const { data } = await apiClient.get<AthleteDashboardDTO>('/dashboard');
    return data;
  }, { staleMs: TTL.dashboard });
}

export async function listAthletes() {
  return swrFetch('athletes:list', async () => {
    const { data } = await apiClient.get<UserDTO[]>('/coach/athletes');
    return data;
  }, { staleMs: TTL.dashboard });
}

export async function searchAthletes(q: string) {
  const { data } = await apiClient.get<UserDTO[]>('/coach/athletes/search', { params: { q } });
  return data;
}

export async function inviteAthlete(athleteId: number) {
  const { data } = await apiClient.post('/coach/invitations', { athlete_id: athleteId });
  await cacheInvalidate('dashboard:');
  await cacheInvalidate('athletes:');
  return data;
}

export async function unlinkAthlete(athleteId: number) {
  await apiClient.delete(`/coach/athletes/${athleteId}/unlink`);
  await cacheInvalidate('dashboard:');
  await cacheInvalidate('athletes:');
  await cacheInvalidate('bilan:');
}

export async function resolveCoachQuota(keepAthleteIds: number[]) {
  const { data } = await apiClient.post<{ ok: boolean; removed_athlete_ids: number[] }>(
    '/coach/quota/resolve',
    { keep_athlete_ids: keepAthleteIds },
  );
  await cacheInvalidate('dashboard:');
  await cacheInvalidate('athletes:');
  await cacheInvalidate('bilan:');
  return data;
}

export async function acceptInvitation(id: number) {
  const { data } = await apiClient.post(`/athlete/invitations/${id}/accept`);
  await cacheInvalidate('dashboard:');
  return data;
}

export async function refuseInvitation(id: number) {
  const { data } = await apiClient.post(`/athlete/invitations/${id}/refuse`);
  await cacheInvalidate('dashboard:');
  return data;
}

export async function listUsers() {
  const { data } = await apiClient.get<UserDTO[]>('/admin/users');
  return data;
}

export async function createUser(payload: {
  username: string;
  password: string;
  role: 'coach' | 'athlete' | 'admin';
  display_name?: string;
  subscription_tier?: number;
  coach_id?: number | null;
}) {
  const { data } = await apiClient.post<UserDTO>('/admin/users', payload);
  return data;
}

export async function updateUser(userId: number, payload: {
  display_name?: string;
  password?: string;
  role?: 'coach' | 'athlete' | 'admin';
  subscription_tier?: number;
  coach_id?: number | null;
  auto_trim?: boolean;
}) {
  const { data } = await apiClient.put<UserDTO>(`/admin/users/${userId}`, payload);
  return data;
}

export async function deleteUser(userId: number) {
  await apiClient.delete(`/admin/users/${userId}`);
}

export async function listObjectives(athleteId: number) {
  return swrFetch(`objectives:${athleteId}`, async () => {
    const { data } = await apiClient.get<ObjectiveDTO[]>('/objectives', { params: { athlete_id: athleteId } });
    return data;
  }, { staleMs: TTL.objectives });
}

export async function createObjective(payload: { athlete_id: number; title: string; description?: string }) {
  const { data } = await apiClient.post<ObjectiveDTO>('/objectives', payload);
  await cacheInvalidate(`objectives:${payload.athlete_id}`);
  await cacheInvalidate('bilan:');
  return data;
}

export async function updateObjective(id: number, payload: Partial<Pick<ObjectiveDTO, 'title' | 'description'>>) {
  const { data } = await apiClient.put<ObjectiveDTO>(`/objectives/${id}`, payload);
  await cacheInvalidate('objectives:');
  return data;
}

export async function deleteObjective(id: number) {
  await apiClient.delete(`/objectives/${id}`);
  await cacheInvalidate('objectives:');
  await cacheInvalidate('bilan:');
}

export async function listAvailability(start: string, end: string) {
  return swrFetch(`availability:${start}:${end}`, async () => {
    const { data } = await apiClient.get<AvailabilityDTO[]>('/availability', { params: { start, end } });
    return data;
  }, { staleMs: TTL.availability });
}

export async function setAvailability(payload: {
  date: string; location?: string; timeslot?: string; available: boolean;
}) {
  const { data } = await apiClient.post<AvailabilityDTO>('/availability', payload);
  await cacheInvalidate('availability:');
  return data;
}

export async function listPrograms(athleteId: number) {
  return swrFetch(`programs:${athleteId}`, async () => {
    const { data } = await apiClient.get<ProgramDTO[]>('/programs', { params: { athlete_id: athleteId } });
    return data;
  }, { staleMs: TTL.programs });
}

export async function getProgram(programId: number, opts?: { force?: boolean }) {
  return swrFetch(`program:${programId}`, async () => {
    const { data } = await apiClient.get<ProgramDTO>(`/programs/${programId}`);
    return data;
  }, { staleMs: TTL.programs, force: opts?.force });
}

export async function getSession(sessionId: number, opts?: { force?: boolean }) {
  return swrFetch(`session:${sessionId}`, async () => {
    const { data } = await apiClient.get<ProgramSessionDTO>(`/sessions/${sessionId}`);
    return data;
  }, { staleMs: TTL.programs, force: opts?.force });
}

export async function createProgram(payload: { name: string; athlete_id: number }) {
  const { data } = await apiClient.post<ProgramDTO>('/programs', payload);
  await cacheInvalidate('programs:');
  if (data?.id) await cacheInvalidate(`program:${data.id}`);
  return data;
}

export async function deleteProgram(programId: number) {
  await apiClient.delete(`/programs/${programId}`);
  await cacheInvalidate('programs:');
  await cacheInvalidate(`program:${programId}`);
}

export async function renameProgram(programId: number, name: string) {
  const { data } = await apiClient.put<ProgramDTO>(`/programs/${programId}`, { name });
  await cacheInvalidate('programs:');
  await cacheInvalidate(`program:${programId}`);
  return data;
}

export async function activateProgram(programId: number) {
  const { data } = await apiClient.post<ProgramDTO>(`/programs/${programId}/activate`);
  await cacheInvalidate('programs:');
  await cacheInvalidate(`program:${programId}`);
  return data;
}

export async function duplicateProgram(programId: number, payload: { name?: string; athlete_id?: number } = {}) {
  const { data } = await apiClient.post<ProgramDTO>(`/programs/${programId}/duplicate`, payload);
  await cacheInvalidate('programs:');
  await cacheInvalidate(`program:${programId}`);
  if (data?.id) await cacheInvalidate(`program:${data.id}`);
  return data;
}

export async function createSession(programId: number, payload: { day_of_week: number; session_name?: string }) {
  const { data } = await apiClient.post(`/programs/${programId}/sessions`, payload);
  await cacheInvalidate('programs:');
  await cacheInvalidate(`program:${programId}`);
  return data;
}

export async function deleteSession(sessionId: number) {
  await apiClient.delete(`/sessions/${sessionId}`);
  await cacheInvalidate('programs:');
  await cacheInvalidate('program:');
}

export async function renameSession(sessionId: number, sessionName: string) {
  const { data } = await apiClient.put<ProgramSessionDTO>(`/sessions/${sessionId}`, { session_name: sessionName });
  await cacheInvalidate('program:');
  return data;
}

export async function addExerciseEntry(sessionId: number, payload: Record<string, unknown>) {
  const { data } = await apiClient.post(`/sessions/${sessionId}/exercises`, payload);
  await cacheInvalidate('program:');
  await cacheInvalidate(`session:${sessionId}`);
  return data;
}

export async function updateExerciseEntry(entryId: number, payload: Record<string, unknown>) {
  const { data } = await apiClient.put(`/program-exercises/${entryId}`, payload);
  await cacheInvalidate('program:');
  await cacheInvalidate('session:');
  return data;
}

export async function deleteExerciseEntry(entryId: number) {
  await apiClient.delete(`/program-exercises/${entryId}`);
  await cacheInvalidate('program:');
  await cacheInvalidate('session:');
}

export async function listExerciseBank() {
  return swrFetch('bank:exercises', async () => {
    const { data } = await apiClient.get<{ muscle_groups: string[]; exercises: ExerciseBankDTO[] }>('/exercise-bank');
    return data;
  }, { staleMs: TTL.banks });
}

export async function createExerciseBank(payload: { name: string; muscle_group: string }) {
  const { data } = await apiClient.post<ExerciseBankDTO>('/exercise-bank', payload);
  await cacheInvalidate('bank:exercises');
  return data;
}

export async function updateExerciseBank(id: number, payload: { name?: string; muscle_group?: string }) {
  const { data } = await apiClient.put<ExerciseBankDTO>(`/exercise-bank/${id}`, payload);
  await cacheInvalidate('bank:exercises');
  return data;
}

export async function deleteExerciseBank(id: number) {
  await apiClient.delete(`/exercise-bank/${id}`);
  await cacheInvalidate('bank:exercises');
}

export async function listJournal(athleteId: number, start?: string, end?: string) {
  const key = `journal:${athleteId}:${start ?? ''}:${end ?? ''}`;
  return swrFetch(key, async () => {
    const { data } = await apiClient.get<JournalEntryDTO[]>('/journal', {
      params: { athlete_id: athleteId, start, end },
    });
    return data;
  }, { staleMs: TTL.journal });
}

export async function upsertJournal(payload: Partial<JournalEntryDTO> & { athlete_id?: number }) {
  const { data } = await apiClient.post<JournalEntryDTO>('/journal', payload);
  await cacheInvalidate(`journal:${payload.athlete_id ?? ''}`);
  await cacheInvalidate('stats:');
  await cacheInvalidate('dashboard:');
  return data;
}

export async function deleteJournal(id: number) {
  await apiClient.delete(`/journal/${id}`);
  await cacheInvalidate('journal:');
  await cacheInvalidate('stats:');
}

export async function getJournalFirstEntryDate(athleteId: number) {
  const { data } = await apiClient.get<{ first_date: string | null }>('/journal/first-entry-date', {
    params: { athlete_id: athleteId },
  });
  return data.first_date;
}

export async function getJournalFillStatus(athleteId: number, start: string, end: string) {
  const { data } = await apiClient.get<JournalFillStatusDTO[]>('/journal/fill-status', {
    params: { athlete_id: athleteId, start, end },
    timeout: 30000,
  });
  return data;
}

export async function bulkImportJournal(payload: { athlete_id?: number; entries: BulkImportEntryPayload[] }) {
  const { data } = await apiClient.post<BulkImportResultDTO>('/journal/bulk-import', payload, { timeout: 30000 });
  return data;
}

export async function listPerformance(params: {
  athlete_id: number; session_id?: number; exercise?: string; date?: string;
}) {
  const key = `perf:${params.athlete_id}:${params.session_id ?? ''}:${params.date ?? ''}:${params.exercise ?? ''}`;
  return swrFetch(key, async () => {
    const { data } = await apiClient.get<PerformanceEntryDTO[]>('/performance', { params });
    return data;
  }, { staleMs: TTL.perf });
}

export async function lastPerformanceForExercise(athleteId: number, exercise: string) {
  const key = `perfLast:${athleteId}:${exercise}`;
  return swrFetch(key, async () => {
    const { data } = await apiClient.get<PerformanceEntryDTO[]>('/performance/last-for-exercise', {
      params: { athlete_id: athleteId, exercise },
    });
    return data;
  }, { staleMs: TTL.perfLast });
}

/** Batch : une requête pour toutes les dernières perfs d'une séance. */
export async function lastPerformanceForExercises(athleteId: number, exercises: string[]) {
  const unique = [...new Set(exercises.map((e) => e.trim()).filter(Boolean))];
  if (!unique.length) return {} as Record<string, PerformanceEntryDTO[]>;
  const key = `perfLastBatch:${athleteId}:${unique.slice().sort().join('|')}`;
  return swrFetch(key, async () => {
    try {
      const { data } = await apiClient.post<Record<string, PerformanceEntryDTO[]>>(
        '/performance/last-for-exercises',
        { athlete_id: athleteId, exercises: unique },
        { timeout: 30000 },
      );
      return data;
    } catch {
      // Fallback si l'API n'est pas encore déployée : parallèle individuel
      const pairs = await Promise.all(
        unique.map(async (ex) => [ex, await lastPerformanceForExercise(athleteId, ex)] as const),
      );
      return Object.fromEntries(pairs);
    }
  }, { staleMs: TTL.perfLast });
}

export async function createPerformance(payload: Partial<PerformanceEntryDTO> & { athlete_id?: number }) {
  const { data } = await apiClient.post<PerformanceEntryDTO>('/performance', payload);
  await cacheInvalidate(`perf:${payload.athlete_id ?? ''}`);
  await cacheInvalidate('perfLast:');
  await cacheInvalidate('stats:');
  await cacheInvalidate('remarks:');
  return data;
}

export async function updatePerformance(id: number, payload: Partial<PerformanceEntryDTO>) {
  const { data } = await apiClient.put<PerformanceEntryDTO>(`/performance/${id}`, payload);
  await cacheInvalidate('perf:');
  await cacheInvalidate('perfLast:');
  await cacheInvalidate('stats:');
  await cacheInvalidate('remarks:');
  return data;
}

export async function deletePerformance(id: number) {
  await apiClient.delete(`/performance/${id}`);
  await cacheInvalidate('perf:');
  await cacheInvalidate('perfLast:');
  await cacheInvalidate('stats:');
  await cacheInvalidate('remarks:');
}

export async function listFoods(query?: string) {
  const q = (query ?? '').trim();
  if (q) {
    // Recherche live : pas de cache long (debounce côté UI)
    const { data } = await apiClient.get<FoodDTO[]>('/foods', { params: { q } });
    return data;
  }
  return swrFetch('bank:foods', async () => {
    const { data } = await apiClient.get<FoodDTO[]>('/foods');
    return data;
  }, { staleMs: TTL.banks });
}

export async function createFood(payload: Partial<FoodDTO>) {
  const { data } = await apiClient.post<FoodDTO>('/foods', payload);
  await cacheInvalidate('bank:foods');
  return data;
}

export async function updateFood(id: number, payload: Partial<FoodDTO>) {
  const { data } = await apiClient.put<FoodDTO>(`/foods/${id}`, payload);
  await cacheInvalidate('bank:foods');
  return data;
}

export async function deleteFood(id: number) {
  await apiClient.delete(`/foods/${id}`);
  await cacheInvalidate('bank:foods');
}

export async function listMealPlans(athleteId: number, opts?: { withMeals?: boolean }) {
  const key = `mealPlans:${athleteId}:${opts?.withMeals ? 1 : 0}`;
  return swrFetch(key, async () => {
    const { data } = await apiClient.get<MealPlanDTO[]>('/meal-plans', {
      params: { athlete_id: athleteId, with_meals: opts?.withMeals ? 1 : 0 },
      timeout: 30000,
    });
    return data;
  }, { staleMs: TTL.mealPlans });
}

export async function getMealPlan(id: number) {
  const { data } = await apiClient.get<MealPlanDTO>(`/meal-plans/${id}`);
  return data;
}

export async function createMealPlan(payload: { name: string; athlete_id: number; meal_count?: number }) {
  const { data } = await apiClient.post<MealPlanDTO>('/meal-plans', payload);
  await cacheInvalidate(`mealPlans:${payload.athlete_id}`);
  return data;
}

export async function deleteMealPlan(id: number) {
  await apiClient.delete(`/meal-plans/${id}`);
  await cacheInvalidate('mealPlans:');
}

export async function renameMealPlan(id: number, name: string) {
  const { data } = await apiClient.put<MealPlanDTO>(`/meal-plans/${id}`, { name });
  await cacheInvalidate('mealPlans:');
  return data;
}

export async function duplicateMealPlan(id: number, payload: { name?: string; athlete_id?: number } = {}) {
  const { data } = await apiClient.post<MealPlanDTO>(`/meal-plans/${id}/duplicate`, payload);
  await cacheInvalidate('mealPlans:');
  return data;
}

export async function activateMealPlan(id: number) {
  const { data } = await apiClient.post<MealPlanDTO>(`/meal-plans/${id}/activate`);
  await cacheInvalidate('mealPlans:');
  return data;
}

export async function addMealEntry(planId: number, payload: { meal_number: number; food_id: number; quantity?: number }) {
  const { data } = await apiClient.post(`/meal-plans/${planId}/meals`, payload);
  await cacheInvalidate('mealPlans:');
  return data;
}

export async function updateMealEntry(entryId: number, quantity: number) {
  const { data } = await apiClient.put(`/meal-entries/${entryId}`, { quantity });
  await cacheInvalidate('mealPlans:');
  return data;
}

export async function deleteMealEntry(entryId: number) {
  await apiClient.delete(`/meal-entries/${entryId}`);
  await cacheInvalidate('mealPlans:');
}

export async function setMealTime(planId: number, mealNumber: number, time: string, label: string) {
  const { data } = await apiClient.put(`/meal-plans/${planId}/meal-time`, {
    meal_number: mealNumber, time, label,
  });
  await cacheInvalidate('mealPlans:');
  return data;
}

export async function getTonnageByMuscle(athleteId: number, days = 30) {
  return swrFetch(`stats:tonnage:${athleteId}:${days}`, async () => {
    const { data } = await apiClient.get<TonnageByMuscleDTO>('/stats/tonnage-by-muscle', {
      params: { athlete_id: athleteId, days },
      timeout: 30000,
    });
    return data;
  }, { staleMs: TTL.stats });
}

export async function getJournalTrend(athleteId: number, days = 30) {
  return swrFetch(`stats:journalTrend:${athleteId}:${days}`, async () => {
    const { data } = await apiClient.get<JournalTrendDTO[]>('/stats/journal-trend', {
      params: { athlete_id: athleteId, days },
      timeout: 30000,
    });
    return data;
  }, { staleMs: TTL.stats });
}

export async function getWeeklyBilan(opts?: { force?: boolean }) {
  return swrFetch('bilan:hebdo', async () => {
    const { data } = await apiClient.get<WeeklyBilanEntryDTO[]>('/coach/bilan-hebdo', { timeout: 30000 });
    return data;
  }, { staleMs: TTL.bilan, force: opts?.force });
}

export async function markWeeklyBilan(athleteId: number, weekStart?: string) {
  const { data } = await apiClient.post('/coach/bilan-hebdo/mark', { athlete_id: athleteId, week_start: weekStart });
  await cacheInvalidate('bilan:');
  await cacheInvalidate('dashboard:');
  return data;
}

export async function unmarkWeeklyBilan(athleteId: number, weekStart?: string) {
  const { data } = await apiClient.post('/coach/bilan-hebdo/unmark', { athlete_id: athleteId, week_start: weekStart });
  await cacheInvalidate('bilan:');
  await cacheInvalidate('dashboard:');
  return data;
}

export async function getAttentionPanel(athleteId: number, weekA = 0, weekB = 1) {
  return swrFetch(`attention:${athleteId}:${weekA}:${weekB}`, async () => {
    const { data } = await apiClient.get<AttentionPanelDTO>('/coach/attention-panel', {
      params: { athlete_id: athleteId, week_a: weekA, week_b: weekB },
      timeout: 30000,
    });
    return data;
  }, { staleMs: TTL.bilan });
}

export async function getWeeklyComparison(athleteId: number, weekA = 0, weekB = 1) {
  return swrFetch(`weeklyComp:${athleteId}:${weekA}:${weekB}`, async () => {
    const { data } = await apiClient.get<WeeklyComparisonDTO>('/stats/weekly-comparison', {
      params: { athlete_id: athleteId, week_a: weekA, week_b: weekB },
      timeout: 30000,
    });
    return data;
  }, { staleMs: TTL.bilan });
}

export async function getRegularity(athleteId: number, weeks = 4) {
  return swrFetch(`stats:regularity:${athleteId}:${weeks}`, async () => {
    const { data } = await apiClient.get<RegularityPointDTO[]>('/stats/regularity', {
      params: { athlete_id: athleteId, weeks },
      timeout: 30000,
    });
    return data;
  }, { staleMs: TTL.stats });
}

export async function getWeeklyOverview(athleteId: number, weeks = 8) {
  const capped = Math.min(weeks, 24);
  return swrFetch(`stats:overview:${athleteId}:${capped}`, async () => {
    const { data } = await apiClient.get<WeeklyOverviewDTO>('/stats/weekly-overview', {
      params: { athlete_id: athleteId, weeks: capped },
      timeout: 45000,
    });
    return data;
  }, { staleMs: TTL.stats });
}

export async function getStatsExercises(athleteId: number) {
  return swrFetch(`stats:exercises:${athleteId}`, async () => {
    const { data } = await apiClient.get<StatsExerciseDTO[]>('/stats/exercises', {
      params: { athlete_id: athleteId },
      timeout: 30000,
    });
    return data;
  }, { staleMs: TTL.stats });
}

export async function getExercisesByMuscle(athleteId: number) {
  return swrFetch(`stats:byMuscle:${athleteId}`, async () => {
    const { data } = await apiClient.get<MuscleExercisesDTO[]>('/stats/exercises-by-muscle', {
      params: { athlete_id: athleteId },
      timeout: 30000,
    });
    return data;
  }, { staleMs: TTL.stats });
}

export async function getExerciseHistory(athleteId: number, exercise: string, days = 90) {
  const capped = Math.min(days, 180);
  return swrFetch(`stats:exHistory:${athleteId}:${exercise}:${capped}`, async () => {
    const { data } = await apiClient.get<ExerciseHistoryDTO>('/stats/exercise-history', {
      params: { athlete_id: athleteId, exercise, days: capped },
      timeout: 30000,
    });
    return data;
  }, { staleMs: TTL.stats });
}

export async function getSeriesBreakdown(params: {
  athlete_id: number;
  start: string;
  end: string;
  group?: 'day' | 'week' | 'month';
  muscle?: string;
  exercise?: string;
}) {
  const key = `stats:series:${params.athlete_id}:${params.start}:${params.end}:${params.group ?? ''}:${params.muscle ?? ''}:${params.exercise ?? ''}`;
  return swrFetch(key, async () => {
    const { data } = await apiClient.get<SeriesBreakdownDTO>('/stats/series-breakdown', {
      params,
      timeout: 45000,
    });
    return data;
  }, { staleMs: TTL.stats });
}

export async function getDailyActivity(athleteId: number, days = 90) {
  const capped = Math.min(days, 180);
  return swrFetch(`stats:daily:${athleteId}:${capped}`, async () => {
    const { data } = await apiClient.get<DailyActivityDTO[]>('/stats/daily-activity', {
      params: { athlete_id: athleteId, days: capped },
      timeout: 30000,
    });
    return data;
  }, { staleMs: TTL.stats });
}

/** Bootstrap stats coach : 1 requête au lieu de 4 (activity + journal + overview + by-muscle). */
export async function getStatsBootstrap(athleteId: number, opts?: { days?: number; weeks?: number; force?: boolean }) {
  const days = Math.min(opts?.days ?? 180, 180);
  const weeks = Math.min(opts?.weeks ?? 24, 24);
  const key = `stats:bootstrap:${athleteId}:${days}:${weeks}`;
  return swrFetch(key, async () => {
    try {
      const { data } = await apiClient.get<StatsBootstrapDTO>('/stats/coach-bootstrap', {
        params: { athlete_id: athleteId, days, weeks },
        timeout: 45000,
      });
      return data;
    } catch {
      // Fallback parallèle si endpoint absent (prod pas encore déployée)
      const [daily_activity, journal_trend, weekly_overview, exercises_by_muscle] = await Promise.all([
        getDailyActivity(athleteId, days),
        getJournalTrend(athleteId, days),
        getWeeklyOverview(athleteId, weeks),
        getExercisesByMuscle(athleteId),
      ]);
      return { daily_activity, journal_trend, weekly_overview, exercises_by_muscle };
    }
  }, { staleMs: TTL.stats, force: opts?.force });
}

export async function getRemarks(athleteId: number, limit = 30) {
  return swrFetch(`remarks:${athleteId}:${limit}`, async () => {
    const { data } = await apiClient.get<RemarkDTO[]>('/performance/remarks', {
      params: { athlete_id: athleteId, limit },
      timeout: 30000,
    });
    return data;
  }, { staleMs: TTL.remarks });
}

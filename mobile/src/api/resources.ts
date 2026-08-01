import { apiClient } from './client';
import {
  AthleteDashboardDTO, AttentionPanelDTO, AvailabilityDTO, CoachDashboardDTO, DailyActivityDTO, DashboardDTO,
  ExerciseBankDTO, ExerciseHistoryDTO, ExerciseEntryDTO, FoodDTO, JournalEntryDTO, JournalTrendDTO, MealPlanDTO,
  MuscleExercisesDTO, ObjectiveDTO, PerformanceEntryDTO, ProgramDTO, ProgramSessionDTO, RegularityPointDTO,
  RemarkDTO, SeriesBreakdownDTO, StatsExerciseDTO, TonnageByMuscleDTO, UserDTO, WeeklyBilanEntryDTO,
  WeeklyComparisonDTO, WeeklyOverviewDTO,
} from './types';

export async function getDashboard() {
  const { data } = await apiClient.get<DashboardDTO>('/dashboard');
  return data;
}

export async function getCoachDashboard() {
  const { data } = await apiClient.get<CoachDashboardDTO>('/dashboard');
  return data;
}

export async function getAthleteDashboard() {
  const { data } = await apiClient.get<AthleteDashboardDTO>('/dashboard');
  return data;
}

export async function listAthletes() {
  const { data } = await apiClient.get<UserDTO[]>('/coach/athletes');
  return data;
}

export async function createAthlete(payload: { username: string; password: string; display_name?: string }) {
  const { data } = await apiClient.post<UserDTO>('/coach/athletes', payload);
  return data;
}

export async function deleteAthlete(athleteId: number) {
  await apiClient.delete(`/coach/athletes/${athleteId}`);
}

export async function listUsers() {
  const { data } = await apiClient.get<UserDTO[]>('/coach/users');
  return data;
}

export async function createUser(payload: { username: string; password: string; role: 'coach' | 'athlete'; display_name?: string }) {
  const { data } = await apiClient.post<UserDTO>('/coach/users', payload);
  return data;
}

export async function deleteUser(userId: number) {
  await apiClient.delete(`/coach/users/${userId}`);
}

export async function listObjectives(athleteId: number) {
  const { data } = await apiClient.get<ObjectiveDTO[]>('/objectives', { params: { athlete_id: athleteId } });
  return data;
}

export async function createObjective(payload: { athlete_id: number; title: string; description?: string }) {
  const { data } = await apiClient.post<ObjectiveDTO>('/objectives', payload);
  return data;
}

export async function updateObjective(id: number, payload: Partial<Pick<ObjectiveDTO, 'title' | 'description'>>) {
  const { data } = await apiClient.put<ObjectiveDTO>(`/objectives/${id}`, payload);
  return data;
}

export async function deleteObjective(id: number) {
  await apiClient.delete(`/objectives/${id}`);
}

export async function listAvailability(start: string, end: string) {
  const { data } = await apiClient.get<AvailabilityDTO[]>('/availability', { params: { start, end } });
  return data;
}

export async function setAvailability(payload: {
  date: string; location?: string; timeslot?: string; available: boolean;
}) {
  const { data } = await apiClient.post<AvailabilityDTO>('/availability', payload);
  return data;
}

export async function listPrograms(athleteId: number) {
  const { data } = await apiClient.get<ProgramDTO[]>('/programs', { params: { athlete_id: athleteId } });
  return data;
}

export async function getProgram(programId: number) {
  const { data } = await apiClient.get<ProgramDTO>(`/programs/${programId}`);
  return data;
}

export async function createProgram(payload: { name: string; athlete_id: number }) {
  const { data } = await apiClient.post<ProgramDTO>('/programs', payload);
  return data;
}

export async function deleteProgram(programId: number) {
  await apiClient.delete(`/programs/${programId}`);
}

export async function renameProgram(programId: number, name: string) {
  const { data } = await apiClient.put<ProgramDTO>(`/programs/${programId}`, { name });
  return data;
}

export async function activateProgram(programId: number) {
  const { data } = await apiClient.post<ProgramDTO>(`/programs/${programId}/activate`);
  return data;
}

export async function duplicateProgram(programId: number, payload: { name?: string; athlete_id?: number } = {}) {
  const { data } = await apiClient.post<ProgramDTO>(`/programs/${programId}/duplicate`, payload);
  return data;
}

export async function createSession(programId: number, payload: { day_of_week: number; session_name?: string }) {
  const { data } = await apiClient.post(`/programs/${programId}/sessions`, payload);
  return data;
}

export async function deleteSession(sessionId: number) {
  await apiClient.delete(`/sessions/${sessionId}`);
}

export async function renameSession(sessionId: number, sessionName: string) {
  const { data } = await apiClient.put<ProgramSessionDTO>(`/sessions/${sessionId}`, { session_name: sessionName });
  return data;
}

export async function addExerciseEntry(sessionId: number, payload: Record<string, unknown>) {
  const { data } = await apiClient.post(`/sessions/${sessionId}/exercises`, payload);
  return data;
}

export async function updateExerciseEntry(entryId: number, payload: Record<string, unknown>) {
  const { data } = await apiClient.put(`/program-exercises/${entryId}`, payload);
  return data;
}

export async function deleteExerciseEntry(entryId: number) {
  await apiClient.delete(`/program-exercises/${entryId}`);
}

export async function listExerciseBank() {
  const { data } = await apiClient.get<{ muscle_groups: string[]; exercises: ExerciseBankDTO[] }>('/exercise-bank');
  return data;
}

export async function createExerciseBank(payload: { name: string; muscle_group: string }) {
  const { data } = await apiClient.post<ExerciseBankDTO>('/exercise-bank', payload);
  return data;
}

export async function updateExerciseBank(id: number, payload: { name?: string; muscle_group?: string }) {
  const { data } = await apiClient.put<ExerciseBankDTO>(`/exercise-bank/${id}`, payload);
  return data;
}

export async function deleteExerciseBank(id: number) {
  await apiClient.delete(`/exercise-bank/${id}`);
}

export async function listJournal(athleteId: number, start?: string, end?: string) {
  const { data } = await apiClient.get<JournalEntryDTO[]>('/journal', {
    params: { athlete_id: athleteId, start, end },
  });
  return data;
}

export async function upsertJournal(payload: Partial<JournalEntryDTO> & { athlete_id?: number }) {
  const { data } = await apiClient.post<JournalEntryDTO>('/journal', payload);
  return data;
}

export async function deleteJournal(id: number) {
  await apiClient.delete(`/journal/${id}`);
}

export async function listPerformance(params: {
  athlete_id: number; session_id?: number; exercise?: string; date?: string;
}) {
  const { data } = await apiClient.get<PerformanceEntryDTO[]>('/performance', { params });
  return data;
}

export async function lastPerformanceForExercise(athleteId: number, exercise: string) {
  const { data } = await apiClient.get<PerformanceEntryDTO[]>('/performance/last-for-exercise', {
    params: { athlete_id: athleteId, exercise },
  });
  return data;
}

export async function createPerformance(payload: Partial<PerformanceEntryDTO> & { athlete_id?: number }) {
  const { data } = await apiClient.post<PerformanceEntryDTO>('/performance', payload);
  return data;
}

export async function updatePerformance(id: number, payload: Partial<PerformanceEntryDTO>) {
  const { data } = await apiClient.put<PerformanceEntryDTO>(`/performance/${id}`, payload);
  return data;
}

export async function deletePerformance(id: number) {
  await apiClient.delete(`/performance/${id}`);
}

export async function listFoods(query?: string) {
  const { data } = await apiClient.get<FoodDTO[]>('/foods', { params: { q: query } });
  return data;
}

export async function createFood(payload: Partial<FoodDTO>) {
  const { data } = await apiClient.post<FoodDTO>('/foods', payload);
  return data;
}

export async function updateFood(id: number, payload: Partial<FoodDTO>) {
  const { data } = await apiClient.put<FoodDTO>(`/foods/${id}`, payload);
  return data;
}

export async function deleteFood(id: number) {
  await apiClient.delete(`/foods/${id}`);
}

export async function listMealPlans(athleteId: number) {
  const { data } = await apiClient.get<MealPlanDTO[]>('/meal-plans', { params: { athlete_id: athleteId } });
  return data;
}

export async function getMealPlan(id: number) {
  const { data } = await apiClient.get<MealPlanDTO>(`/meal-plans/${id}`);
  return data;
}

export async function createMealPlan(payload: { name: string; athlete_id: number; meal_count?: number }) {
  const { data } = await apiClient.post<MealPlanDTO>('/meal-plans', payload);
  return data;
}

export async function deleteMealPlan(id: number) {
  await apiClient.delete(`/meal-plans/${id}`);
}

export async function renameMealPlan(id: number, name: string) {
  const { data } = await apiClient.put<MealPlanDTO>(`/meal-plans/${id}`, { name });
  return data;
}

export async function duplicateMealPlan(id: number, payload: { name?: string; athlete_id?: number } = {}) {
  const { data } = await apiClient.post<MealPlanDTO>(`/meal-plans/${id}/duplicate`, payload);
  return data;
}

export async function addMealEntry(planId: number, payload: { meal_number: number; food_id: number; quantity?: number }) {
  const { data } = await apiClient.post(`/meal-plans/${planId}/meals`, payload);
  return data;
}

export async function updateMealEntry(entryId: number, quantity: number) {
  const { data } = await apiClient.put(`/meal-entries/${entryId}`, { quantity });
  return data;
}

export async function deleteMealEntry(entryId: number) {
  await apiClient.delete(`/meal-entries/${entryId}`);
}

export async function setMealTime(planId: number, mealNumber: number, time: string, label: string) {
  const { data } = await apiClient.put(`/meal-plans/${planId}/meal-time`, {
    meal_number: mealNumber, time, label,
  });
  return data;
}

export async function getTonnageByMuscle(athleteId: number, days = 30) {
  const { data } = await apiClient.get<TonnageByMuscleDTO>('/stats/tonnage-by-muscle', {
    params: { athlete_id: athleteId, days },
    timeout: 30000,
  });
  return data;
}

export async function getJournalTrend(athleteId: number, days = 30) {
  const { data } = await apiClient.get<JournalTrendDTO[]>('/stats/journal-trend', {
    params: { athlete_id: athleteId, days },
    timeout: 30000,
  });
  return data;
}

export async function getWeeklyBilan() {
  const { data } = await apiClient.get<WeeklyBilanEntryDTO[]>('/coach/bilan-hebdo');
  return data;
}

export async function markWeeklyBilan(athleteId: number, weekStart?: string) {
  const { data } = await apiClient.post('/coach/bilan-hebdo/mark', { athlete_id: athleteId, week_start: weekStart });
  return data;
}

export async function unmarkWeeklyBilan(athleteId: number, weekStart?: string) {
  const { data } = await apiClient.post('/coach/bilan-hebdo/unmark', { athlete_id: athleteId, week_start: weekStart });
  return data;
}

export async function getAttentionPanel(athleteId: number, weekA = 0, weekB = 1) {
  const { data } = await apiClient.get<AttentionPanelDTO>('/coach/attention-panel', {
    params: { athlete_id: athleteId, week_a: weekA, week_b: weekB },
    timeout: 30000,
  });
  return data;
}

export async function getWeeklyComparison(athleteId: number, weekA = 0, weekB = 1) {
  const { data } = await apiClient.get<WeeklyComparisonDTO>('/stats/weekly-comparison', {
    params: { athlete_id: athleteId, week_a: weekA, week_b: weekB },
    timeout: 30000,
  });
  return data;
}

export async function getRegularity(athleteId: number, weeks = 4) {
  const { data } = await apiClient.get<RegularityPointDTO[]>('/stats/regularity', {
    params: { athlete_id: athleteId, weeks },
    timeout: 30000,
  });
  return data;
}

export async function getWeeklyOverview(athleteId: number, weeks = 8) {
  const { data } = await apiClient.get<WeeklyOverviewDTO>('/stats/weekly-overview', {
    params: { athlete_id: athleteId, weeks },
    timeout: 45000,
  });
  return data;
}

export async function getStatsExercises(athleteId: number) {
  const { data } = await apiClient.get<StatsExerciseDTO[]>('/stats/exercises', {
    params: { athlete_id: athleteId },
    timeout: 30000,
  });
  return data;
}

export async function getExercisesByMuscle(athleteId: number) {
  const { data } = await apiClient.get<MuscleExercisesDTO[]>('/stats/exercises-by-muscle', {
    params: { athlete_id: athleteId },
    timeout: 30000,
  });
  return data;
}

export async function getExerciseHistory(athleteId: number, exercise: string, days = 90) {
  const { data } = await apiClient.get<ExerciseHistoryDTO>('/stats/exercise-history', {
    params: { athlete_id: athleteId, exercise, days },
    timeout: 30000,
  });
  return data;
}

export async function getSeriesBreakdown(params: {
  athlete_id: number;
  start: string;
  end: string;
  group?: 'day' | 'week' | 'month';
  muscle?: string;
  exercise?: string;
}) {
  const { data } = await apiClient.get<SeriesBreakdownDTO>('/stats/series-breakdown', {
    params,
    timeout: 45000,
  });
  return data;
}

export async function getDailyActivity(athleteId: number, days = 90) {
  const { data } = await apiClient.get<DailyActivityDTO[]>('/stats/daily-activity', {
    params: { athlete_id: athleteId, days },
    timeout: 30000,
  });
  return data;
}

export async function getRemarks(athleteId: number, limit = 30) {
  const { data } = await apiClient.get<RemarkDTO[]>('/performance/remarks', {
    params: { athlete_id: athleteId, limit },
    timeout: 30000,
  });
  return data;
}

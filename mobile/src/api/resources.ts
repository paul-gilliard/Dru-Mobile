import { apiClient } from './client';
import {
  AthleteDashboardDTO, AvailabilityDTO, CoachDashboardDTO, DashboardDTO, ExerciseBankDTO,
  FoodDTO, JournalEntryDTO, JournalTrendDTO, MealPlanDTO, ObjectiveDTO, PerformanceEntryDTO,
  ProgramDTO, TonnageByMuscleDTO, UserDTO,
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

export async function createSession(programId: number, payload: { day_of_week: number; session_name?: string }) {
  const { data } = await apiClient.post(`/programs/${programId}/sessions`, payload);
  return data;
}

export async function deleteSession(sessionId: number) {
  await apiClient.delete(`/sessions/${sessionId}`);
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
  });
  return data;
}

export async function getJournalTrend(athleteId: number, days = 30) {
  const { data } = await apiClient.get<JournalTrendDTO[]>('/stats/journal-trend', {
    params: { athlete_id: athleteId, days },
  });
  return data;
}

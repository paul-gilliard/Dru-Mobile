export type Role = 'coach' | 'athlete';

export interface UserDTO {
  id: number;
  username: string;
  role: Role;
  display_name: string;
}

export interface SeriesDTO {
  number: number;
  description: string;
  text: string;
  is_main: boolean;
}

export interface ExerciseEntryDTO {
  id: number;
  session_id: number;
  position: number;
  name: string;
  sets: number | null;
  reps: string | null;
  rest: string | null;
  rir: string | null;
  intensification: string | null;
  muscle: string | null;
  remark: string | null;
  series_description: string | null;
  main_series: number | null;
  series: SeriesDTO[];
}

export interface ProgramSessionDTO {
  id: number;
  program_id: number;
  day_of_week: number;
  session_name: string | null;
  exercises: ExerciseEntryDTO[];
}

export interface ProgramDTO {
  id: number;
  name: string;
  athlete_id: number;
  coach_id: number | null;
  sessions?: ProgramSessionDTO[];
}

export interface JournalEntryDTO {
  id: number;
  athlete_id: number;
  entry_date: string;
  weight: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  kcals: number | null;
  water_ml: number | null;
  steps: number | null;
  sleep_hours: number | null;
  digestion: string | null;
  energy: number | null;
  stress: number | null;
  hunger: number | null;
  food_quality: string | null;
  menstrual_cycle: string | null;
}

export interface PerformanceEntryDTO {
  id: number;
  athlete_id: number;
  entry_date: string;
  program_session_id: number | null;
  exercise: string;
  series_number: number | null;
  reps: number | null;
  load: number | null;
  rpe: number | null;
  notes: string | null;
}

export interface ObjectiveDTO {
  id: number;
  athlete_id: number;
  title: string;
  description: string | null;
}

export interface AvailabilityDTO {
  id: number;
  date: string;
  location: string;
  timeslot: 'morning' | 'afternoon' | 'day';
  available: boolean;
}

export interface FoodDTO {
  id: number;
  name: string;
  brand: string | null;
  kcal: number;
  proteins: number | null;
  lipids: number | null;
  saturated_fats: number | null;
  carbs: number;
  simple_sugars: number | null;
  fiber: number | null;
  salt: number | null;
}

export interface MealEntryDTO {
  id: number;
  food_id: number;
  food_name: string;
  meal_number: number;
  quantity: number;
  kcals: number;
  proteins: number;
  lipids: number;
  carbs: number;
}

export interface MealPlanDTO {
  id: number;
  name: string;
  athlete_id: number;
  coach_id: number | null;
  meal_count: number;
  meal_times: (string | null)[];
  meal_labels: (string | null)[];
  totals: { kcals: number; proteins: number; lipids: number; carbs: number };
  meals_by_number?: Record<string, MealEntryDTO[]>;
}

export interface ExerciseBankDTO {
  id: number;
  name: string;
  muscle_group: string;
}

export interface AthleteSummaryDTO {
  athlete: UserDTO;
  last_journal_date: string | null;
  objectives_count: number;
  programs_count: number;
}

export interface CoachDashboardDTO {
  role: 'coach';
  athletes: AthleteSummaryDTO[];
}

export interface AthleteDashboardDTO {
  role: 'athlete';
  today: string;
  program: ProgramDTO | null;
  today_session: ProgramSessionDTO | null;
  objectives: ObjectiveDTO[];
  last_journal: JournalEntryDTO | null;
  has_logged_today: boolean;
}

export type DashboardDTO = CoachDashboardDTO | AthleteDashboardDTO;

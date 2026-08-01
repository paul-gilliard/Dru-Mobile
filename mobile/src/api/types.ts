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
  is_active?: boolean;
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

export interface WeekSessionDTO {
  id: number;
  day_of_week: number;
  session_name: string | null;
  exercise_count: number;
  is_today: boolean;
  last_logged_date: string | null;
}

export interface AthleteDashboardDTO {
  role: 'athlete';
  today: string;
  program: ProgramDTO | null;
  today_session: ProgramSessionDTO | null;
  week_sessions: WeekSessionDTO[];
  objectives: ObjectiveDTO[];
  last_journal: JournalEntryDTO | null;
  has_logged_today: boolean;
}

export type DashboardDTO = CoachDashboardDTO | AthleteDashboardDTO;

export interface TonnageByMuscleDTO {
  by_muscle: { muscle: string; tonnage: number }[];
  trend: { date: string; tonnage: number }[];
}

export interface JournalTrendDTO {
  date: string;
  weight: number | null;
  kcals: number | null;
  sleep_hours: number | null;
  energy: number | null;
}

export interface WeeklyMetricDTO {
  key: string;
  label: string;
  current: number | null;
  previous: number | null;
  diff: number | null;
}

export interface MuscleComparisonExerciseDTO {
  name: string;
  current: number;
  previous: number;
  diff_pct: number;
}

export interface MuscleComparisonRowDTO {
  muscle: string;
  current: number;
  previous: number;
  diff: number;
  exercises: MuscleComparisonExerciseDTO[];
}

export type AttentionVerdict = 'regression' | 'review' | 'stagnation' | 'progress';

export interface AttentionSeriesRowDTO {
  num: number;
  c_load: number | null;
  c_reps: number | null;
  p_load: number | null;
  p_reps: number | null;
  verdict: 'regression' | 'same' | 'progress' | 'incomplete';
}

export interface AttentionDetailDTO {
  verdict: AttentionVerdict;
  cur_date: string;
  prev_date: string;
  rows: AttentionSeriesRowDTO[];
  unpaired: { cur: { series_number: number; reps: number | null; load: number | null }[]; prev: { series_number: number; reps: number | null; load: number | null }[] };
  stats: {
    count_progress: number; count_regression: number; count_same: number;
    cur_tonnage: number; prev_tonnage: number; tonnage_diff: number;
  };
}

export interface AttentionItemDTO {
  name: string;
  detail: AttentionDetailDTO | null;
}

export interface AttentionBucketsDTO {
  regression: AttentionItemDTO[];
  review: AttentionItemDTO[];
  stagnation: AttentionItemDTO[];
  progress: AttentionItemDTO[];
  new: AttentionItemDTO[];
  abandoned: AttentionItemDTO[];
}

export interface WeekRefDTO {
  offset: number;
  label: string;
  start: string;
  end?: string;
}

export interface AttentionPanelDTO {
  week_a: WeekRefDTO;
  week_b: WeekRefDTO;
  body_weight: { current: number | null; previous: number | null };
  buckets: AttentionBucketsDTO;
}

export interface WeeklyComparisonDTO {
  week_a: WeekRefDTO;
  week_b: WeekRefDTO;
  health: WeeklyMetricDTO[];
  muscles: MuscleComparisonRowDTO[];
}

export interface RegularityPointDTO {
  offset: number;
  label: string;
  start: string;
  sessions: number;
}

export interface RemarkDTO {
  date: string;
  exercise: string;
  series_number: number | null;
  notes: string;
}

export interface WeeklyBilanEntryDTO {
  athlete: UserDTO;
  week_start: string;
  done: boolean;
  metrics: WeeklyMetricDTO[];
  objectives: ObjectiveDTO[];
  muscles: MuscleComparisonRowDTO[];
  attention: AttentionBucketsDTO;
}

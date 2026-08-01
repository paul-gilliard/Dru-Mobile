export type AthleteStackParamList = {
  Home: undefined;
  Program: undefined;
  SessionDetail: { sessionId: number; athleteId?: number; readOnly?: boolean; logDate?: string };
  Journal: undefined;
  Nutrition: undefined;
  More: undefined;
  Performance: undefined;
  Availability: undefined;
  Objectives: undefined;
  Stats: undefined;
};

export type CoachStackParamList = {
  Dashboard: undefined;
  AthleteDetail: { athleteId: number; athleteName: string };
  SessionDetail: { sessionId: number; athleteId?: number; readOnly?: boolean; logDate?: string };
  CreateAthlete: undefined;
  Users: undefined;
  MealPlans: undefined;
  MealPlanEditor: { planId: number; planName: string };
  WeeklyBilan: undefined;
};

export type AthleteStackParamList = {
  Home: undefined;
  Program: undefined;
  SessionDetail: { sessionId: number; athleteId?: number; readOnly?: boolean };
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
  SessionDetail: { sessionId: number; athleteId?: number; readOnly?: boolean };
  CreateAthlete: undefined;
};

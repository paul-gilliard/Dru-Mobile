export const colors = {
  background: '#080809',
  backgroundAlt: '#0F1012',
  surface: '#17181C',
  surfaceAlt: '#1F2024',
  surfaceHi: '#26272C',
  border: '#2A2B30',
  borderLight: '#35363D',

  primary: '#FF4B26',
  primaryDark: '#D6360F',
  primarySoft: 'rgba(255, 75, 38, 0.14)',
  secondary: '#3D7BFF',
  secondarySoft: 'rgba(61, 123, 255, 0.14)',

  accent: '#C6FF3D',
  accentSoft: 'rgba(198, 255, 61, 0.14)',
  gold: '#FFC93D',
  goldSoft: 'rgba(255, 201, 61, 0.14)',

  success: '#33E28C',
  successSoft: 'rgba(51, 226, 140, 0.14)',
  warning: '#FFA83D',
  danger: '#FF3B4E',
  dangerSoft: 'rgba(255, 59, 78, 0.14)',

  text: '#FAFAFC',
  textMuted: '#ACAEB8',
  textFaint: '#75777F',

  white: '#FFFFFF',
};

export const gradients = {
  primary: ['#FF6A3D', '#FF3B1E'] as const,
  fire: ['#FFC93D', '#FF4B26'] as const,
  dark: ['#1F2024', '#111214'] as const,
  cool: ['#3D7BFF', '#7B3DFF'] as const,
  success: ['#5CFFAE', '#22C777'] as const,
  hero: ['#1A1B20', '#0A0A0C'] as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
};

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 26,
  xxl: 34,
  hero: 44,
};

export const shadow = {
  glow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
};

export const muscleColors: Record<string, string> = {
  ABDOS: '#FFC93D',
  BICEPS: '#3D7BFF',
  DOS: '#33E28C',
  EPAULES: '#B26BFF',
  ISCHIO: '#FF3B4E',
  LEGS: '#3DE0FF',
  MOLLET: '#6B8CFF',
  PEC: '#FF6A3D',
  QUAD: '#C6FF3D',
};

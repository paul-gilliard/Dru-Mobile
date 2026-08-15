// ---------------------------------------------------------------------------
// Apex-style design system : fond charbon profond, cards "Bento", accent
// unique et personnalisable (cyan par défaut). Les valeurs neutres (fond,
// surfaces, texte, succès/erreur) sont FIXES ; seul l'accent change de mode
// à mode — voir ACCENT_PRESETS / applyAccent().
// ---------------------------------------------------------------------------

export type AccentKey = 'cyan' | 'yellow' | 'green' | 'orange' | 'violet';

export interface AccentPreset {
  key: AccentKey;
  label: string;
  hex: string;
  dark: string;
  soft: string;
  gradient: readonly [string, string];
  /** Couleur de texte lisible posée sur un fond plein de cette couleur. */
  textOn: string;
}

export const ACCENT_PRESETS: Record<AccentKey, AccentPreset> = {
  cyan: {
    key: 'cyan', label: 'Cyan électrique',
    hex: '#22D3EE', dark: '#0EA5C7', soft: 'rgba(34, 211, 238, 0.16)',
    gradient: ['#67E8F9', '#0891B2'], textOn: '#052129',
  },
  yellow: {
    key: 'yellow', label: 'Jaune haute intensité',
    hex: '#FFD23D', dark: '#E0AF0A', soft: 'rgba(255, 210, 61, 0.16)',
    gradient: ['#FFE873', '#F5B300'], textOn: '#241900',
  },
  green: {
    key: 'green', label: 'Vert néon',
    hex: '#39FF88', dark: '#1EDB68', soft: 'rgba(57, 255, 136, 0.16)',
    gradient: ['#7CFFB0', '#12D368'], textOn: '#052113',
  },
  orange: {
    key: 'orange', label: 'Orange combustion',
    hex: '#FF6A3D', dark: '#E5501F', soft: 'rgba(255, 106, 61, 0.16)',
    gradient: ['#FF8A5C', '#FF4B1E'], textOn: '#1A0800',
  },
  violet: {
    key: 'violet', label: 'Violet ultra',
    hex: '#B26BFF', dark: '#8B3DF2', soft: 'rgba(178, 107, 255, 0.16)',
    gradient: ['#C68CFF', '#8B3DF2'], textOn: '#fff',
  },
};

export const ACCENT_ORDER: AccentKey[] = ['cyan', 'yellow', 'green', 'orange', 'violet'];
export const DEFAULT_ACCENT: AccentKey = 'cyan';

/**
 * Palette neutre (dark charcoal, PAS de noir pur) — ne change jamais avec
 * l'accent. `colors` est un objet MUTABLE : seules les clés liées à l'accent
 * (primary*, accent*, textOnAccent) sont réécrites par applyAccent().
 * Tout composant qui lit `colors.xxx` au moment du rendu (JSX inline, valeur
 * par défaut de paramètre, objet de style construit dans le corps de
 * fonction) verra la nouvelle couleur immédiatement. Seules les propriétés
 * figées dans un StyleSheet.create() au niveau module restent inchangées
 * jusqu'au prochain montage — c'est pour ça que le kit UI partagé (ui.tsx)
 * applique les couleurs d'accent en inline plutôt que dans ses styles figés.
 */
export const colors = {
  background: '#0D0F12',
  backgroundAlt: '#111318',
  surface: '#15171C',
  surfaceAlt: '#1B1E24',
  surfaceHi: '#22252C',
  border: '#262A31',
  borderLight: '#343841',

  // Rétro-compatibilité : de nombreux écrans référencent encore `secondary`.
  secondary: '#3D7BFF',
  secondarySoft: 'rgba(61, 123, 255, 0.14)',

  success: '#33E28C',
  successSoft: 'rgba(51, 226, 140, 0.14)',
  warning: '#FFA83D',
  warningSoft: 'rgba(255, 168, 61, 0.14)',
  danger: '#FF3B4E',
  dangerSoft: 'rgba(255, 59, 78, 0.14)',
  gold: '#FFC93D',
  goldSoft: 'rgba(255, 201, 61, 0.14)',
  violet: '#B26BFF',
  violetSoft: 'rgba(178, 107, 255, 0.14)',
  muted: '#5C5E68',
  mutedSoft: 'rgba(92, 94, 104, 0.18)',

  text: '#F5F7FA',
  textMuted: '#9BA0AC',
  textFaint: '#686D78',
  white: '#FFFFFF',

  // Écrasées par applyAccent() ci-dessous.
  primary: '#22D3EE',
  primaryDark: '#0EA5C7',
  primarySoft: 'rgba(34, 211, 238, 0.16)',
  accent: '#22D3EE',
  accentSoft: 'rgba(34, 211, 238, 0.16)',
  textOnAccent: '#052129',
};

type Gradient = readonly [string, string];

export const gradients: Record<string, Gradient> = {
  primary: ['#67E8F9', '#0891B2'],
  fire: ['#FFC93D', '#FF4B26'],
  dark: ['#1B1E24', '#101216'],
  cool: ['#3D7BFF', '#7B3DFF'],
  success: ['#5CFFAE', '#22C777'],
  hero: ['#181B20', '#0A0B0D'],
};

let currentAccent: AccentKey = DEFAULT_ACCENT;

export function getCurrentAccent(): AccentKey {
  return currentAccent;
}

/** Mute `colors`/`gradients` EN PLACE (même référence d'objet) pour que tout
 * ce qui lit ces valeurs au rendu se mette à jour dès le prochain re-render. */
export function applyAccent(key: AccentKey) {
  const preset = ACCENT_PRESETS[key] ?? ACCENT_PRESETS[DEFAULT_ACCENT];
  currentAccent = preset.key;
  colors.primary = preset.hex;
  colors.primaryDark = preset.dark;
  colors.primarySoft = preset.soft;
  colors.accent = preset.hex;
  colors.accentSoft = preset.soft;
  colors.textOnAccent = preset.textOn;
  gradients.primary = preset.gradient;
}

applyAccent(DEFAULT_ACCENT);

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

/** Coins "Bento" — lg (~24px) est le rayon de référence des cartes. */
export const radius = {
  sm: 12,
  md: 16,
  lg: 24,
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

/**
 * Typo "premium" Inter — chargée dans App.tsx via useFonts(). Utiliser ces
 * clés pour les métriques/titres majeurs ; le reste de l'app garde la police
 * système (fontWeight seul) pour limiter l'ampleur de la refonte.
 */
export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  black: 'Inter_900Black',
};

export const shadow = {
  glow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
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

import React from 'react';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';

/**
 * Point d'entrée unique pour toute l'iconographie de l'app — remplace
 * l'ancien système "emoji dans un <Text>". Feather est le set par défaut
 * (traits fins, sobre) ; Ionicons/MaterialCommunityIcons couvrent les
 * glyphes métier (nutrition, sommeil, pas...) absents de Feather.
 */
export type IconName =
  // Navigation / structure
  | 'home' | 'program' | 'journal' | 'nutrition' | 'menu' | 'stats' | 'exercise' | 'food' | 'users' | 'user'
  // Actions génériques
  | 'plus' | 'edit' | 'trash' | 'close' | 'check' | 'check-circle' | 'circle' | 'star' | 'star-filled'
  | 'clock' | 'calendar' | 'flag' | 'undo' | 'clipboard' | 'shuffle' | 'info' | 'award' | 'trophy' | 'settings'
  // Navigation directionnelle
  | 'chevron-up' | 'chevron-down' | 'chevron-right' | 'chevron-left' | 'arrow-right'
  // Tendances / verdicts
  | 'trend-up' | 'trend-down' | 'trend-flat' | 'eye' | 'ban' | 'sparkle' | 'pause'
  // États / alertes
  | 'warning' | 'flex' | 'message' | 'target' | 'palette' | 'heart' | 'search'
  // Domaine santé / nutrition (journal)
  | 'flame' | 'moon' | 'footsteps' | 'water' | 'scale' | 'protein' | 'carbs' | 'fats' | 'bolt' | 'gauge' | 'restaurant' | 'leaf' | 'cycle'
  // Intégrations santé (Health Connect / rattrapage)
  | 'link' | 'history' | 'refresh';

const FEATHER = 'feather' as const;
const IONICONS = 'ionicons' as const;
const MCI = 'mci' as const;

const ICON_MAP: Record<IconName, { set: typeof FEATHER | typeof IONICONS | typeof MCI; name: string }> = {
  home: { set: FEATHER, name: 'home' },
  program: { set: MCI, name: 'dumbbell' },
  journal: { set: FEATHER, name: 'book-open' },
  nutrition: { set: IONICONS, name: 'restaurant-outline' },
  menu: { set: FEATHER, name: 'menu' },
  stats: { set: FEATHER, name: 'bar-chart-2' },
  exercise: { set: MCI, name: 'dumbbell' },
  food: { set: IONICONS, name: 'nutrition-outline' },
  users: { set: FEATHER, name: 'users' },
  user: { set: FEATHER, name: 'user' },

  plus: { set: FEATHER, name: 'plus' },
  edit: { set: FEATHER, name: 'edit-2' },
  trash: { set: FEATHER, name: 'trash-2' },
  close: { set: FEATHER, name: 'x' },
  check: { set: FEATHER, name: 'check' },
  'check-circle': { set: FEATHER, name: 'check-circle' },
  circle: { set: FEATHER, name: 'circle' },
  star: { set: FEATHER, name: 'star' },
  'star-filled': { set: IONICONS, name: 'star' },
  clock: { set: FEATHER, name: 'clock' },
  calendar: { set: FEATHER, name: 'calendar' },
  flag: { set: FEATHER, name: 'flag' },
  undo: { set: FEATHER, name: 'corner-up-left' },
  clipboard: { set: FEATHER, name: 'clipboard' },
  shuffle: { set: FEATHER, name: 'shuffle' },
  info: { set: FEATHER, name: 'info' },
  award: { set: FEATHER, name: 'award' },
  trophy: { set: MCI, name: 'trophy' },
  settings: { set: FEATHER, name: 'settings' },

  'chevron-up': { set: FEATHER, name: 'chevron-up' },
  'chevron-down': { set: FEATHER, name: 'chevron-down' },
  'chevron-right': { set: FEATHER, name: 'chevron-right' },
  'chevron-left': { set: FEATHER, name: 'chevron-left' },
  'arrow-right': { set: FEATHER, name: 'arrow-right' },

  'trend-up': { set: FEATHER, name: 'trending-up' },
  'trend-down': { set: FEATHER, name: 'trending-down' },
  'trend-flat': { set: FEATHER, name: 'minus' },
  eye: { set: FEATHER, name: 'eye' },
  ban: { set: FEATHER, name: 'slash' },
  sparkle: { set: IONICONS, name: 'sparkles-outline' },
  pause: { set: FEATHER, name: 'pause-circle' },

  warning: { set: FEATHER, name: 'alert-triangle' },
  flex: { set: MCI, name: 'arm-flex-outline' },
  message: { set: FEATHER, name: 'message-circle' },
  target: { set: FEATHER, name: 'target' },
  palette: { set: IONICONS, name: 'color-palette-outline' },
  heart: { set: FEATHER, name: 'heart' },
  search: { set: FEATHER, name: 'search' },

  flame: { set: IONICONS, name: 'flame-outline' },
  moon: { set: FEATHER, name: 'moon' },
  footsteps: { set: IONICONS, name: 'footsteps-outline' },
  water: { set: IONICONS, name: 'water-outline' },
  scale: { set: MCI, name: 'scale-bathroom' },
  protein: { set: MCI, name: 'food-drumstick-outline' },
  carbs: { set: MCI, name: 'barley' },
  fats: { set: MCI, name: 'oil' },
  bolt: { set: IONICONS, name: 'flash-outline' },
  gauge: { set: MCI, name: 'gauge' },
  restaurant: { set: IONICONS, name: 'restaurant-outline' },
  leaf: { set: IONICONS, name: 'leaf-outline' },
  cycle: { set: IONICONS, name: 'sync-outline' },

  link: { set: FEATHER, name: 'link' },
  history: { set: MCI, name: 'history' },
  refresh: { set: FEATHER, name: 'refresh-cw' },
};

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

/** Icône vectorielle unique — taille par défaut 20px, couleur = texte courant. */
export function Icon({ name, size = 20, color = colors.text }: IconProps) {
  const entry = ICON_MAP[name];
  if (!entry) return null;
  if (entry.set === FEATHER) return <Feather name={entry.name as never} size={size} color={color} />;
  if (entry.set === IONICONS) return <Ionicons name={entry.name as never} size={size} color={color} />;
  return <MaterialCommunityIcons name={entry.name as never} size={size} color={color} />;
}

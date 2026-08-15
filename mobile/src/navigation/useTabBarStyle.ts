import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Style de tab bar flottante "verre dépoli" : transparente, fond peint par
 * <GlassTabBarBackground /> (BlurView) via l'option `tabBarBackground`.
 * Étant en position absolue, il faut réserver `TAB_BAR_CLEARANCE` de marge
 * basse dans le contenu scrollable des écrans pour ne rien cacher derrière.
 */
export function useTabBarStyle() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 10);
  return {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.10)',
    height: 60 + bottom,
    paddingTop: 8,
    paddingBottom: bottom,
    elevation: 0,
  };
}

/** Marge à ajouter en bas de chaque ScrollView pour dégager la tab bar flottante. */
export const TAB_BAR_CLEARANCE = 100;

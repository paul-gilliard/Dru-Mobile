import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

/** Style tab bar qui laisse de la place aux boutons système Android. */
export function useTabBarStyle() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 10);
  return {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    height: 56 + bottom,
    paddingTop: 6,
    paddingBottom: bottom,
  };
}

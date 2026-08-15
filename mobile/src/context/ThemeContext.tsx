import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ACCENT_ORDER, ACCENT_PRESETS, AccentKey, DEFAULT_ACCENT, applyAccent, getCurrentAccent,
} from '../theme';

const STORAGE_KEY = 'dru_accent_theme_v1';

interface ThemeContextValue {
  accent: AccentKey;
  /** Change l'accent pour TOUTE l'app (coach comme athlète) et persiste le choix. */
  setAccent: (key: AccentKey) => void;
  presets: typeof ACCENT_PRESETS;
  order: AccentKey[];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // `version` force un re-render global : tout composant monté sous ce
  // Provider ré-exécute son corps de fonction et relit `colors.xxx` à jour.
  const [, setVersion] = useState(0);
  const [accent, setAccentState] = useState<AccentKey>(getCurrentAccent());

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && saved in ACCENT_PRESETS) {
          applyAccent(saved as AccentKey);
          setAccentState(saved as AccentKey);
          setVersion((v) => v + 1);
        }
      } catch {
        // pas de préférence sauvegardée / stockage indisponible : on garde le défaut
      }
    })();
  }, []);

  const setAccent = useCallback((key: AccentKey) => {
    applyAccent(key);
    setAccentState(key);
    setVersion((v) => v + 1);
    void AsyncStorage.setItem(STORAGE_KEY, key).catch(() => {
      // stockage plein / indispo : le choix reste actif pour la session en cours
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ accent, setAccent, presets: ACCENT_PRESETS, order: ACCENT_ORDER }),
    [accent, setAccent],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used within a ThemeProvider');
  return ctx;
}

export { DEFAULT_ACCENT };

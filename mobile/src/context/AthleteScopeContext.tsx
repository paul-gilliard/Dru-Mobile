import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';

interface AthleteScope {
  athleteId: number;
  athleteName: string;
  /** true quand un coach consulte les données d'un athlète (désactive les actions d'écriture personnelles) */
  readOnly: boolean;
}

const AthleteScopeContext = createContext<AthleteScope | undefined>(undefined);

export function AthleteScopeProvider({
  athleteId, athleteName, readOnly, children,
}: { athleteId: number; athleteName: string; readOnly: boolean; children: React.ReactNode }) {
  const value = useMemo(() => ({ athleteId, athleteName, readOnly }), [athleteId, athleteName, readOnly]);
  return <AthleteScopeContext.Provider value={value}>{children}</AthleteScopeContext.Provider>;
}

/** Fournit la portée courante : l'athlète connecté par défaut, ou l'athlète consulté par le coach. */
export function useAthleteScope(): AthleteScope {
  const ctx = useContext(AthleteScopeContext);
  const { user } = useAuth();
  if (ctx) return ctx;
  return { athleteId: user?.id ?? 0, athleteName: user?.display_name ?? '', readOnly: false };
}

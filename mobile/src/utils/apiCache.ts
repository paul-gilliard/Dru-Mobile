import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'dru_cache_v1:';
const memory = new Map<string, { at: number; data: unknown }>();
const listeners = new Set<(key: string, data: unknown) => void>();

export function cacheSubscribe(listener: (key: string, data: unknown) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function notify(key: string, data: unknown) {
  for (const fn of listeners) {
    try { fn(key, data); } catch { /* ignore */ }
  }
}

/** Lecture synchrone du cache mémoire uniquement (idéal pour hydrater l’UI sans flash). */
export function cacheGetSync<T>(key: string, maxAgeMs?: number): T | null {
  const mem = memory.get(key);
  if (!mem) return null;
  if (maxAgeMs != null && Date.now() - mem.at > maxAgeMs) return null;
  return mem.data as T;
}

export function cachePeekSync<T>(key: string): { at: number; data: T } | null {
  const mem = memory.get(key);
  if (!mem) return null;
  return mem as { at: number; data: T };
}

export async function cacheGet<T>(key: string, maxAgeMs: number): Promise<T | null> {
  const mem = memory.get(key);
  if (mem && Date.now() - mem.at <= maxAgeMs) return mem.data as T;
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: T };
    if (Date.now() - parsed.at > maxAgeMs) return null;
    memory.set(key, parsed);
    return parsed.data;
  } catch {
    return null;
  }
}

/** Retourne la dernière valeur connue même si expirée (stale-while-revalidate). */
export async function cachePeek<T>(key: string): Promise<{ at: number; data: T } | null> {
  const mem = memory.get(key);
  if (mem) return mem as { at: number; data: T };
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: T };
    memory.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, data: T): Promise<void> {
  const entry = { at: Date.now(), data };
  memory.set(key, entry);
  notify(key, data);
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // stockage plein / indispo : on garde au moins le cache mémoire
  }
}

export async function cacheInvalidate(prefixOrKey: string): Promise<void> {
  for (const k of [...memory.keys()]) {
    if (k === prefixOrKey || k.startsWith(prefixOrKey)) memory.delete(k);
  }
  try {
    const keys = await AsyncStorage.getAllKeys();
    const match = keys.filter((k) => k === PREFIX + prefixOrKey || k.startsWith(PREFIX + prefixOrKey));
    if (match.length) await AsyncStorage.multiRemove(match);
  } catch {
    // ignore
  }
}

export async function cacheClearAll(): Promise<void> {
  memory.clear();
  try {
    const keys = await AsyncStorage.getAllKeys();
    const match = keys.filter((k) => k.startsWith(PREFIX));
    if (match.length) await AsyncStorage.multiRemove(match);
  } catch {
    // ignore
  }
}

/**
 * Stale-while-revalidate :
 * - cache frais → retour immédiat, pas de réseau
 * - cache périmé → retour immédiat + refresh bg (notifie les abonnés)
 * - aucun cache → fetch réseau
 */
export async function swrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: { staleMs: number; force?: boolean },
): Promise<T> {
  if (!opts.force) {
    const mem = memory.get(key);
    if (mem && Date.now() - mem.at <= opts.staleMs) {
      return mem.data as T;
    }
    const peeked = await cachePeek<T>(key);
    if (peeked) {
      if (Date.now() - peeked.at <= opts.staleMs) {
        return peeked.data;
      }
      void (async () => {
        try {
          const data = await fetcher();
          await cacheSet(key, data);
        } catch {
          // keep stale
        }
      })();
      return peeked.data;
    }
  }
  const data = await fetcher();
  await cacheSet(key, data);
  return data;
}

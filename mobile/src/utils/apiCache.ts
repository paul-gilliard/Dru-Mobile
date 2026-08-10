import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'dru_cache_v1:';
const memory = new Map<string, { at: number; data: unknown }>();

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

export async function cacheSet<T>(key: string, data: T): Promise<void> {
  const entry = { at: Date.now(), data };
  memory.set(key, entry);
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

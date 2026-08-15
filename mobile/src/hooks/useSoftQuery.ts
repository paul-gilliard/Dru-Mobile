import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { apiErrorMessage } from '../api/client';
import { cacheGetSync, cachePeekSync, cacheSubscribe, swrFetch } from '../utils/apiCache';

type Options = {
  staleMs: number;
  /** Si false, ne charge pas (ex: athleteId manquant). */
  enabled?: boolean;
  /** Recharge soft au focus (défaut true). */
  refetchOnFocus?: boolean;
};

/**
 * Charge une ressource avec cache local :
 * - hydrate sync depuis la mémoire → pas d’écran blanc si déjà connu
 * - soft refresh au focus seulement si stale
 * - se met à jour quand un refresh background termine (cacheSubscribe)
 */
export function useSoftQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  opts: Options,
) {
  const enabled = opts.enabled !== false && key != null;
  const initial = key ? cacheGetSync<T>(key) ?? cachePeekSync<T>(key)?.data ?? null : null;
  const [data, setData] = useState<T | null>(initial);
  const [loading, setLoading] = useState(enabled && initial == null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const staleMs = opts.staleMs;

  const reload = useCallback(async (force = false) => {
    if (!key || !enabled) return;
    const had = cachePeekSync<T>(key);
    if (had && !force) {
      setData(had.data);
      setLoading(false);
    } else if (!had) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const next = await swrFetch(key, () => fetcherRef.current(), { staleMs, force });
      setData(next);
      setError(null);
    } catch (err) {
      if (!had) setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [key, enabled, staleMs]);

  useEffect(() => {
    if (!key || !enabled) return;
    return cacheSubscribe((changedKey, value) => {
      if (changedKey === key) setData(value as T);
    });
  }, [key, enabled]);

  useFocusEffect(
    useCallback(() => {
      if (!enabled || opts.refetchOnFocus === false) return;
      void reload(false);
    }, [enabled, opts.refetchOnFocus, reload]),
  );

  return {
    data,
    loading,
    refreshing,
    error,
    reload,
    setData,
  };
}

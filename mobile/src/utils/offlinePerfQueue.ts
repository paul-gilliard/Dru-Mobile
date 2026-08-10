import AsyncStorage from '@react-native-async-storage/async-storage';
import { createPerformance, deletePerformance, updatePerformance } from '../api/resources';
import { PerformanceEntryDTO } from '../api/types';

const QUEUE_KEY = 'dru_perf_queue_v1';

export type PendingCreate = {
  op: 'create';
  localId: string;
  tempId: number;
  payload: {
    athlete_id: number;
    program_session_id?: number;
    entry_date: string;
    exercise: string;
    series_number?: number;
    reps?: number;
    load?: number;
    notes?: string;
  };
};

export type PendingUpdate = {
  op: 'update';
  localId: string;
  serverId: number;
  payload: {
    reps?: number | null;
    load?: number | null;
    notes?: string | null;
    series_number?: number | null;
  };
};

export type PendingDelete = {
  op: 'delete';
  localId: string;
  serverId: number;
};

export type PendingOp = PendingCreate | PendingUpdate | PendingDelete;

export type FlushResult = {
  ok: boolean;
  replaced: { tempId: number; server: PerformanceEntryDTO }[];
  errors: string[];
};

let queue: PendingOp[] = [];
let loaded = false;
let flushing = false;
/** True when something was enqueued while a flush was running — drain again after. */
let flushAgain = false;
const listeners = new Set<(result?: FlushResult) => void>();

function notify(result?: FlushResult) {
  listeners.forEach((l) => l(result));
}

export function subscribePerfQueue(listener: (result?: FlushResult) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

async function persist() {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ne pas perdre la queue mémoire même si disque fail
  }
}

export async function loadPerfQueue(): Promise<PendingOp[]> {
  if (loaded) return queue;
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    queue = raw ? (JSON.parse(raw) as PendingOp[]) : [];
  } catch {
    queue = [];
  }
  loaded = true;
  return queue;
}

export function getPerfQueue(): PendingOp[] {
  return queue;
}

export function pendingCreateCount(): number {
  return queue.filter((op) => op.op === 'create').length;
}

export function isSeriesPending(
  athleteId: number,
  exercise: string,
  date: string,
  seriesNumber: number,
): boolean {
  return queue.some((op) => {
    if (op.op === 'create') {
      return (
        op.payload.athlete_id === athleteId
        && op.payload.exercise === exercise
        && op.payload.entry_date === date
        && op.payload.series_number === seriesNumber
      );
    }
    return false;
  });
}

let tempIdSeq = -1;

export function nextTempId(): number {
  const id = tempIdSeq;
  tempIdSeq -= 1;
  return id;
}

export async function enqueueCreate(payload: PendingCreate['payload'], tempId: number): Promise<string> {
  await loadPerfQueue();
  // Anti double-submit : une seule create pending par série/exercice/date
  queue = queue.filter((op) => !(
    op.op === 'create'
    && op.payload.athlete_id === payload.athlete_id
    && op.payload.exercise === payload.exercise
    && op.payload.entry_date === payload.entry_date
    && op.payload.series_number === payload.series_number
  ));
  const localId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  queue.push({ op: 'create', localId, tempId, payload });
  await persist();
  notify();
  if (flushing) flushAgain = true;
  void flushPerfQueue();
  return localId;
}

export async function enqueueUpdate(serverId: number, payload: PendingUpdate['payload']): Promise<string> {
  await loadPerfQueue();
  // Coalesce updates on same server id
  queue = queue.filter((op) => !(op.op === 'update' && op.serverId === serverId));
  const localId = `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  queue.push({ op: 'update', localId, serverId, payload });
  await persist();
  notify();
  if (flushing) flushAgain = true;
  void flushPerfQueue();
  return localId;
}

export async function enqueueDelete(serverId: number): Promise<string> {
  await loadPerfQueue();
  // Drop pending creates/updates for this id; if temp, remove create
  if (serverId < 0) {
    queue = queue.filter((op) => !(op.op === 'create' && op.tempId === serverId));
    await persist();
    notify();
    return `d_local_${serverId}`;
  }
  queue = queue.filter((op) => !(
    (op.op === 'update' && op.serverId === serverId)
    || (op.op === 'delete' && op.serverId === serverId)
  ));
  const localId = `d_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  queue.push({ op: 'delete', localId, serverId });
  await persist();
  notify();
  if (flushing) flushAgain = true;
  void flushPerfQueue();
  return localId;
}

/**
 * Flush pending ops one-by-one. Never replaces the whole queue with a snapshot
 * of "remaining failures" — that race was dropping creates enqueued mid-flush
 * (rapid ✓ on several series → only the first landed in DB).
 */
export async function flushPerfQueue(): Promise<FlushResult> {
  await loadPerfQueue();
  if (flushing) {
    flushAgain = true;
    return { ok: queue.length === 0, replaced: [], errors: [] };
  }
  if (!queue.length) {
    return { ok: true, replaced: [], errors: [] };
  }

  flushing = true;
  flushAgain = false;
  const replaced: FlushResult['replaced'] = [];
  const errors: string[] = [];
  let hadHardFailure = false;

  try {
    // Process from the front; newly enqueued ops are appended and drained too.
    // Track failures this round so we don't spin forever on a bad op.
    const failedThisRound = new Set<string>();
    while (queue.length > 0) {
      const op = queue[0];
      if (failedThisRound.has(op.localId)) break;

      try {
        if (op.op === 'create') {
          const server = await createPerformance(op.payload);
          replaced.push({ tempId: op.tempId, server });
        } else if (op.op === 'update') {
          await updatePerformance(op.serverId, op.payload);
        } else {
          await deletePerformance(op.serverId);
        }
        // Remove only this op (by localId) — keep anything pushed during the await
        queue = queue.filter((o) => o.localId !== op.localId);
        await persist();
      } catch (err) {
        errors.push(err instanceof Error ? err.message : 'sync error');
        failedThisRound.add(op.localId);
        hadHardFailure = true;
        // Rotate failed op to the end; continue with the others
        queue = [...queue.slice(1), op];
        await persist();
      }
    }
  } finally {
    flushing = false;
  }

  const result: FlushResult = { ok: queue.length === 0 && errors.length === 0, replaced, errors };
  notify(result);

  // Drain ops that arrived while we held the lock — but don't retry forever on hard failures
  if (!hadHardFailure && (flushAgain || queue.length > 0) && queue.length > 0) {
    flushAgain = false;
    const more = await flushPerfQueue();
    return {
      ok: more.ok,
      replaced: [...replaced, ...more.replaced],
      errors: [...errors, ...more.errors],
    };
  }

  return result;
}

export function makeOptimisticEntry(
  tempId: number,
  payload: PendingCreate['payload'],
): PerformanceEntryDTO {
  return {
    id: tempId,
    athlete_id: payload.athlete_id,
    entry_date: payload.entry_date,
    program_session_id: payload.program_session_id ?? null,
    exercise: payload.exercise,
    series_number: payload.series_number ?? null,
    reps: payload.reps ?? null,
    load: payload.load ?? null,
    rpe: null,
    notes: payload.notes ?? null,
  };
}

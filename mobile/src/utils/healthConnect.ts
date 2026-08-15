import { Platform } from 'react-native';
import {
  aggregateGroupByPeriod,
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { todayISO } from './format';

/**
 * Health Connect (Android) — pas / sommeil / nutrition.
 * Le poids n'est volontairement JAMAIS lu (évite d'écraser la saisie manuelle).
 *
 * MyFitnessPal n'a plus d'API publique fiable : le chemin supporté est
 * MFP → Health Connect → Dru (idem Google Fit pour le sommeil).
 */

export interface DayHealthSnapshot {
  steps?: number;
  sleep_hours?: number;
  kcals?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
}

export type HealthSnapshotByDate = Record<string, DayHealthSnapshot>;

export interface HealthPermissionStatus {
  steps: boolean;
  sleep: boolean;
  nutrition: boolean;
  history: boolean;
}

export interface DaySyncReport {
  date: string;
  snapshot: DayHealthSnapshot;
  permissions: HealthPermissionStatus;
  nutritionRecordCount: number;
  sleepSessionCount: number;
  hints: string[];
}

const REQUESTED_PERMISSIONS = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'read', recordType: 'Nutrition' },
  { accessType: 'read', recordType: 'ReadHealthDataHistory' },
] as const;

/** Rattrapage max = 30 jours (limite pratique Android + produit). */
export const HEALTH_CATCHUP_MAX_DAYS = 30;

export function isHealthConnectSupported(): boolean {
  return Platform.OS === 'android';
}

export function openHealthSettings(): void {
  if (!isHealthConnectSupported()) return;
  try {
    openHealthConnectSettings();
  } catch {
    // ignore
  }
}

function localDateKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toLocalDateKey(iso: string): string {
  return localDateKeyFromDate(new Date(iso));
}

function localDayBounds(dateISO: string): { start: Date; end: Date } {
  return {
    start: new Date(`${dateISO}T00:00:00`),
    end: new Date(`${dateISO}T23:59:59.999`),
  };
}

function shiftDateISO(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDateKeyFromDate(d);
}

function massGrams(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'object') {
    const v = value as { inGrams?: number; inMilligrams?: number };
    if (typeof v.inGrams === 'number') return v.inGrams;
    if (typeof v.inMilligrams === 'number') return v.inMilligrams / 1000;
  }
  return undefined;
}

function energyKcal(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'object') {
    const v = value as { inKilocalories?: number; inCalories?: number; inJoules?: number };
    if (typeof v.inKilocalories === 'number') return v.inKilocalories;
    if (typeof v.inCalories === 'number') return v.inCalories / 1000;
    if (typeof v.inJoules === 'number') return v.inJoules / 4184;
  }
  return undefined;
}

/** Stages HC : souvent un code numérique (0=unknown, 1=awake, …). */
function isAwakeStage(stage: unknown): boolean {
  if (typeof stage === 'number') return stage === 1 || stage === 3 || stage === 4; // AWAKE / OUT_OF_BED / AWAKE_IN_BED
  const kind = String(stage ?? '').toUpperCase();
  return kind.includes('AWAKE') || kind.includes('OUT_OF_BED');
}

function sleepHoursFromSession(session: {
  startTime: string;
  endTime: string;
  stages?: { startTime: string; endTime: string; stage: string | number }[];
}): number {
  const stages = session.stages ?? [];
  if (stages.length > 0) {
    let ms = 0;
    for (const stage of stages) {
      if (isAwakeStage(stage.stage)) continue;
      const a = new Date(stage.startTime).getTime();
      const b = new Date(stage.endTime).getTime();
      if (Number.isFinite(a) && Number.isFinite(b) && b > a) ms += b - a;
    }
    if (ms > 0) return ms / 3_600_000;
  }
  const a = new Date(session.startTime).getTime();
  const b = new Date(session.endTime).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return (b - a) / 3_600_000;
}

export type HealthConnectionState = 'unsupported' | 'not-connected' | 'connected';

export async function getHealthPermissionStatus(): Promise<HealthPermissionStatus> {
  const empty: HealthPermissionStatus = { steps: false, sleep: false, nutrition: false, history: false };
  if (!isHealthConnectSupported()) return empty;
  try {
    await initialize();
    const granted = await getGrantedPermissions();
    const types = new Set(granted.map((p: any) => p.recordType ?? p.accessType ?? ''));
    return {
      steps: types.has('Steps'),
      sleep: types.has('SleepSession'),
      nutrition: types.has('Nutrition'),
      history: types.has('ReadHealthDataHistory') || granted.some((p: any) => p.recordType === 'ReadHealthDataHistory' || p.accessType === 'read' && String(p.recordType || '').includes('History')),
    };
  } catch {
    return empty;
  }
}

export async function getHealthConnectionState(): Promise<HealthConnectionState> {
  if (!isHealthConnectSupported()) return 'unsupported';
  try {
    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return 'not-connected';
    const perms = await getHealthPermissionStatus();
    // Connecté dès qu'au moins une permission cœur est accordée
    return (perms.steps || perms.sleep || perms.nutrition) ? 'connected' : 'not-connected';
  } catch {
    return 'not-connected';
  }
}

export interface ConnectResult {
  ok: boolean;
  reason?: string;
  permissions?: HealthPermissionStatus;
}

export async function connectHealthConnect(): Promise<ConnectResult> {
  if (!isHealthConnectSupported()) {
    return { ok: false, reason: "Google Health Connect n'est disponible que sur Android." };
  }
  try {
    await initialize();
    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
      return { ok: false, reason: "L'app Health Connect n'est pas installée ou doit être mise à jour sur ce téléphone." };
    }
    await requestPermission([...REQUESTED_PERMISSIONS]);
    const permissions = await getHealthPermissionStatus();
    if (!permissions.steps && !permissions.sleep && !permissions.nutrition) {
      return {
        ok: false,
        reason: 'Permissions refusées — aucune donnée ne pourra être importée.',
        permissions,
      };
    }
    const missing: string[] = [];
    if (!permissions.sleep) missing.push('sommeil');
    if (!permissions.nutrition) missing.push('nutrition/macros');
    if (!permissions.steps) missing.push('pas');
    if (missing.length > 0) {
      return {
        ok: true,
        permissions,
        reason: `Connecté, mais permissions manquantes : ${missing.join(', ')}. Ouvre Health Connect et autorise Dru Mobile à lire ces données.`,
      };
    }
    return { ok: true, permissions };
  } catch {
    return { ok: false, reason: 'Erreur lors de la connexion à Health Connect.' };
  }
}

async function aggregateDaySteps(dateISO: string): Promise<number | undefined> {
  const { start, end } = localDayBounds(dateISO);
  try {
    const result = await aggregateRecord({
      recordType: 'Steps',
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    });
    const count = (result as { COUNT_TOTAL?: number }).COUNT_TOTAL;
    return count != null && count > 0 ? Math.round(count) : undefined;
  } catch (err) {
    console.warn('[HC] steps aggregate failed', dateISO, err);
    return undefined;
  }
}

function applyNutritionAggregate(target: DayHealthSnapshot, raw: Record<string, unknown>) {
  const kcals = energyKcal(raw.ENERGY_TOTAL);
  const protein = massGrams(raw.PROTEIN_TOTAL);
  const carbs = massGrams(raw.TOTAL_CARBOHYDRATE_TOTAL);
  const fats = massGrams(raw.TOTAL_FAT_TOTAL);
  if (kcals != null && kcals > 0) target.kcals = Math.round(kcals);
  if (protein != null && protein > 0) target.protein = Math.round(protein);
  if (carbs != null && carbs > 0) target.carbs = Math.round(carbs);
  if (fats != null && fats > 0) target.fats = Math.round(fats);
}

async function readDayNutrition(
  dateISO: string,
): Promise<{ snapshot: DayHealthSnapshot; recordCount: number }> {
  const out: DayHealthSnapshot = {};
  const { start, end } = localDayBounds(dateISO);
  let recordCount = 0;

  // 1) Lecture record par record (plus fiable pour les meal summaries MFP)
  try {
    let pageToken: string | undefined;
    let kcals = 0;
    let protein = 0;
    let carbs = 0;
    let fats = 0;
    do {
      const page = await readRecords('Nutrition', {
        timeRangeFilter: {
          operator: 'between',
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
        ascendingOrder: true,
        pageSize: 1000,
        pageToken,
      });
      for (const rec of page.records as any[]) {
        recordCount += 1;
        const e = energyKcal(rec.energy);
        const p = massGrams(rec.protein);
        const c = massGrams(rec.totalCarbohydrate);
        const f = massGrams(rec.totalFat);
        if (e) kcals += e;
        if (p) protein += p;
        if (c) carbs += c;
        if (f) fats += f;
      }
      pageToken = page.pageToken;
    } while (pageToken);

    if (kcals > 0) out.kcals = Math.round(kcals);
    if (protein > 0) out.protein = Math.round(protein);
    if (carbs > 0) out.carbs = Math.round(carbs);
    if (fats > 0) out.fats = Math.round(fats);
  } catch (err) {
    console.warn('[HC] nutrition readRecords failed', dateISO, err);
  }

  // 2) Agrégat natif en complément / secours
  if (out.kcals == null && out.protein == null && out.fats == null) {
    try {
      const result = await aggregateRecord({
        recordType: 'Nutrition',
        timeRangeFilter: {
          operator: 'between',
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
      });
      applyNutritionAggregate(out, result as Record<string, unknown>);
    } catch (err) {
      console.warn('[HC] nutrition aggregate failed', dateISO, err);
    }
  }

  return { snapshot: out, recordCount };
}

/**
 * Sommeil du journal pour `dateISO` = nuit qui se termine le matin de ce jour
 * (comme Google Fit). Fenêtre : veille 12:00 → jour 18:00.
 */
async function readSleepForJournalDay(
  dateISO: string,
): Promise<{ hours?: number; sessionCount: number }> {
  const prev = shiftDateISO(dateISO, -1);
  const windowStart = new Date(`${prev}T12:00:00`);
  const windowEnd = new Date(`${dateISO}T18:00:00`);
  let sessionCount = 0;
  let hours = 0;

  // A) Sessions dont le réveil tombe ce jour-là
  try {
    let pageToken: string | undefined;
    do {
      const page = await readRecords('SleepSession', {
        timeRangeFilter: {
          operator: 'between',
          startTime: windowStart.toISOString(),
          endTime: windowEnd.toISOString(),
        },
        ascendingOrder: true,
        pageSize: 1000,
        pageToken,
      });
      for (const session of page.records as any[]) {
        if (!session?.startTime || !session?.endTime) continue;
        sessionCount += 1;
        const wakeKey = toLocalDateKey(session.endTime);
        // Accepter aussi les sessions qui chevauchent fortement le matin du jour
        if (wakeKey === dateISO || toLocalDateKey(session.startTime) === prev) {
          const h = sleepHoursFromSession(session);
          if (h > 0) hours += h;
        }
      }
      pageToken = page.pageToken;
    } while (pageToken);
  } catch (err) {
    console.warn('[HC] sleep readRecords failed', dateISO, err);
  }

  if (hours > 0) {
    return { hours: Math.round(hours * 10) / 10, sessionCount };
  }

  // B) Agrégat sur la fenêtre nuit (clippe correctement une session 23h→7h)
  try {
    const result = await aggregateRecord({
      recordType: 'SleepSession',
      timeRangeFilter: {
        operator: 'between',
        startTime: windowStart.toISOString(),
        endTime: windowEnd.toISOString(),
      },
    });
    const seconds = (result as { SLEEP_DURATION_TOTAL?: number }).SLEEP_DURATION_TOTAL;
    if (seconds != null && seconds > 0) {
      return { hours: Math.round((seconds / 3600) * 10) / 10, sessionCount: Math.max(sessionCount, 1) };
    }
  } catch (err) {
    console.warn('[HC] sleep aggregate failed', dateISO, err);
  }

  return { hours: undefined, sessionCount };
}

async function sleepByWakeDate(startDateISO: string, endDateISO: string): Promise<Record<string, number>> {
  const map: Record<string, number> = {};
  let cur = startDateISO;
  while (cur <= endDateISO) {
    const { hours } = await readSleepForJournalDay(cur);
    if (hours != null) map[cur] = hours;
    cur = shiftDateISO(cur, 1);
  }
  return map;
}

function eachDateInclusive(startDateISO: string, endDateISO: string): string[] {
  const out: string[] = [];
  let cur = startDateISO;
  while (cur <= endDateISO) {
    out.push(cur);
    cur = shiftDateISO(cur, 1);
    if (out.length > HEALTH_CATCHUP_MAX_DAYS + 5) break;
  }
  return out;
}

async function stepsByPeriod(startDateISO: string, endDateISO: string): Promise<Record<string, number>> {
  const { start } = localDayBounds(startDateISO);
  const { end } = localDayBounds(endDateISO);
  const map: Record<string, number> = {};
  try {
    const buckets = await aggregateGroupByPeriod({
      recordType: 'Steps',
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
      timeRangeSlicer: { period: 'DAYS', length: 1 },
    });
    for (const b of buckets as any[]) {
      const count = b.result?.COUNT_TOTAL;
      if (!count) continue;
      const mid = new Date(
        (new Date(b.startTime).getTime() + new Date(b.endTime).getTime()) / 2,
      );
      map[localDateKeyFromDate(mid)] = Math.round(count);
    }
  } catch (err) {
    console.warn('[HC] steps groupByPeriod failed', err);
  }
  return map;
}

async function nutritionByPeriod(startDateISO: string, endDateISO: string): Promise<HealthSnapshotByDate> {
  const map: HealthSnapshotByDate = {};
  // Sur ≤30 jours, lecture jour par jour (plus fiable pour MFP)
  for (const dateISO of eachDateInclusive(startDateISO, endDateISO)) {
    const { snapshot } = await readDayNutrition(dateISO);
    if (Object.keys(snapshot).length > 0) map[dateISO] = snapshot;
  }
  return map;
}

function buildHints(
  permissions: HealthPermissionStatus,
  snapshot: DayHealthSnapshot,
  nutritionRecordCount: number,
  sleepSessionCount: number,
): string[] {
  const hints: string[] = [];
  if (!permissions.sleep) {
    hints.push('Permission sommeil refusée dans Health Connect → autorise « Sommeil » pour Dru Mobile.');
  } else if (snapshot.sleep_hours == null && sleepSessionCount === 0) {
    hints.push(
      'Aucune SleepSession dans Health Connect. Dans Google Fit / ton montre : active l’écriture du sommeil vers Health Connect (ce n’est pas automatique).',
    );
  }
  if (!permissions.nutrition) {
    hints.push('Permission nutrition refusée → autorise « Nutrition » pour Dru Mobile.');
  } else if (snapshot.kcals == null && nutritionRecordCount === 0) {
    hints.push(
      'Aucun repas dans Health Connect. Dans MyFitnessPal : Menu → Apps & Devices → Health Connect → activer + Sync Now. Google Fit « Aliments » seul ne suffit pas toujours.',
    );
  } else if (snapshot.kcals != null && snapshot.protein == null && snapshot.fats == null) {
    hints.push('Calories trouvées mais pas de macros — vérifie que MFP envoie bien protéines/lipides à Health Connect.');
  }
  return hints;
}

/** Sync détaillée d'un jour (pour feedback UI). */
export async function syncHealthDay(dateISO: string): Promise<DaySyncReport> {
  const permissions = await getHealthPermissionStatus();
  const snapshot: DayHealthSnapshot = {};
  let nutritionRecordCount = 0;
  let sleepSessionCount = 0;

  const tasks: Promise<void>[] = [];

  if (permissions.steps) {
    tasks.push((async () => {
      const steps = await aggregateDaySteps(dateISO);
      if (steps != null) snapshot.steps = steps;
    })());
  }
  if (permissions.nutrition) {
    tasks.push((async () => {
      const { snapshot: n, recordCount } = await readDayNutrition(dateISO);
      nutritionRecordCount = recordCount;
      Object.assign(snapshot, n);
    })());
  }
  if (permissions.sleep) {
    tasks.push((async () => {
      const { hours, sessionCount } = await readSleepForJournalDay(dateISO);
      sleepSessionCount = sessionCount;
      if (hours != null) snapshot.sleep_hours = hours;
    })());
  }

  await Promise.all(tasks);

  return {
    date: dateISO,
    snapshot,
    permissions,
    nutritionRecordCount,
    sleepSessionCount,
    hints: buildHints(permissions, snapshot, nutritionRecordCount, sleepSessionCount),
  };
}

export async function getHealthSnapshotForRange(
  startDateISO: string,
  endDateISO: string,
): Promise<HealthSnapshotByDate> {
  if (!isHealthConnectSupported()) return {};

  const dates = eachDateInclusive(startDateISO, endDateISO);
  const singleDay = dates.length === 1;
  const snapshot: HealthSnapshotByDate = {};
  const ensure = (key: string): DayHealthSnapshot => (snapshot[key] ??= {});

  if (singleDay) {
    const report = await syncHealthDay(dates[0]);
    if (Object.keys(report.snapshot).length > 0) snapshot[dates[0]] = report.snapshot;
    return snapshot;
  }

  const permissions = await getHealthPermissionStatus();
  const [stepsMap, nutritionMap, sleepMap] = await Promise.all([
    permissions.steps ? stepsByPeriod(startDateISO, endDateISO) : Promise.resolve({} as Record<string, number>),
    permissions.nutrition ? nutritionByPeriod(startDateISO, endDateISO) : Promise.resolve({} as HealthSnapshotByDate),
    permissions.sleep ? sleepByWakeDate(startDateISO, endDateISO) : Promise.resolve({} as Record<string, number>),
  ]);

  for (const dateISO of dates) {
    const day = ensure(dateISO);
    if (stepsMap[dateISO] != null) day.steps = stepsMap[dateISO];
    if (nutritionMap[dateISO]) Object.assign(day, nutritionMap[dateISO]);
    if (sleepMap[dateISO] != null) day.sleep_hours = sleepMap[dateISO];
  }

  for (const key of Object.keys(snapshot)) {
    const day = snapshot[key];
    if (!day || Object.values(day).every((v) => v == null)) delete snapshot[key];
  }

  return snapshot;
}

export async function getTodayHealthSnapshot(): Promise<DayHealthSnapshot | null> {
  const todayKey = todayISO();
  const snapshot = await getHealthSnapshotForRange(todayKey, todayKey);
  return snapshot[todayKey] ?? null;
}

/** Date de début du rattrapage : max(première entrée journal, aujourd'hui − 29j). */
export function catchupStartDate(firstJournalDate: string | null | undefined): string {
  const floor = shiftDateISO(todayISO(), -(HEALTH_CATCHUP_MAX_DAYS - 1));
  if (!firstJournalDate) return floor;
  return firstJournalDate > floor ? firstJournalDate : floor;
}

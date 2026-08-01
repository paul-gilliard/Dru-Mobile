import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAthleteScope } from '../../context/AthleteScopeContext';
import {
  getDailyActivity,
  getExerciseHistory,
  getExercisesByMuscle,
  getJournalTrend,
  getSeriesBreakdown,
  getWeeklyOverview,
} from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import {
  DailyActivityDTO,
  ExerciseHistoryDTO,
  JournalTrendDTO,
  MuscleExercisesDTO,
  SeriesBreakdownDTO,
  WeeklyOverviewWeekDTO,
} from '../../api/types';
import { TapBarChart, TapHBarChart, TapLineChart, ChartDatum } from '../../components/ClickableCharts';
import { Card, EmptyState, ErrorView, LoadingView, SectionTitle } from '../../components/ui';
import { colors, fontSize, gradients, muscleColors, radius, spacing } from '../../theme';
import {
  classifyExercise,
  verdictColor,
  verdictLabel,
  ClassifyResult,
} from '../../utils/classifyExercise';
import {
  formatDateLongFR,
  formatDateMediumFR,
  formatDateRangeFR,
  formatMonthFR,
  monthEndISO,
  monthStartISO,
  shiftLocalISO,
  shiftMonthISO,
  todayISO,
  weekEndISO,
  weekStartISO,
} from '../../utils/format';

const W = Math.max(280, Dimensions.get('window').width - spacing.lg * 4);

type PeriodMode = 'jour' | 'semaine' | 'mois';
type HealthKey = 'weight' | 'kcals' | 'water_ml' | 'sleep_hours' | 'protein' | 'energy' | 'stress' | 'hunger';
type CrossKey = HealthKey | 'tonnage' | 'charge';

type PeriodSlice = {
  id: string;
  start: string;
  end: string;
  label: string;
  short: string;
};

const HEALTH_OPTS: { key: HealthKey; label: string; unit: string; color: string }[] = [
  { key: 'weight', label: 'Poids', unit: 'kg', color: colors.secondary },
  { key: 'kcals', label: 'Kcals', unit: 'kcal', color: colors.primary },
  { key: 'water_ml', label: 'Eau', unit: 'ml', color: colors.violet },
  { key: 'sleep_hours', label: 'Sommeil', unit: 'h', color: colors.gold },
  { key: 'protein', label: 'Protéines', unit: 'g', color: colors.accent },
  { key: 'energy', label: 'Énergie', unit: '/10', color: colors.success },
  { key: 'stress', label: 'Stress', unit: '/10', color: colors.warning },
  { key: 'hunger', label: 'Faim', unit: '/10', color: colors.danger },
];

const CROSS_OPTS: { key: CrossKey; label: string; unit: string; color: string }[] = [
  ...HEALTH_OPTS.map((h) => ({ key: h.key as CrossKey, label: h.label, unit: h.unit, color: h.color })),
  { key: 'tonnage', label: 'Tonnage', unit: 'kg', color: colors.primary },
  { key: 'charge', label: 'Charge exo', unit: 'kg', color: colors.gold },
];

const WINDOW: Record<PeriodMode, number> = { jour: 14, semaine: 8, mois: 6 };

function avg(vals: (number | null | undefined)[]) {
  const n = vals.filter((v): v is number => v != null && Number.isFinite(v));
  if (!n.length) return null;
  return n.reduce((a, b) => a + b, 0) / n.length;
}

function fmt(v: number | null | undefined, d = 1) {
  if (v == null || Number.isNaN(v)) return '—';
  return Number(v).toFixed(d).replace(/\.0$/, '');
}

function diffTxt(cur: number | null, prev: number | null) {
  if (cur == null || prev == null) return { t: '—', c: colors.textFaint };
  const d = cur - prev;
  if (Math.abs(d) < 0.05) return { t: '→ stable', c: colors.textFaint };
  if (d > 0) return { t: `↑ +${fmt(d)}`, c: colors.success };
  return { t: `↓ ${fmt(d)}`, c: colors.danger };
}

function inRange(iso: string, start: string, end: string) {
  return iso >= start && iso <= end;
}

/** Fenêtre de N périodes pour comparer visuellement. */
function buildWindow(mode: PeriodMode, anchor: string): PeriodSlice[] {
  const n = WINDOW[mode];
  const out: PeriodSlice[] = [];
  if (mode === 'jour') {
    for (let i = n - 1; i >= 0; i -= 1) {
      const d = shiftLocalISO(anchor, -i);
      const short = String(Number(d.slice(8)));
      out.push({
        id: d,
        start: d,
        end: d,
        label: formatDateMediumFR(d),
        short,
      });
    }
    return out;
  }
  if (mode === 'semaine') {
    const anchorStart = weekStartISO(anchor);
    const out: PeriodSlice[] = [];
    for (let i = n - 1; i >= 0; i -= 1) {
      const start = shiftLocalISO(anchorStart, -7 * i);
      const end = weekEndISO(start);
      out.push({
        id: start,
        start,
        end,
        label: formatDateRangeFR(start, end),
        short: i === 0 ? 'S' : `S-${i}`,
      });
    }
    return out;
  }
  // mois
  for (let i = n - 1; i >= 0; i -= 1) {
    const m = shiftMonthISO(anchor, -i);
    const start = monthStartISO(m);
    const end = monthEndISO(m);
    const short = formatMonthFR(start).slice(0, 3);
    out.push({
      id: start.slice(0, 7),
      start,
      end,
      label: formatMonthFR(start),
      short: short.charAt(0).toUpperCase() + short.slice(1),
    });
  }
  return out;
}

type DetailState = {
  title: string;
  subtitle?: string;
  rows: { label: string; value: string; hint?: string; color?: string }[];
  breakdown?: SeriesBreakdownDTO | null;
  loadingBreakdown?: boolean;
  exerciseBars?: ChartDatum[];
  onExerciseBarPress?: (d: ChartDatum) => void;
  classify?: ClassifyResult | null;
  maxLoadChart?: ChartDatum[];
} | null;

function CheckChip({
  label, checked, color, onPress,
}: { label: string; checked: boolean; color?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.checkChip, checked && { backgroundColor: color ?? colors.primary, borderColor: color ?? colors.primary }]}
    >
      <Text style={[styles.checkMark, checked && { color: '#fff' }]}>{checked ? '✓' : '○'}</Text>
      <Text style={[styles.checkLabel, checked && { color: '#fff' }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/** Flèches ‹ › pour enchaîner muscles / exercices sans couper le nom. */
function CyclePicker({
  label, value, onPrev, onNext, color, hint,
}: {
  label: string;
  value: string;
  onPrev: () => void;
  onNext: () => void;
  color?: string;
  hint?: string;
}) {
  return (
    <View style={styles.cycleWrap}>
      <Text style={styles.cycleLabel}>{label}</Text>
      <View style={styles.cycleRow}>
        <Pressable onPress={onPrev} style={styles.cycleBtn} hitSlop={8}>
          <Text style={styles.cycleBtnText}>‹</Text>
        </Pressable>
        <View style={styles.cycleValueBox}>
          <Text style={[styles.cycleValue, color ? { color } : null]} numberOfLines={2}>{value}</Text>
          {hint ? <Text style={styles.cycleHint}>{hint}</Text> : null}
        </View>
        <Pressable onPress={onNext} style={styles.cycleBtn} hitSlop={8}>
          <Text style={styles.cycleBtnText}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

function cycleIndex(list: string[], current: string | null, dir: -1 | 1) {
  if (!list.length) return null;
  const i = Math.max(0, list.indexOf(current ?? list[0]));
  return list[(i + dir + list.length) % list.length];
}

type PerfView = 'repartition' | 'evolution' | 'charge';

function ModeSwitch({ mode, onChange }: { mode: PeriodMode; onChange: (m: PeriodMode) => void }) {
  const items: { key: PeriodMode; label: string; hint: string }[] = [
    { key: 'jour', label: 'Jour', hint: '14 j' },
    { key: 'semaine', label: 'Semaine', hint: '8 sem.' },
    { key: 'mois', label: 'Mois', hint: '6 mois' },
  ];
  return (
    <View style={styles.modeRow}>
      {items.map((it) => {
        const on = mode === it.key;
        return (
          <Pressable key={it.key} onPress={() => onChange(it.key)} style={{ flex: 1 }}>
            {on ? (
              <LinearGradient colors={gradients.primary} style={styles.modeBtn}>
                <Text style={styles.modeBtnOn}>{it.label}</Text>
                <Text style={styles.modeBtnOnHint}>{it.hint}</Text>
              </LinearGradient>
            ) : (
              <View style={styles.modeBtnOff}>
                <Text style={styles.modeBtnOffText}>{it.label}</Text>
                <Text style={styles.modeBtnOffHint}>{it.hint}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function DetailSheet({ detail, onClose }: { detail: DetailState; onClose: () => void }) {
  return (
    <Modal visible={!!detail} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{detail?.title}</Text>
          {detail?.subtitle ? <Text style={styles.modalSub}>{detail.subtitle}</Text> : null}
          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ paddingBottom: spacing.lg }}>
            {detail?.rows.map((r, i) => (
              <View key={`${r.label}-${i}`} style={styles.modalRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalRowLabel}>{r.label}</Text>
                  {r.hint ? <Text style={styles.modalRowHint}>{r.hint}</Text> : null}
                </View>
                <Text style={[styles.modalRowVal, r.color ? { color: r.color } : null]}>{r.value}</Text>
              </View>
            ))}

            {detail?.exerciseBars?.length ? (
              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.listTitle}>Tonnage par exercice — tape une ligne</Text>
                <TapHBarChart
                  data={detail.exerciseBars}
                  width={W - 8}
                  onPointPress={(d) => detail.onExerciseBarPress?.(d)}
                />
              </View>
            ) : null}

            {detail?.maxLoadChart?.length ? (
              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.listTitle}>Charge max</Text>
                <TapLineChart
                  data={detail.maxLoadChart}
                  width={W - 8}
                  height={160}
                  ySuffix="kg"
                  color={colors.gold}
                />
              </View>
            ) : null}

            {detail?.classify ? (
              <View style={styles.breakBlock}>
                <Text style={[styles.breakTitle, {
                  color: verdictColor(detail.classify.verdict, colors),
                }]}
                >
                  {verdictLabel(detail.classify.verdict)} (règles Easy Bilan)
                </Text>
                <Text style={styles.breakMeta}>
                  {formatDateMediumFR(detail.classify.cur_date)} vs {formatDateMediumFR(detail.classify.prev_date)}
                  {' · '}🟢 {detail.classify.stats.count_progress}
                  {' · '}🔴 {detail.classify.stats.count_regression}
                  {' · '}→ {detail.classify.stats.count_same}
                </Text>
                {detail.classify.rows.map((r) => {
                  const rowColor = r.verdict === 'regression' ? colors.danger
                    : r.verdict === 'progress' ? colors.success
                      : r.verdict === 'same' ? colors.textMuted : colors.textFaint;
                  const rowText = r.verdict === 'regression' ? '↓ Régression'
                    : r.verdict === 'progress' ? '↑ Progrès'
                      : r.verdict === 'same' ? '→ Identique' : '? Incomplet';
                  return (
                    <View key={r.num} style={styles.seriesRow}>
                      <Text style={styles.seriesMain}>S{r.num}</Text>
                      <Text style={styles.seriesVals}>{r.c_load ?? '—'} kg × {r.c_reps ?? '—'}</Text>
                      <Text style={styles.seriesDate}>vs {r.p_load ?? '—'} kg × {r.p_reps ?? '—'}</Text>
                      <Text style={[styles.seriesNote, { color: rowColor }]}>{rowText}</Text>
                    </View>
                  );
                })}
                <Text style={[styles.breakMeta, {
                  color: detail.classify.stats.tonnage_diff > 0 ? colors.success
                    : detail.classify.stats.tonnage_diff < 0 ? colors.danger : colors.textMuted,
                }]}
                >
                  Tonnage {detail.classify.stats.cur_tonnage} vs {detail.classify.stats.prev_tonnage}
                  {' '}({detail.classify.stats.tonnage_diff > 0 ? '+' : ''}{detail.classify.stats.tonnage_diff})
                </Text>
              </View>
            ) : null}

            {detail?.loadingBreakdown ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
            ) : null}

            {detail?.breakdown?.buckets?.map((b) => (
              <View key={b.key} style={styles.breakBlock}>
                <Text style={styles.breakTitle}>{b.label}</Text>
                <Text style={styles.breakMeta}>{b.series_count} série(s) · {fmt(b.tonnage, 0)} kg</Text>
                {b.series.map((s, idx) => (
                  <View key={`${s.date}-${s.exercise}-${s.series_number}-${idx}`} style={styles.seriesRow}>
                    <Text style={styles.seriesMain}>
                      {s.exercise} · S{s.series_number ?? '?'}
                    </Text>
                    <Text style={styles.seriesVals}>{fmt(s.reps)}×{fmt(s.load)}kg</Text>
                    <Text style={styles.seriesDate}>{formatDateMediumFR(s.date)}</Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
          <Pressable onPress={onClose} style={styles.modalClose}>
            <Text style={styles.modalCloseText}>Fermer</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Kpi({
  value, label, color, unit,
}: { value: string; label: string; color: string; unit?: string }) {
  return (
    <View style={styles.kpi}>
      <Text style={[styles.kpiValue, { color }]}>{value}{unit ? <Text style={styles.kpiUnit}> {unit}</Text> : null}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

export default function StatsScreen() {
  const { athleteId } = useAthleteScope();
  const [mode, setMode] = useState<PeriodMode>('semaine');
  const [anchor, setAnchor] = useState(todayISO());
  const [activity, setActivity] = useState<DailyActivityDTO[]>([]);
  const [journal, setJournal] = useState<JournalTrendDTO[]>([]);
  const [overview, setOverview] = useState<WeeklyOverviewWeekDTO[]>([]);
  const [byMuscle, setByMuscle] = useState<MuscleExercisesDTO[]>([]);
  const [muscle, setMuscle] = useState<string | null>(null);
  const [exercise, setExercise] = useState<string | null>(null);
  const [exHistory, setExHistory] = useState<ExerciseHistoryDTO | null>(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [perfView, setPerfView] = useState<PerfView>('repartition');
  const [crossMuscle, setCrossMuscle] = useState<string | null>(null);
  const [healthChecked, setHealthChecked] = useState<HealthKey[]>(['kcals', 'sleep_hours']);
  const [crossChecked, setCrossChecked] = useState<CrossKey[]>(['weight', 'charge']);
  const [detail, setDetail] = useState<DetailState>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const periods = useMemo(() => buildWindow(mode, anchor), [mode, anchor]);
  const focus = useMemo(() => {
    if (selectedPeriodId) {
      const found = periods.find((p) => p.id === selectedPeriodId);
      if (found) return found;
    }
    return periods[periods.length - 1];
  }, [periods, selectedPeriodId]);
  const focusIdx = periods.findIndex((p) => p.id === focus?.id);
  const prevPeriod = focusIdx > 0 ? periods[focusIdx - 1] : null;
  const today = todayISO();
  const canNext = periods[periods.length - 1]?.end < today;

  const load = useCallback(async () => {
    if (!athleteId) {
      setError('Athlète introuvable');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setError(null);
      const results = await Promise.allSettled([
        getDailyActivity(athleteId, 200),
        getJournalTrend(athleteId, 200),
        getWeeklyOverview(athleteId, 26),
        getExercisesByMuscle(athleteId),
      ]);
      const [actR, jrR, ovR, musR] = results;
      const failures = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      if (failures.length === results.length) {
        setError(apiErrorMessage(failures[0].reason));
        return;
      }
      if (actR.status === 'fulfilled') setActivity(actR.value);
      if (jrR.status === 'fulfilled') setJournal(jrR.value);
      if (ovR.status === 'fulfilled') setOverview(ovR.value.weeks);
      if (musR.status === 'fulfilled') {
        setByMuscle(musR.value);
        setMuscle((cur) => cur ?? musR.value[0]?.muscle ?? null);
        setCrossMuscle((cur) => cur ?? musR.value[0]?.muscle ?? null);
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [athleteId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    setSelectedPeriodId(null);
  }, [mode, anchor]);

  const exercisesForMuscle = useMemo(
    () => byMuscle.find((m) => m.muscle === muscle)?.exercises ?? [],
    [byMuscle, muscle],
  );

  useEffect(() => {
    if (!exercisesForMuscle.length) {
      setExercise(null);
      return;
    }
    setExercise((cur) => (cur && exercisesForMuscle.some((e) => e.name === cur) ? cur : exercisesForMuscle[0].name));
  }, [exercisesForMuscle]);

  useEffect(() => {
    if (!athleteId || !exercise) {
      setExHistory(null);
      return;
    }
    let cancelled = false;
    getExerciseHistory(athleteId, exercise, 200)
      .then((h) => { if (!cancelled) setExHistory(h); })
      .catch(() => { if (!cancelled) setExHistory({ exercise, sessions: [] }); });
    return () => { cancelled = true; };
  }, [athleteId, exercise]);

  const shiftWindow = (dir: -1 | 1) => {
    if (mode === 'jour') setAnchor((a) => shiftLocalISO(a, dir));
    else if (mode === 'semaine') setAnchor((a) => shiftLocalISO(weekStartISO(a), dir * 7));
    else setAnchor((a) => shiftMonthISO(a, dir));
  };

  const metricForPeriod = useCallback((p: PeriodSlice, key: 'sessions' | 'tonnage' | HealthKey | 'charge') => {
    if (key === 'sessions') {
      return activity.filter((d) => inRange(d.date, p.start, p.end) && d.trained).length;
    }
    if (key === 'tonnage') {
      return activity.filter((d) => inRange(d.date, p.start, p.end)).reduce((s, d) => s + d.tonnage, 0);
    }
    if (key === 'charge') {
      const loads = (exHistory?.sessions ?? [])
        .filter((s) => inRange(s.date, p.start, p.end) && s.max_load != null)
        .map((s) => s.max_load as number);
      return avg(loads) ?? 0;
    }
    const vals = journal
      .filter((j) => inRange(j.date, p.start, p.end))
      .map((j) => {
        const raw = j[key as keyof JournalTrendDTO];
        return typeof raw === 'number' ? raw : null;
      });
    return avg(vals) ?? 0;
  }, [activity, journal, exHistory]);

  const muscleTonnageInPeriod = useCallback((p: PeriodSlice) => {
    const map = new Map<string, number>();
    // Jour: prendre la semaine qui contient ce jour (données muscle = hebdo)
    const isDay = p.start === p.end;
    for (const w of overview) {
      if (isDay) {
        if (!(p.start >= w.start && p.start <= w.end)) continue;
      } else if (w.end < p.start || w.start > p.end) {
        continue;
      }
      for (const m of w.muscles) {
        map.set(m.muscle, (map.get(m.muscle) ?? 0) + m.tonnage);
      }
      if (isDay) break;
    }
    return [...map.entries()]
      .map(([m, tonnage]) => ({ muscle: m, tonnage }))
      .sort((a, b) => b.tonnage - a.tonnage);
  }, [overview]);

  const openPeriodDetail = useCallback(async (p: PeriodSlice) => {
    setSelectedPeriodId(p.id);
    const sessions = activity.filter((d) => inRange(d.date, p.start, p.end) && d.trained).length;
    const tonnage = activity.filter((d) => inRange(d.date, p.start, p.end)).reduce((s, d) => s + d.tonnage, 0);
    const weight = avg(journal.filter((j) => inRange(j.date, p.start, p.end)).map((j) => j.weight));
    setDetail({
      title: p.label,
      subtitle: mode === 'jour' ? formatDateLongFR(p.start) : `${p.start} → ${p.end}`,
      rows: [
        { label: 'Séances / jours actifs', value: String(sessions) },
        { label: 'Tonnage', value: `${fmt(tonnage, 0)} kg` },
        { label: 'Poids moyen', value: weight != null ? `${fmt(weight)} kg` : '—' },
      ],
      loadingBreakdown: true,
      breakdown: null,
    });
    if (!athleteId) return;
    try {
      const bd = await getSeriesBreakdown({
        athlete_id: athleteId,
        start: p.start,
        end: p.end,
        group: mode === 'mois' ? 'week' : 'day',
      });
      setDetail((cur) => (cur ? { ...cur, breakdown: bd, loadingBreakdown: false } : cur));
    } catch {
      setDetail((cur) => (cur ? { ...cur, loadingBreakdown: false } : cur));
    }
  }, [activity, journal, athleteId, mode]);

  const openExerciseDrill = useCallback(async (exName: string, muscleName: string, p: PeriodSlice, prev: PeriodSlice | null) => {
    setExercise(exName);
    setMuscle(muscleName);
    setDetail({
      title: exName,
      subtitle: `${muscleName} · ${p.label}`,
      rows: [{ label: 'Chargement…', value: '' }],
      loadingBreakdown: true,
    });
    if (!athleteId) return;
    try {
      const hist = await getExerciseHistory(athleteId, exName, 200);
      setExHistory(hist);
      const curSessions = hist.sessions.filter((s) => inRange(s.date, p.start, p.end));
      const prevSessions = prev
        ? hist.sessions.filter((s) => inRange(s.date, prev.start, prev.end))
        : [];
      const curLast = curSessions[curSessions.length - 1];
      const prevLast = prevSessions[prevSessions.length - 1];
      const maxNow = avg(curSessions.map((s) => s.max_load));
      const maxPrev = avg(prevSessions.map((s) => s.max_load));
      const tonNow = curSessions.reduce((s, x) => s + x.tonnage, 0);
      const tonPrev = prevSessions.reduce((s, x) => s + x.tonnage, 0);
      const dLoad = diffTxt(maxNow, maxPrev);
      const dTon = diffTxt(tonNow, tonPrev);

      let classify: ClassifyResult | null = null;
      if (curLast?.series?.length && prevLast?.series?.length) {
        classify = classifyExercise(curLast.series, prevLast.series, curLast.date, prevLast.date);
      }

      const maxLoadChart: ChartDatum[] = periods.map((per) => {
        const sess = hist.sessions.filter((s) => inRange(s.date, per.start, per.end) && s.max_load != null);
        const v = avg(sess.map((s) => s.max_load as number)) ?? 0;
        return { id: per.id, label: per.short, value: v, color: colors.gold };
      }).filter((d) => d.value > 0);

      setDetail({
        title: exName,
        subtitle: `${muscleName} · ${p.label}`,
        rows: [
          { label: 'Charge max', value: `${fmt(maxNow)} kg`, color: colors.gold },
          { label: 'vs préc.', value: dLoad.t, color: dLoad.c },
          { label: 'Tonnage période', value: `${fmt(tonNow, 0)} kg` },
          { label: 'Tonnage vs préc.', value: dTon.t, color: dTon.c },
          { label: 'Séances', value: String(curSessions.length) },
          ...(classify ? [{
            label: 'Verdict Easy Bilan',
            value: verdictLabel(classify.verdict),
            color: verdictColor(classify.verdict, colors),
          }] : [{ label: 'Verdict Easy Bilan', value: 'Pas assez de 2 séances à comparer' }]),
        ],
        classify,
        maxLoadChart,
        loadingBreakdown: false,
        breakdown: null,
      });

      const bd = await getSeriesBreakdown({
        athlete_id: athleteId,
        start: p.start,
        end: p.end,
        group: 'day',
        exercise: exName,
      });
      setDetail((cur) => (cur ? { ...cur, breakdown: bd } : cur));
    } catch (err) {
      setDetail({
        title: exName,
        subtitle: muscleName,
        rows: [{ label: 'Erreur', value: apiErrorMessage(err) }],
        loadingBreakdown: false,
      });
    }
  }, [athleteId, periods]);

  const openMuscleDrill = useCallback(async (muscleName: string, p: PeriodSlice) => {
    setMuscle(muscleName);
    setSelectedPeriodId(p.id);
    const mus = byMuscle.find((m) => m.muscle === muscleName);
    const exerciseBars: ChartDatum[] = (mus?.exercises ?? [])
      .slice()
      .sort((a, b) => (b.tonnage ?? 0) - (a.tonnage ?? 0))
      .slice(0, 12)
      .map((ex) => ({
        id: ex.name,
        label: ex.name,
        fullLabel: ex.name,
        value: ex.tonnage ?? 0,
        color: muscleColors[muscleName] ?? colors.primary,
      }));

    // tonnage période via overview overlap
    const ton = muscleTonnageInPeriod(p).find((m) => m.muscle === muscleName)?.tonnage ?? 0;
    const prevTon = prevPeriod
      ? (muscleTonnageInPeriod(prevPeriod).find((m) => m.muscle === muscleName)?.tonnage ?? 0)
      : null;
    const d = diffTxt(ton, prevTon);

    setDetail({
      title: muscleName,
      subtitle: `${p.label} · ${d.t}`,
      rows: [
        { label: 'Tonnage période', value: `${fmt(ton, 0)} kg` },
        { label: 'vs préc.', value: d.t, color: d.c },
      ],
      exerciseBars,
      onExerciseBarPress: (bar) => {
        void openExerciseDrill(bar.id, muscleName, p, prevPeriod);
      },
      loadingBreakdown: true,
      breakdown: null,
    });

    if (!athleteId) return;
    try {
      const bd = await getSeriesBreakdown({
        athlete_id: athleteId,
        start: p.start,
        end: p.end,
        group: mode === 'mois' ? 'week' : 'day',
        muscle: muscleName,
      });
      // recalcul bars depuis breakdown si dispo
      const byEx = new Map<string, number>();
      for (const b of bd.buckets) {
        for (const s of b.series) {
          byEx.set(s.exercise, (byEx.get(s.exercise) ?? 0) + s.tonnage);
        }
      }
      const liveBars: ChartDatum[] = [...byEx.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([name, value]) => ({
          id: name,
          label: name,
          fullLabel: name,
          value,
          color: muscleColors[muscleName] ?? colors.primary,
        }));
      setDetail((cur) => (cur ? {
        ...cur,
        breakdown: bd,
        loadingBreakdown: false,
        exerciseBars: liveBars.length ? liveBars : cur.exerciseBars,
        rows: [
          { label: 'Tonnage période', value: `${fmt(bd.total_tonnage, 0)} kg` },
          { label: 'vs préc.', value: d.t, color: d.c },
          { label: 'Séries', value: String(bd.total_series) },
        ],
      } : cur));
    } catch {
      setDetail((cur) => (cur ? { ...cur, loadingBreakdown: false } : cur));
    }
  }, [byMuscle, muscleTonnageInPeriod, prevPeriod, athleteId, mode, openExerciseDrill]);

  if (loading) return <LoadingView label="Préparation du terrain de stats..." />;
  if (error) return <ErrorView message={error} onRetry={load} />;
  if (!focus) return <EmptyState icon="📊" title="Pas de période" />;

  const focusSessions = metricForPeriod(focus, 'sessions');
  const focusTonnage = metricForPeriod(focus, 'tonnage');
  const prevSessions = prevPeriod ? metricForPeriod(prevPeriod, 'sessions') : null;
  const prevTonnage = prevPeriod ? metricForPeriod(prevPeriod, 'tonnage') : null;
  const weightNow = avg(journal.filter((j) => inRange(j.date, focus.start, focus.end)).map((j) => j.weight));
  const weightPrev = prevPeriod
    ? avg(journal.filter((j) => inRange(j.date, prevPeriod.start, prevPeriod.end)).map((j) => j.weight))
    : null;

  const sessionsSeries: ChartDatum[] = periods.map((p) => ({
    id: p.id,
    label: p.short,
    value: metricForPeriod(p, 'sessions'),
    color: colors.success,
  }));
  const weightSeries: ChartDatum[] = periods.map((p) => ({
    id: p.id,
    label: p.short,
    value: metricForPeriod(p, 'weight'),
    color: colors.secondary,
  })).filter((d) => d.value > 0);

  const focusMuscles = muscleTonnageInPeriod(focus);
  const muscleBars: ChartDatum[] = focusMuscles.slice(0, 12).map((m) => ({
    id: m.muscle,
    label: m.muscle,
    fullLabel: m.muscle,
    value: m.tonnage,
    color: muscleColors[m.muscle] ?? colors.primary,
  }));

  const muscleNames = byMuscle.map((m) => m.muscle);
  const exerciseNames = exercisesForMuscle.map((e) => e.name);

  const muscleHistory: ChartDatum[] = muscle
    ? periods.map((p) => ({
      id: p.id,
      label: p.short,
      value: muscleTonnageInPeriod(p).find((x) => x.muscle === muscle)?.tonnage ?? 0,
      color: muscleColors[muscle] ?? colors.primary,
    }))
    : [];

  const loadSeries: ChartDatum[] = periods.map((p) => ({
    id: p.id,
    label: p.short,
    value: metricForPeriod(p, 'charge'),
    color: colors.gold,
  })).filter((d) => d.value > 0);

  const muscleAvg = muscleHistory.length
    ? avg(muscleHistory.map((d) => d.value).filter((v) => v > 0))
    : null;
  const loadAvg = loadSeries.length ? avg(loadSeries.map((d) => d.value)) : null;
  const focusMuscleTon = muscle
    ? (muscleTonnageInPeriod(focus).find((x) => x.muscle === muscle)?.tonnage ?? 0)
    : 0;
  const prevMuscleTon = muscle && prevPeriod
    ? (muscleTonnageInPeriod(prevPeriod).find((x) => x.muscle === muscle)?.tonnage ?? 0)
    : null;

  const windowLabel = `${periods[0]?.label ?? ''} → ${periods[periods.length - 1]?.label ?? ''}`;
  const avgWord = mode === 'jour' ? 'moy. / jour' : mode === 'semaine' ? 'moy. / sem.' : 'moy. / mois';

  const perfTabs: { key: PerfView; label: string; hint: string }[] = [
    { key: 'repartition', label: 'Répartition', hint: 'muscles' },
    { key: 'evolution', label: 'Évolution', hint: avgWord },
    { key: 'charge', label: 'Charge', hint: 'exo' },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      <Text style={styles.kicker}>TERRAIN DE JEU</Text>
      <Text style={styles.title}>Stats</Text>
      <Text style={styles.subtitle}>
        Vue multi-périodes : compare {mode === 'jour' ? 'jour après jour' : mode === 'semaine' ? 'semaine après semaine' : 'mois après mois'}.
        Tape une barre ou un point du graphique.
      </Text>

      <ModeSwitch mode={mode} onChange={(m) => { setMode(m); setAnchor(todayISO()); }} />

      <Card style={styles.periodCard}>
        <View style={styles.periodNav}>
          <Pressable onPress={() => shiftWindow(-1)} style={styles.navBtn}><Text style={styles.navBtnText}>‹</Text></Pressable>
          <Pressable onPress={() => setAnchor(todayISO())} style={{ flex: 1, alignItems: 'center', paddingHorizontal: spacing.sm }}>
            <Text style={styles.periodLabel}>Fenêtre {mode}</Text>
            <Text style={styles.periodHint}>{windowLabel}</Text>
            <Text style={styles.periodFocus}>Focus : {focus.label}</Text>
          </Pressable>
          <Pressable onPress={() => canNext && shiftWindow(1)} disabled={!canNext} style={[styles.navBtn, !canNext && { opacity: 0.3 }]}>
            <Text style={styles.navBtnText}>›</Text>
          </Pressable>
        </View>
      </Card>

      {/* 1 Régularité */}
      <Card style={styles.section}>
        <SectionTitle icon="📅">1 · Régularité</SectionTitle>
        <Text style={styles.sectionHint}>
          {WINDOW[mode]} {mode === 'jour' ? 'jours' : mode === 'semaine' ? 'semaines' : 'mois'} côte à côte
        </Text>
        <View style={styles.kpiRow}>
          <Kpi value={String(focusSessions)} label="jours actifs" color={colors.success} />
          <Kpi value={diffTxt(focusSessions, prevSessions).t} label="vs préc." color={diffTxt(focusSessions, prevSessions).c} />
          <Kpi value={fmt(focusTonnage, 0)} label="kg tonnage" color={colors.primary} />
        </View>
        <TapBarChart
          data={sessionsSeries}
          width={W}
          height={190}
          selectedId={focus.id}
          onPointPress={(d) => {
            const p = periods.find((x) => x.id === d.id);
            if (p) void openPeriodDetail(p);
          }}
          hint="Séances / jours actifs"
        />
      </Card>

      {/* 2 Poids */}
      <Card style={styles.section}>
        <SectionTitle icon="⚖️">2 · Poids de corps</SectionTitle>
        <View style={styles.kpiRow}>
          <Kpi value={fmt(weightNow)} label="focus" unit="kg" color={colors.secondary} />
          <Kpi value={diffTxt(weightNow, weightPrev).t} label="vs préc." color={diffTxt(weightNow, weightPrev).c} />
        </View>
        {weightSeries.length >= 2 ? (
          <TapLineChart
            data={weightSeries}
            width={W}
            height={190}
            ySuffix="kg"
            color={colors.secondary}
            selectedId={focus.id}
            onPointPress={(d) => {
              const p = periods.find((x) => x.id === d.id);
              if (p) void openPeriodDetail(p);
            }}
          />
        ) : (
          <EmptyState icon="⚖️" title="Pas assez de poids journalisé" />
        )}
      </Card>

      {/* 3 Perfs */}
      <Card style={styles.section}>
        <SectionTitle icon="🏋️">3 · Perfs sportives</SectionTitle>
        <Text style={styles.sectionHint}>
          Répartition muscles → évolution (moyennes {mode}) → charge exo. Tape pour le détail / Easy Bilan.
        </Text>

        <View style={styles.perfTabs}>
          {perfTabs.map((t) => {
            const on = perfView === t.key;
            return (
              <Pressable key={t.key} onPress={() => setPerfView(t.key)} style={{ flex: 1 }}>
                {on ? (
                  <LinearGradient colors={gradients.primary} style={styles.perfTabOn}>
                    <Text style={styles.perfTabOnText}>{t.label}</Text>
                    <Text style={styles.perfTabOnHint}>{t.hint}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.perfTabOff}>
                    <Text style={styles.perfTabOffText}>{t.label}</Text>
                    <Text style={styles.perfTabOffHint}>{t.hint}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {perfView !== 'repartition' && muscleNames.length ? (
          <CyclePicker
            label="Groupe musculaire"
            value={muscle ?? '—'}
            color={muscle ? (muscleColors[muscle] ?? colors.primary) : colors.text}
            onPrev={() => setMuscle(cycleIndex(muscleNames, muscle, -1))}
            onNext={() => setMuscle(cycleIndex(muscleNames, muscle, 1))}
          />
        ) : null}

        {perfView === 'charge' && exerciseNames.length ? (
          <CyclePicker
            label="Exercice"
            value={exercise ?? '—'}
            color={colors.gold}
            onPrev={() => setExercise(cycleIndex(exerciseNames, exercise, -1))}
            onNext={() => setExercise(cycleIndex(exerciseNames, exercise, 1))}
          />
        ) : null}

        {perfView === 'repartition' ? (
          <>
            <View style={styles.kpiRow}>
              <Kpi value={fmt(focusTonnage, 0)} label="tonnage focus" unit="kg" color={colors.primary} />
              <Kpi value={diffTxt(focusTonnage, prevTonnage).t} label="vs préc." color={diffTxt(focusTonnage, prevTonnage).c} />
            </View>
            {muscleBars.length ? (
              <TapHBarChart
                data={muscleBars}
                width={W}
                selectedId={muscle}
                hint={`Volume muscles · ${focus.label}`}
                onPointPress={(d) => {
                  setMuscle(d.id);
                  setPerfView('evolution');
                  void openMuscleDrill(d.id, focus);
                }}
              />
            ) : (
              <EmptyState icon="🏋️" title="Pas de volume musculaire" />
            )}
          </>
        ) : null}

        {perfView === 'evolution' && muscle ? (
          <>
            <View style={styles.kpiRow}>
              <Kpi value={fmt(muscleAvg, 0)} label={avgWord} unit="kg" color={muscleColors[muscle] ?? colors.primary} />
              <Kpi value={fmt(focusMuscleTon, 0)} label="focus" unit="kg" color={colors.primary} />
              <Kpi value={diffTxt(focusMuscleTon, prevMuscleTon).t} label="vs préc." color={diffTxt(focusMuscleTon, prevMuscleTon).c} />
            </View>
            {muscleHistory.some((d) => d.value > 0) ? (
              <TapBarChart
                data={muscleHistory}
                width={W}
                height={190}
                selectedId={focus.id}
                hint={`${muscle} · tonnage par ${mode}`}
                onPointPress={(d) => {
                  const p = periods.find((x) => x.id === d.id);
                  if (p) void openMuscleDrill(muscle, p);
                }}
              />
            ) : (
              <EmptyState icon="🏋️" title="Pas de tonnage sur cette fenêtre" />
            )}
          </>
        ) : null}

        {perfView === 'charge' && exercise ? (
          <>
            <View style={styles.kpiRow}>
              <Kpi value={fmt(loadAvg)} label={avgWord} unit="kg" color={colors.gold} />
              <Kpi value={fmt(metricForPeriod(focus, 'charge') || null)} label="focus" unit="kg" color={colors.gold} />
              <Kpi
                value={diffTxt(
                  metricForPeriod(focus, 'charge') || null,
                  prevPeriod ? metricForPeriod(prevPeriod, 'charge') || null : null,
                ).t}
                label="vs préc."
                color={diffTxt(
                  metricForPeriod(focus, 'charge') || null,
                  prevPeriod ? metricForPeriod(prevPeriod, 'charge') || null : null,
                ).c}
              />
            </View>
            {loadSeries.length >= 2 ? (
              <TapLineChart
                data={loadSeries}
                width={W}
                height={190}
                ySuffix="kg"
                color={colors.gold}
                selectedId={focus.id}
                hint={`${exercise} · charge max`}
                onPointPress={(d) => {
                  const p = periods.find((x) => x.id === d.id);
                  if (p && muscle) void openExerciseDrill(exercise, muscle, p, prevPeriod);
                }}
              />
            ) : (
              <EmptyState icon="🏋️" title="Pas assez de séances pour la courbe" />
            )}
          </>
        ) : null}
      </Card>

      {/* 4 Santé */}
      <Card style={styles.section}>
        <SectionTitle icon="💚">4 · Santé</SectionTitle>
        <Text style={styles.sectionHint}>Coche les courbes · chaque point = une période de la fenêtre</Text>
        <View style={styles.wrapChips}>
          {HEALTH_OPTS.filter((h) => h.key !== 'weight').map((h) => (
            <CheckChip
              key={h.key}
              label={h.label}
              checked={healthChecked.includes(h.key)}
              color={h.color}
              onPress={() => setHealthChecked((prev) => (
                prev.includes(h.key)
                  ? (prev.length === 1 ? prev : prev.filter((k) => k !== h.key))
                  : [...prev, h.key]
              ))}
            />
          ))}
        </View>
        {healthChecked.map((key) => {
          const meta = HEALTH_OPTS.find((h) => h.key === key)!;
          const series: ChartDatum[] = periods.map((p) => ({
            id: p.id,
            label: p.short,
            value: metricForPeriod(p, key),
            color: meta.color,
          })).filter((d) => d.value > 0);
          const now = metricForPeriod(focus, key) || null;
          const prev = prevPeriod ? metricForPeriod(prevPeriod, key) || null : null;
          const d = diffTxt(now, prev);
          return (
            <View key={key} style={styles.healthBlock}>
              <View style={styles.healthHead}>
                <Text style={[styles.healthTitle, { color: meta.color }]}>{meta.label}</Text>
                <Text style={styles.healthAvg}>{fmt(now)} {meta.unit} · <Text style={{ color: d.c }}>{d.t}</Text></Text>
              </View>
              {series.length >= 2 ? (
                <TapLineChart
                  data={series}
                  width={W}
                  height={160}
                  color={meta.color}
                  selectedId={focus.id}
                  onPointPress={(pt) => {
                    const p = periods.find((x) => x.id === pt.id);
                    if (p) void openPeriodDetail(p);
                  }}
                />
              ) : (
                <Text style={styles.miniHint}>Pas assez de points.</Text>
              )}
            </View>
          );
        })}
      </Card>

      {/* 5 Croisé */}
      <Card style={styles.section}>
        <SectionTitle icon="🔀">5 · Analyse croisée</SectionTitle>
        <Text style={styles.sectionHint}>
          Plusieurs courbes, chacune avec son échelle. Pour tonnage / charge : change muscle ou exo avec ‹ ›.
        </Text>
        <View style={styles.wrapChips}>
          {CROSS_OPTS.map((o) => (
            <CheckChip
              key={o.key}
              label={o.label}
              checked={crossChecked.includes(o.key)}
              color={o.color}
              onPress={() => setCrossChecked((prev) => (
                prev.includes(o.key)
                  ? (prev.length === 1 ? prev : prev.filter((k) => k !== o.key))
                  : [...prev, o.key]
              ))}
            />
          ))}
        </View>
        {crossChecked.map((key) => {
          const meta = CROSS_OPTS.find((o) => o.key === key)!;

          if (key === 'tonnage') {
            const mName = crossMuscle ?? muscleNames[0] ?? null;
            const series: ChartDatum[] = periods.map((p) => ({
              id: p.id,
              label: p.short,
              value: mName
                ? (muscleTonnageInPeriod(p).find((x) => x.muscle === mName)?.tonnage ?? 0)
                : metricForPeriod(p, 'tonnage'),
              color: mName ? (muscleColors[mName] ?? meta.color) : meta.color,
            }));
            return (
              <View key={key} style={styles.healthBlock}>
                <Text style={[styles.healthTitle, { color: meta.color }]}>Tonnage musculaire</Text>
                {muscleNames.length ? (
                  <CyclePicker
                    label="Groupe"
                    value={mName ?? '—'}
                    color={mName ? (muscleColors[mName] ?? colors.primary) : colors.text}
                    onPrev={() => setCrossMuscle(cycleIndex(muscleNames, mName, -1))}
                    onNext={() => setCrossMuscle(cycleIndex(muscleNames, mName, 1))}
                  />
                ) : null}
                {series.some((d) => d.value > 0) ? (
                  <TapBarChart
                    data={series}
                    width={W}
                    height={160}
                    selectedId={focus.id}
                    onPointPress={(pt) => {
                      const p = periods.find((x) => x.id === pt.id);
                      if (p && mName) void openMuscleDrill(mName, p);
                    }}
                  />
                ) : (
                  <Text style={styles.miniHint}>Pas assez de points.</Text>
                )}
              </View>
            );
          }

          if (key === 'charge') {
            const mName = muscle ?? muscleNames[0] ?? null;
            const exList = mName
              ? (byMuscle.find((m) => m.muscle === mName)?.exercises ?? []).map((e) => e.name)
              : [];
            const exName = exercise && exList.includes(exercise) ? exercise : (exList[0] ?? null);
            const series: ChartDatum[] = periods.map((p) => {
              // charge for selected exercise via history if matches, else 0 until history loads
              const sess = (exHistory?.exercise === exName ? exHistory.sessions : [])
                .filter((s) => inRange(s.date, p.start, p.end) && s.max_load != null);
              return {
                id: p.id,
                label: p.short,
                value: avg(sess.map((s) => s.max_load as number)) ?? 0,
                color: meta.color,
              };
            }).filter((d) => d.value > 0);
            return (
              <View key={key} style={styles.healthBlock}>
                <Text style={[styles.healthTitle, { color: meta.color }]}>Charge exo</Text>
                {muscleNames.length ? (
                  <CyclePicker
                    label="Groupe"
                    value={mName ?? '—'}
                    color={mName ? (muscleColors[mName] ?? colors.primary) : colors.text}
                    onPrev={() => {
                      const next = cycleIndex(muscleNames, mName, -1);
                      setMuscle(next);
                      const first = byMuscle.find((m) => m.muscle === next)?.exercises[0]?.name ?? null;
                      setExercise(first);
                    }}
                    onNext={() => {
                      const next = cycleIndex(muscleNames, mName, 1);
                      setMuscle(next);
                      const first = byMuscle.find((m) => m.muscle === next)?.exercises[0]?.name ?? null;
                      setExercise(first);
                    }}
                  />
                ) : null}
                {exList.length ? (
                  <CyclePicker
                    label="Exercice"
                    value={exName ?? '—'}
                    color={colors.gold}
                    onPrev={() => setExercise(cycleIndex(exList, exName, -1))}
                    onNext={() => setExercise(cycleIndex(exList, exName, 1))}
                  />
                ) : null}
                {series.length >= 2 ? (
                  <TapLineChart
                    data={series}
                    width={W}
                    height={160}
                    color={meta.color}
                    ySuffix="kg"
                    selectedId={focus.id}
                    onPointPress={(pt) => {
                      const p = periods.find((x) => x.id === pt.id);
                      if (p && mName && exName) void openExerciseDrill(exName, mName, p, prevPeriod);
                    }}
                  />
                ) : (
                  <Text style={styles.miniHint}>Pas assez de points pour cet exo.</Text>
                )}
              </View>
            );
          }

          const series: ChartDatum[] = periods.map((p) => ({
            id: p.id,
            label: p.short,
            value: metricForPeriod(p, key),
            color: meta.color,
          })).filter((d) => d.value > 0);
          return (
            <View key={key} style={styles.healthBlock}>
              <Text style={[styles.healthTitle, { color: meta.color }]}>{meta.label}</Text>
              <Text style={styles.miniHint}>Échelle réelle · {meta.unit}</Text>
              {series.length >= 2 ? (
                <TapLineChart
                  data={series}
                  width={W}
                  height={160}
                  color={meta.color}
                  ySuffix={meta.unit === 'kg' || meta.unit === 'h' ? meta.unit : ''}
                  selectedId={focus.id}
                  onPointPress={(pt) => {
                    const p = periods.find((x) => x.id === pt.id);
                    if (p) void openPeriodDetail(p);
                  }}
                />
              ) : (
                <Text style={styles.miniHint}>Pas assez de points.</Text>
              )}
            </View>
          );
        })}
      </Card>

      <DetailSheet detail={detail} onClose={() => setDetail(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 1.5 },
  kicker: { color: colors.primary, fontWeight: '800', fontSize: 11, letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '900', marginTop: 2 },
  subtitle: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20, marginTop: 6, marginBottom: spacing.md },
  modeRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  modeBtn: { paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center' },
  modeBtnOn: { color: '#fff', fontWeight: '800', fontSize: fontSize.sm },
  modeBtnOnHint: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '600', marginTop: 2 },
  modeBtnOff: {
    paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  modeBtnOffText: { color: colors.textMuted, fontWeight: '700', fontSize: fontSize.sm },
  modeBtnOffHint: { color: colors.textFaint, fontSize: 10, fontWeight: '600', marginTop: 2 },
  periodCard: { marginBottom: spacing.lg, paddingVertical: spacing.sm },
  periodNav: { flexDirection: 'row', alignItems: 'center' },
  navBtn: {
    width: 44, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceHi,
  },
  navBtnText: { color: colors.text, fontSize: 26, fontWeight: '800', marginTop: -2 },
  periodLabel: { color: colors.text, fontWeight: '900', fontSize: fontSize.md, textAlign: 'center', textTransform: 'capitalize' },
  periodHint: { color: colors.textFaint, fontSize: 11, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  periodFocus: { color: colors.primary, fontSize: 11, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  section: { marginBottom: spacing.lg },
  sectionHint: { color: colors.textFaint, fontSize: fontSize.xs, fontWeight: '600', marginBottom: spacing.md, marginTop: -4 },
  kpiRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  kpi: { flex: 1, backgroundColor: colors.backgroundAlt, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  kpiValue: { fontSize: fontSize.lg, fontWeight: '900' },
  kpiUnit: { fontSize: fontSize.xs, fontWeight: '700' },
  kpiLabel: { color: colors.textFaint, fontSize: 11, fontWeight: '700', marginTop: 4 },
  listTitle: { color: colors.textMuted, fontWeight: '800', fontSize: fontSize.xs, marginTop: spacing.sm, marginBottom: spacing.xs, textTransform: 'uppercase' },
  miniHint: { color: colors.textFaint, fontSize: fontSize.xs, fontWeight: '600', marginBottom: spacing.xs },
  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  checkChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill,
  },
  checkMark: { color: colors.textFaint, fontWeight: '900', fontSize: 12 },
  checkLabel: { color: colors.textMuted, fontWeight: '700', fontSize: fontSize.xs, maxWidth: 180 },
  perfTabs: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  perfTabOn: { paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center' },
  perfTabOnText: { color: '#fff', fontWeight: '800', fontSize: fontSize.xs },
  perfTabOnHint: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '600', marginTop: 2 },
  perfTabOff: {
    paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center',
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
  },
  perfTabOffText: { color: colors.textMuted, fontWeight: '700', fontSize: fontSize.xs },
  perfTabOffHint: { color: colors.textFaint, fontSize: 10, fontWeight: '600', marginTop: 2 },
  cycleWrap: { marginBottom: spacing.sm },
  cycleLabel: {
    color: colors.textFaint, fontSize: 10, fontWeight: '800', textTransform: 'uppercase',
    marginBottom: 4, letterSpacing: 0.6,
  },
  cycleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cycleBtn: {
    width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: colors.border,
  },
  cycleBtnText: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: -2 },
  cycleValueBox: {
    flex: 1, minHeight: 44, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.backgroundAlt, borderWidth: 1, borderColor: colors.border, justifyContent: 'center',
  },
  cycleValue: { color: colors.text, fontWeight: '800', fontSize: fontSize.sm, textAlign: 'center' },
  cycleHint: { color: colors.textFaint, fontSize: 10, fontWeight: '600', textAlign: 'center', marginTop: 2 },
  healthBlock: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  healthHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  healthTitle: { fontWeight: '900', fontSize: fontSize.sm },
  healthAvg: { color: colors.textMuted, fontWeight: '700', fontSize: fontSize.xs },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border, maxHeight: '85%',
  },
  modalTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '900', textTransform: 'capitalize' },
  modalSub: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 4, marginBottom: spacing.md },
  modalRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.md,
  },
  modalRowLabel: { color: colors.text, fontWeight: '700', fontSize: fontSize.sm },
  modalRowHint: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  modalRowVal: { color: colors.primary, fontWeight: '900', fontSize: fontSize.sm },
  modalClose: {
    marginTop: spacing.md, backgroundColor: colors.surfaceHi, borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: 'center',
  },
  modalCloseText: { color: colors.text, fontWeight: '800' },
  breakBlock: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 2, borderTopColor: colors.borderLight },
  breakTitle: { color: colors.gold, fontWeight: '900', fontSize: fontSize.sm, textTransform: 'capitalize' },
  breakMeta: { color: colors.textFaint, fontSize: 11, fontWeight: '600', marginBottom: spacing.xs, marginTop: 4 },
  seriesRow: { paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  seriesMain: { color: colors.text, fontWeight: '800', fontSize: fontSize.sm },
  seriesVals: { color: colors.primary, fontWeight: '800', fontSize: fontSize.sm, marginTop: 2 },
  seriesDate: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  seriesNote: { fontSize: 11, marginTop: 2, fontWeight: '700' },
});

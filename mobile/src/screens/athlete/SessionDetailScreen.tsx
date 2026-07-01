import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import {
  addExerciseEntry, createPerformance, deleteExerciseEntry, getProgram,
  lastPerformanceForExercise, listExerciseBank, listPerformance, listPrograms,
} from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { ExerciseEntryDTO, PerformanceEntryDTO, ProgramSessionDTO } from '../../api/types';
import { Badge, Button, Card, ErrorView, Input, LoadingView, SectionTitle } from '../../components/ui';
import { colors, fontSize, muscleColors, spacing } from '../../theme';
import { AthleteStackParamList } from '../../navigation/types';
import { todayISO } from '../../utils/format';

type Route = RouteProp<AthleteStackParamList, 'SessionDetail'>;

export default function SessionDetailScreen() {
  const { user } = useAuth();
  const isCoach = user?.role === 'coach';
  const { params } = useRoute<Route>();
  const athleteId = params.athleteId ?? user?.id ?? 0;
  const readOnly = !!params.readOnly;

  const [session, setSession] = useState<ProgramSessionDTO | null>(null);
  const [todayEntries, setTodayEntries] = useState<PerformanceEntryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      // On récupère la séance via le programme (l'API n'expose pas encore
      // GET /sessions/<id> isolé, mais chaque programme contient ses séances).
      const perfs = await listPerformance({ athlete_id: athleteId, session_id: params.sessionId, date: todayISO() });
      setTodayEntries(perfs);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }, [athleteId, params.sessionId]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        // On cherche la séance dans les programmes de l'athlète concerné.
        const programs = await listPrograms(athleteId);
        for (const p of programs) {
          const detailed = await getProgram(p.id);
          const found = detailed.sessions?.find((s) => s.id === params.sessionId);
          if (found) {
            setSession(found);
            break;
          }
        }
        await load();
      } catch (err) {
        setError(apiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [athleteId, params.sessionId, load]);

  if (loading) return <LoadingView label="Chargement de la séance..." />;
  if (error) return <ErrorView message={error} onRetry={load} />;
  if (!session) return <ErrorView message="Séance introuvable" />;

  const refreshSession = async () => {
    try {
      const detailed = await getProgram(session.program_id);
      const found = detailed.sessions?.find((s) => s.id === params.sessionId);
      if (found) setSession(found);
    } catch {
      // ignore
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{session.session_name}</Text>
      {session.exercises.map((exercise) => (
        <ExerciseCard
          key={exercise.id}
          exercise={exercise}
          athleteId={athleteId}
          readOnly={readOnly}
          isCoach={isCoach}
          todayEntries={todayEntries.filter((e) => e.exercise === exercise.name)}
          onLogged={load}
          onDeleted={refreshSession}
        />
      ))}
      {isCoach && <AddExerciseForm sessionId={session.id} onAdded={refreshSession} />}
    </ScrollView>
  );
}

function AddExerciseForm({ sessionId, onAdded }: { sessionId: number; onAdded: () => void }) {
  const [bankNames, setBankNames] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [sets, setSets] = useState('4');
  const [reps, setReps] = useState('8-12');
  const [rest, setRest] = useState('90s');
  const [muscle, setMuscle] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listExerciseBank().then((data) => setBankNames(data.exercises.map((e) => e.name))).catch(() => setBankNames([]));
  }, []);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await addExerciseEntry(sessionId, {
        name: name.trim(), sets: sets ? parseInt(sets, 10) : undefined, reps, rest, muscle: muscle || undefined,
      });
      setName(''); setMuscle('');
      onAdded();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ marginBottom: spacing.lg }}>
      <SectionTitle>+ Ajouter un exercice</SectionTitle>
      <Input placeholder="Nom de l'exercice" value={name} onChangeText={setName} />
      {bankNames.length > 0 && (
        <View style={styles.suggestionRow}>
          {bankNames.slice(0, 6).map((n) => (
            <View key={n} onTouchEnd={() => setName(n)}>
              <Badge label={n} color={colors.textMuted} />
            </View>
          ))}
        </View>
      )}
      <View style={styles.formRow}>
        <Input style={styles.formInput} placeholder="Séries" keyboardType="numeric" value={sets} onChangeText={setSets} />
        <Input style={styles.formInput} placeholder="Reps (ex: 8-12)" value={reps} onChangeText={setReps} />
      </View>
      <View style={styles.formRow}>
        <Input style={styles.formInput} placeholder="Repos (ex: 90s)" value={rest} onChangeText={setRest} />
        <Input style={styles.formInput} placeholder="Muscle" value={muscle} onChangeText={setMuscle} />
      </View>
      <Button title="Ajouter à la séance" onPress={handleAdd} loading={saving} disabled={!name.trim()} style={{ marginTop: spacing.md }} />
    </Card>
  );
}

function ExerciseCard({
  exercise, athleteId, readOnly, isCoach, todayEntries, onLogged, onDeleted,
}: {
  exercise: ExerciseEntryDTO; athleteId: number; readOnly: boolean; isCoach: boolean;
  todayEntries: PerformanceEntryDTO[]; onLogged: () => void; onDeleted: () => void;
}) {
  const [lastEntries, setLastEntries] = useState<PerformanceEntryDTO[]>([]);
  const [values, setValues] = useState<Record<number, { reps: string; load: string }>>({});
  const [savingSeries, setSavingSeries] = useState<number | null>(null);

  useEffect(() => {
    lastPerformanceForExercise(athleteId, exercise.name).then(setLastEntries).catch(() => setLastEntries([]));
  }, [athleteId, exercise.name]);

  const seriesList = exercise.series.length > 0
    ? exercise.series
    : Array.from({ length: exercise.sets ?? 3 }, (_, i) => ({ number: i + 1, description: '', text: `Série ${i + 1}`, is_main: false }));

  const getLastForSeries = (seriesNumber: number) => lastEntries.find((e) => e.series_number === seriesNumber);
  const getTodayForSeries = (seriesNumber: number) => todayEntries.find((e) => e.series_number === seriesNumber);

  const handleSave = async (seriesNumber: number) => {
    const v = values[seriesNumber];
    if (!v?.reps && !v?.load) return;
    setSavingSeries(seriesNumber);
    try {
      await createPerformance({
        athlete_id: athleteId,
        exercise: exercise.name,
        series_number: seriesNumber,
        reps: v.reps ? parseFloat(v.reps.replace(',', '.')) : undefined,
        load: v.load ? parseFloat(v.load.replace(',', '.')) : undefined,
      });
      onLogged();
    } catch {
      // ignore - l'utilisateur peut réessayer
    } finally {
      setSavingSeries(null);
    }
  };

  return (
    <Card style={{ marginBottom: spacing.lg }}>
      <View style={styles.exerciseHeader}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        {exercise.muscle ? <Badge label={exercise.muscle} color={muscleColors[exercise.muscle] ?? colors.primary} /> : null}
        {isCoach && (
          <Button
            title="✕"
            variant="ghost"
            onPress={async () => { await deleteExerciseEntry(exercise.id); onDeleted(); }}
            style={styles.deleteExerciseBtn}
          />
        )}
      </View>
      <Text style={styles.exerciseMeta}>
        {exercise.sets ?? seriesList.length} séries · {exercise.reps ?? '-'} reps · repos {exercise.rest ?? '-'}
        {exercise.rir ? ` · RIR ${exercise.rir}` : ''}
      </Text>
      {exercise.remark ? <Text style={styles.remark}>💬 {exercise.remark}</Text> : null}

      <View style={{ marginTop: spacing.md }}>
        {seriesList.map((s) => {
          const last = getLastForSeries(s.number);
          const done = getTodayForSeries(s.number);
          return (
            <View key={s.number} style={styles.seriesRow}>
              <Text style={styles.seriesLabel}>S{s.number}</Text>
              <Text style={styles.seriesDesc} numberOfLines={1}>{s.description || '-'}</Text>
              {readOnly ? (
                <Text style={styles.doneText}>
                  {done ? `${done.reps ?? '-'} reps · ${done.load ?? '-'}kg` : '—'}
                </Text>
              ) : done ? (
                <Text style={styles.doneText}>✓ {done.reps}×{done.load}kg</Text>
              ) : (
                <View style={styles.inputsRow}>
                  <Input
                    style={styles.smallInput}
                    keyboardType="numeric"
                    placeholder={last ? String(last.reps ?? '') : 'reps'}
                    value={values[s.number]?.reps ?? ''}
                    onChangeText={(t) => setValues((v) => ({ ...v, [s.number]: { ...v[s.number], reps: t } }))}
                  />
                  <Input
                    style={styles.smallInput}
                    keyboardType="numeric"
                    placeholder={last ? String(last.load ?? '') : 'kg'}
                    value={values[s.number]?.load ?? ''}
                    onChangeText={(t) => setValues((v) => ({ ...v, [s.number]: { ...v[s.number], load: t } }))}
                  />
                  <Button
                    title="OK"
                    onPress={() => handleSave(s.number)}
                    loading={savingSeries === s.number}
                    style={styles.okButton}
                  />
                </View>
              )}
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800', marginBottom: spacing.lg },
  exerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  exerciseName: { color: colors.text, fontSize: fontSize.md, fontWeight: '700', flex: 1, marginRight: spacing.sm },
  exerciseMeta: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs },
  remark: { color: colors.warning, fontSize: fontSize.sm, marginTop: spacing.xs },
  seriesRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm,
  },
  seriesLabel: { color: colors.primary, fontWeight: '700', width: 28 },
  seriesDesc: { color: colors.textMuted, flex: 1, fontSize: fontSize.sm },
  doneText: { color: colors.success, fontWeight: '600', fontSize: fontSize.sm },
  inputsRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
  smallInput: { width: 56, paddingVertical: spacing.sm, textAlign: 'center' },
  okButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  deleteExerciseBtn: { paddingVertical: 2, paddingHorizontal: spacing.xs, marginLeft: spacing.xs },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  formRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  formInput: { flex: 1 },
});

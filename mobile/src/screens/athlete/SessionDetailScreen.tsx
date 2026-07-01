import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import {
  addExerciseEntry, createPerformance, deleteExerciseEntry, getProgram,
  lastPerformanceForExercise, listExerciseBank, listPerformance, listPrograms, updateExerciseEntry,
} from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { ExerciseEntryDTO, PerformanceEntryDTO, ProgramSessionDTO } from '../../api/types';
import { Badge, Button, Card, ErrorView, Input, LoadingView, ProgressBar, SectionTitle } from '../../components/ui';
import { colors, fontSize, gradients, muscleColors, radius, shadow, spacing } from '../../theme';
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

  const totalSeries = session.exercises.reduce((acc, ex) => acc + (ex.series.length || ex.sets || 3), 0);
  const doneSeries = todayEntries.length;
  const progress = totalSeries > 0 ? Math.min(1, doneSeries / totalSeries) : 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{session.session_name}</Text>
        <Text style={styles.subtitle}>
          {session.exercises.length} exercice{session.exercises.length > 1 ? 's' : ''} · {doneSeries}/{totalSeries} séries loggées
        </Text>
        <ProgressBar value={progress} color={progress >= 1 ? colors.success : colors.primary} />
      </View>

      {session.exercises.map((exercise, idx) => (
        <ExerciseCard
          key={exercise.id}
          index={idx + 1}
          exercise={exercise}
          athleteId={athleteId}
          sessionId={session.id}
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
      <SectionTitle icon="➕">Ajouter un exercice</SectionTitle>
      <Input placeholder="Nom de l'exercice" value={name} onChangeText={setName} />
      {bankNames.length > 0 && (
        <View style={styles.suggestionRow}>
          {bankNames.slice(0, 6).map((n) => (
            <Pressable key={n} onPress={() => setName(n)}>
              <Badge label={n} color={colors.textMuted} />
            </Pressable>
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

function EditExerciseForm({
  exercise, onCancel, onSaved,
}: { exercise: ExerciseEntryDTO; onCancel: () => void; onSaved: () => void }) {
  const [name, setName] = useState(exercise.name);
  const [sets, setSets] = useState(exercise.sets ? String(exercise.sets) : '');
  const [reps, setReps] = useState(exercise.reps ?? '');
  const [rest, setRest] = useState(exercise.rest ?? '');
  const [rir, setRir] = useState(exercise.rir ?? '');
  const [muscle, setMuscle] = useState(exercise.muscle ?? '');
  const [remark, setRemark] = useState(exercise.remark ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateExerciseEntry(exercise.id, {
        name: name.trim() || exercise.name,
        sets: sets ? parseInt(sets, 10) : null,
        reps: reps || null,
        rest: rest || null,
        rir: rir || null,
        muscle: muscle || null,
        remark: remark || null,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ marginTop: spacing.sm }}>
      <Input placeholder="Nom de l'exercice" value={name} onChangeText={setName} />
      <View style={styles.formRow}>
        <Input style={styles.formInput} placeholder="Séries" keyboardType="numeric" value={sets} onChangeText={setSets} />
        <Input style={styles.formInput} placeholder="Reps (ex: 8-12)" value={reps} onChangeText={setReps} />
      </View>
      <View style={styles.formRow}>
        <Input style={styles.formInput} placeholder="Repos (ex: 90s)" value={rest} onChangeText={setRest} />
        <Input style={styles.formInput} placeholder="RIR" value={rir} onChangeText={setRir} />
      </View>
      <View style={styles.formRow}>
        <Input style={styles.formInput} placeholder="Muscle" value={muscle} onChangeText={setMuscle} />
      </View>
      <Input placeholder="Remarque (optionnel)" value={remark} onChangeText={setRemark} style={{ marginTop: spacing.sm }} />
      <View style={[styles.formRow, { marginTop: spacing.md }]}>
        <Button title="Annuler" variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
        <Button title="Enregistrer" onPress={handleSave} loading={saving} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

function ExerciseCard({
  exercise, index, athleteId, sessionId, readOnly, isCoach, todayEntries, onLogged, onDeleted,
}: {
  exercise: ExerciseEntryDTO; index: number; athleteId: number; sessionId: number; readOnly: boolean; isCoach: boolean;
  todayEntries: PerformanceEntryDTO[]; onLogged: () => void; onDeleted: () => void;
}) {
  const [lastEntries, setLastEntries] = useState<PerformanceEntryDTO[]>([]);
  const [values, setValues] = useState<Record<number, { reps: string; load: string; note: string }>>({});
  const [noteOpenFor, setNoteOpenFor] = useState<number | null>(null);
  const [savingSeries, setSavingSeries] = useState<number | null>(null);
  const [justPR, setJustPR] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    lastPerformanceForExercise(athleteId, exercise.name).then(setLastEntries).catch(() => setLastEntries([]));
  }, [athleteId, exercise.name]);

  const seriesList = exercise.series.length > 0
    ? exercise.series
    : Array.from({ length: exercise.sets ?? 3 }, (_, i) => ({ number: i + 1, description: '', text: `Série ${i + 1}`, is_main: false }));

  const getLastForSeries = (seriesNumber: number) => lastEntries.find((e) => e.series_number === seriesNumber);
  const getTodayForSeries = (seriesNumber: number) => todayEntries.find((e) => e.series_number === seriesNumber);

  const bestLastLoad = lastEntries.reduce((max, e) => (e.load && e.load > max ? e.load : max), 0);
  const doneCount = seriesList.filter((s) => getTodayForSeries(s.number)).length;

  const handleSave = async (seriesNumber: number) => {
    const v = values[seriesNumber];
    if (!v?.reps && !v?.load) return;
    setSavingSeries(seriesNumber);
    try {
      const load = v.load ? parseFloat(v.load.replace(',', '.')) : undefined;
      await createPerformance({
        athlete_id: athleteId,
        program_session_id: sessionId,
        exercise: exercise.name,
        series_number: seriesNumber,
        reps: v.reps ? parseFloat(v.reps.replace(',', '.')) : undefined,
        load,
        notes: v.note?.trim() ? v.note.trim() : undefined,
      });
      if (load && bestLastLoad && load > bestLastLoad) {
        setJustPR(seriesNumber);
      }
      setNoteOpenFor(null);
      onLogged();
    } catch {
      // ignore - l'utilisateur peut réessayer
    } finally {
      setSavingSeries(null);
    }
  };

  const isComplete = doneCount === seriesList.length;

  return (
    <Card style={[{ marginBottom: spacing.lg }, isComplete && styles.exerciseCardDone]}>
      <View style={styles.exerciseHeader}>
        <View style={styles.exerciseIndex}>
          <Text style={styles.exerciseIndexText}>{index}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          <View style={styles.chipRow}>
            {exercise.muscle ? <Badge label={exercise.muscle} color={muscleColors[exercise.muscle] ?? colors.primary} /> : null}
            {isComplete && <Badge label="✓ FAIT" color={colors.success} />}
          </View>
        </View>
        {isCoach && (
          <View style={{ flexDirection: 'row' }}>
            <Button title="✎" variant="ghost" onPress={() => setEditing((e) => !e)} style={styles.deleteExerciseBtn} />
            <Button
              title="✕"
              variant="ghost"
              onPress={async () => { await deleteExerciseEntry(exercise.id); onDeleted(); }}
              style={styles.deleteExerciseBtn}
            />
          </View>
        )}
      </View>
      {editing ? (
        <EditExerciseForm
          exercise={exercise}
          onCancel={() => setEditing(false)}
          onSaved={() => { setEditing(false); onDeleted(); }}
        />
      ) : (
        <>
          <Text style={styles.exerciseMeta}>
            {exercise.sets ?? seriesList.length} séries · {exercise.reps ?? '-'} reps · repos {exercise.rest ?? '-'}
            {exercise.rir ? ` · RIR ${exercise.rir}` : ''}
          </Text>
          {exercise.remark ? <Text style={styles.remark}>💬 {exercise.remark}</Text> : null}
        </>
      )}

      <View style={{ marginTop: spacing.md }}>
        {seriesList.map((s) => {
          const last = getLastForSeries(s.number);
          const done = getTodayForSeries(s.number);
          const isPR = justPR === s.number || (done?.load && bestLastLoad && done.load > bestLastLoad);
          return (
            <View key={s.number}>
              <View style={styles.seriesRow}>
                <View style={[styles.seriesBadge, done && styles.seriesBadgeDone]}>
                  <Text style={[styles.seriesBadgeText, done && { color: '#fff' }]}>{s.number}</Text>
                </View>
                <Text style={styles.seriesDesc} numberOfLines={1}>{s.description || '-'}</Text>
                {readOnly ? (
                  <Text style={styles.doneText}>
                    {done ? `${done.reps ?? '-'} reps · ${done.load ?? '-'}kg` : '—'}
                  </Text>
                ) : done ? (
                  <View style={styles.doneRow}>
                    {isPR ? <Text style={styles.prBadge}>🏆 PR</Text> : null}
                    <Text style={styles.doneText}>{done.reps}×{done.load}kg</Text>
                  </View>
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
                    <Pressable
                      onPress={() => setNoteOpenFor((cur) => (cur === s.number ? null : s.number))}
                      style={styles.noteToggle}
                    >
                      <Text style={[styles.noteToggleText, !!values[s.number]?.note && styles.noteToggleActive]}>💬</Text>
                    </Pressable>
                    <Pressable onPress={() => handleSave(s.number)} disabled={savingSeries === s.number} style={{ opacity: savingSeries === s.number ? 0.6 : 1 }}>
                      <LinearGradient colors={gradients.success} style={styles.okButton}>
                        <Text style={styles.okButtonText}>{savingSeries === s.number ? '…' : '✓'}</Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                )}
              </View>
              {!readOnly && !done && noteOpenFor === s.number && (
                <Input
                  placeholder="Remarque (ex: douleur épaule, tempo lent...)"
                  value={values[s.number]?.note ?? ''}
                  onChangeText={(t) => setValues((v) => ({ ...v, [s.number]: { ...v[s.number], note: t } }))}
                  style={styles.noteInput}
                />
              )}
              {done?.notes ? <Text style={styles.doneNote}>💬 {done.notes}</Text> : null}
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
  header: { marginBottom: spacing.lg },
  title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '900' },
  subtitle: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '600', marginTop: spacing.xs, marginBottom: spacing.md },
  exerciseCardDone: { borderColor: colors.success, opacity: 0.92 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  exerciseIndex: {
    width: 30, height: 30, borderRadius: radius.sm, backgroundColor: colors.surfaceHi,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm,
  },
  exerciseIndexText: { color: colors.textMuted, fontWeight: '800', fontSize: fontSize.sm },
  exerciseName: { color: colors.text, fontSize: fontSize.md, fontWeight: '800' },
  chipRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs, flexWrap: 'wrap' },
  exerciseMeta: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.sm, fontWeight: '600' },
  remark: { color: colors.warning, fontSize: fontSize.sm, marginTop: spacing.xs },
  seriesRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm,
  },
  seriesBadge: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  seriesBadgeDone: { backgroundColor: colors.success },
  seriesBadgeText: { color: colors.textMuted, fontWeight: '800', fontSize: fontSize.xs },
  seriesDesc: { color: colors.textMuted, flex: 1, fontSize: fontSize.sm },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  prBadge: { color: colors.gold, fontWeight: '800', fontSize: fontSize.xs },
  doneText: { color: colors.success, fontWeight: '800', fontSize: fontSize.sm },
  inputsRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
  smallInput: { width: 56, paddingVertical: spacing.sm, textAlign: 'center' },
  okButton: {
    width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', ...shadow.card,
  },
  okButtonText: { color: '#08240F', fontWeight: '900', fontSize: fontSize.md },
  noteToggle: { paddingHorizontal: 4, paddingVertical: 4 },
  noteToggleText: { fontSize: 16, opacity: 0.4 },
  noteToggleActive: { opacity: 1 },
  noteInput: { marginTop: -spacing.xs, marginBottom: spacing.sm },
  doneNote: { color: colors.warning, fontSize: fontSize.xs, marginTop: -spacing.xs, marginBottom: spacing.sm, marginLeft: 36 },
  deleteExerciseBtn: { paddingVertical: 2, paddingHorizontal: spacing.xs, marginLeft: spacing.xs },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  formRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  formInput: { flex: 1 },
});

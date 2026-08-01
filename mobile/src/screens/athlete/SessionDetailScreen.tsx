import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import {
  addExerciseEntry, createPerformance, deleteExerciseEntry, deletePerformance, getProgram,
  lastPerformanceForExercise, listExerciseBank, listPerformance, listPrograms,
  updateExerciseEntry, updatePerformance,
} from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { ExerciseEntryDTO, PerformanceEntryDTO, ProgramSessionDTO } from '../../api/types';
import { Badge, Button, Card, ErrorView, Input, LoadingView, ProgressBar, SectionTitle } from '../../components/ui';
import { colors, fontSize, gradients, muscleColors, radius, shadow, spacing } from '../../theme';
import { AthleteStackParamList } from '../../navigation/types';
import { formatDateFR, isoDaysAgo, shiftLocalISO, todayISO } from '../../utils/format';

type Route = RouteProp<AthleteStackParamList, 'SessionDetail'>;

function groupHistoryByDate(entries: PerformanceEntryDTO[]): { date: string; series: PerformanceEntryDTO[] }[] {
  const map = new Map<string, PerformanceEntryDTO[]>();
  for (const e of entries) {
    const list = map.get(e.entry_date) ?? [];
    list.push(e);
    map.set(e.entry_date, list);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 8)
    .map(([date, series]) => ({
      date,
      series: [...series].sort((a, b) => (a.series_number ?? 0) - (b.series_number ?? 0)),
    }));
}

function mergeDayLogs(
  sessionId: number,
  exerciseNames: string[],
  bySession: PerformanceEntryDTO[],
  byDate: PerformanceEntryDTO[],
): PerformanceEntryDTO[] {
  const names = new Set(exerciseNames);
  const map = new Map<number, PerformanceEntryDTO>();
  for (const e of bySession) map.set(e.id, e);
  for (const e of byDate) {
    // Prefer session id; fall back to exercise name only when session link is missing
    if (e.program_session_id === sessionId) {
      map.set(e.id, e);
    } else if (e.program_session_id == null && names.has(e.exercise)) {
      map.set(e.id, e);
    }
  }
  return [...map.values()].sort((a, b) => (a.series_number ?? 0) - (b.series_number ?? 0));
}

export default function SessionDetailScreen() {
  const { user } = useAuth();
  const isCoach = user?.role === 'coach';
  const navigation = useNavigation();
  const { params } = useRoute<Route>();
  const athleteId = params.athleteId ?? user?.id ?? 0;
  const readOnly = !!params.readOnly;

  const [session, setSession] = useState<ProgramSessionDTO | null>(null);
  const [dayEntries, setDayEntries] = useState<PerformanceEntryDTO[]>([]);
  const [priorDates, setPriorDates] = useState<{ date: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Athlete must confirm log date before logging (unless coach read-only view).
  const needsDateConfirm = !readOnly && !isCoach;
  const [logDate, setLogDate] = useState<string | null>(
    params.logDate ?? (needsDateConfirm ? null : todayISO()),
  );
  const [dateDraft, setDateDraft] = useState(params.logDate ?? todayISO());

  const load = useCallback(async (date: string, sess: ProgramSessionDTO) => {
    try {
      setError(null);
      const names = sess.exercises.map((e) => e.name);
      const [bySession, byDate] = await Promise.all([
        listPerformance({ athlete_id: athleteId, session_id: params.sessionId, date }),
        listPerformance({ athlete_id: athleteId, date }),
      ]);
      setDayEntries(mergeDayLogs(params.sessionId, names, bySession, byDate));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }, [athleteId, params.sessionId]);

  const loadPriorDates = useCallback(async (sess: ProgramSessionDTO) => {
    try {
      const names = new Set(sess.exercises.map((e) => e.name));
      const [bySession, recent] = await Promise.all([
        listPerformance({ athlete_id: athleteId, session_id: params.sessionId }),
        listPerformance({ athlete_id: athleteId }),
      ]);
      const byId = new Map<number, PerformanceEntryDTO>();
      for (const e of bySession) byId.set(e.id, e);
      for (const e of recent) {
        if (e.program_session_id === params.sessionId) byId.set(e.id, e);
        else if (e.program_session_id == null && names.has(e.exercise)) byId.set(e.id, e);
      }
      const counts = new Map<string, number>();
      for (const e of byId.values()) {
        counts.set(e.entry_date, (counts.get(e.entry_date) ?? 0) + 1);
      }
      setPriorDates(
        [...counts.entries()]
          .sort((a, b) => (a[0] < b[0] ? 1 : -1))
          .slice(0, 8)
          .map(([date, count]) => ({ date, count })),
      );
    } catch {
      setPriorDates([]);
    }
  }, [athleteId, params.sessionId]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const programs = await listPrograms(athleteId);
        let found: ProgramSessionDTO | null = null;
        for (const p of programs) {
          const detailed = await getProgram(p.id);
          found = detailed.sessions?.find((s) => s.id === params.sessionId) ?? null;
          if (found) {
            setSession(found);
            break;
          }
        }
        if (found) {
          await loadPriorDates(found);
          if (logDate) await load(logDate, found);
        }
      } catch (err) {
        setError(apiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [athleteId, params.sessionId, load, loadPriorDates, logDate]);

  if (loading && !session) return <LoadingView label="Chargement de la séance..." />;
  if (error && !session) return <ErrorView message={error} onRetry={() => session && logDate && load(logDate, session)} />;
  if (!session) return <ErrorView message="Séance introuvable" />;

  // Date confirmation gate for athletes
  if (needsDateConfirm && !logDate) {
    const today = todayISO();
    const minDate = isoDaysAgo(60);
    const canConfirm = dateDraft >= minDate && dateDraft <= today;
    const draftPrior = priorDates.find((p) => p.date === dateDraft);

    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Card>
          <SectionTitle icon="📅">Date du log</SectionTitle>
          <Text style={styles.confirmTitle}>{session.session_name}</Text>
          <Text style={styles.confirmHint}>
            Tu peux attaquer n'importe quelle séance. Confirme la date à laquelle tes perfs seront enregistrées.
            Si tu as déjà logué cette séance un autre jour, choisis cette date pour retrouver ton historique.
          </Text>

          {priorDates.length > 0 && (
            <View style={styles.priorBox}>
              <Text style={styles.priorTitle}>Déjà logué sur cette séance</Text>
              <View style={styles.quickDates}>
                {priorDates.map((p) => (
                  <Pressable
                    key={p.date}
                    onPress={() => setDateDraft(p.date)}
                    style={[styles.quickChip, dateDraft === p.date && styles.quickChipActive]}
                  >
                    <Text style={[styles.quickChipText, dateDraft === p.date && styles.quickChipTextActive]}>
                      {formatDateFR(p.date)} · {p.count} série{p.count > 1 ? 's' : ''}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={styles.datePickerRow}>
            <Pressable
              onPress={() => setDateDraft((d) => {
                const next = shiftLocalISO(d, -1);
                return next < minDate ? d : next;
              })}
              style={styles.dateShiftBtn}
            >
              <Text style={styles.dateShiftText}>‹</Text>
            </Pressable>
            <View style={styles.dateCenter}>
              <Text style={styles.dateBig}>{formatDateFR(dateDraft)}</Text>
              <Text style={styles.dateIso}>{dateDraft}</Text>
              {draftPrior ? (
                <Text style={styles.priorHint}>{draftPrior.count} série(s) déjà enregistrée(s)</Text>
              ) : (
                <Text style={styles.priorHintMuted}>Aucun log ce jour-là</Text>
              )}
            </View>
            <Pressable
              onPress={() => setDateDraft((d) => {
                const next = shiftLocalISO(d, 1);
                return next > today ? d : next;
              })}
              style={styles.dateShiftBtn}
            >
              <Text style={styles.dateShiftText}>›</Text>
            </Pressable>
          </View>

          <View style={styles.quickDates}>
            <Pressable onPress={() => setDateDraft(today)} style={styles.quickChip}>
              <Text style={styles.quickChipText}>Aujourd'hui</Text>
            </Pressable>
            <Pressable onPress={() => setDateDraft(isoDaysAgo(1))} style={styles.quickChip}>
              <Text style={styles.quickChipText}>Hier</Text>
            </Pressable>
          </View>

          <Button
            title={draftPrior ? 'Rouvrir avec ces perfs' : 'Confirmer et ouvrir la séance'}
            onPress={() => {
              if (!canConfirm) return;
              setLogDate(dateDraft);
            }}
            disabled={!canConfirm}
            style={{ marginTop: spacing.lg }}
          />
          <Button
            title="Annuler"
            variant="ghost"
            onPress={() => navigation.goBack()}
            style={{ marginTop: spacing.sm }}
          />
        </Card>
      </ScrollView>
    );
  }

  const activeDate = logDate ?? todayISO();

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
  const doneSeries = dayEntries.length;
  const progress = totalSeries > 0 ? Math.min(1, doneSeries / totalSeries) : 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{session.session_name}</Text>
        <Pressable
          onPress={() => {
            if (needsDateConfirm) {
              setDateDraft(activeDate);
              setLogDate(null);
            }
          }}
          style={styles.dateBadge}
        >
          <Text style={styles.dateBadgeText}>📅 {formatDateFR(activeDate)}</Text>
          {needsDateConfirm ? <Text style={styles.dateBadgeChange}>changer</Text> : null}
        </Pressable>
        {doneSeries > 0 ? (
          <Text style={styles.resumeBanner}>
            ✓ {doneSeries} série{doneSeries > 1 ? 's' : ''} déjà loguée{doneSeries > 1 ? 's' : ''} le {formatDateFR(activeDate)} — tu peux modifier ou continuer
          </Text>
        ) : null}
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
          logDate={activeDate}
          readOnly={readOnly}
          isCoach={isCoach}
          dayEntries={dayEntries.filter((e) => e.exercise === exercise.name)}
          onLogged={() => load(activeDate, session)}
          onDeleted={refreshSession}
        />
      ))}
      {isCoach && <AddExerciseForm sessionId={session.id} onAdded={refreshSession} />}

      {!readOnly && (
        <FinishSessionButton
          doneSeries={doneSeries}
          totalSeries={totalSeries}
          sessionName={session.session_name ?? 'Séance'}
          onFinished={() => navigation.goBack()}
        />
      )}
    </ScrollView>
  );
}

function FinishSessionButton({
  doneSeries, totalSeries, sessionName, onFinished,
}: {
  doneSeries: number; totalSeries: number; sessionName: string; onFinished: () => void;
}) {
  const missing = Math.max(0, totalSeries - doneSeries);
  const complete = missing === 0 && totalSeries > 0;

  const handlePress = () => {
    if (complete) {
      if (Platform.OS === 'web') {
        window.alert(`Séance terminée 💪\n\nBravo ! Tu as validé les ${doneSeries} séries de « ${sessionName} ».`);
        onFinished();
        return;
      }
      Alert.alert(
        'Séance terminée 💪',
        `Bravo ! Tu as validé les ${doneSeries} séries de « ${sessionName} ».`,
        [{ text: 'OK', onPress: onFinished }],
      );
      return;
    }

    const msg = totalSeries === 0
      ? 'Cette séance n’a aucune série à logger. Terminer quand même ?'
      : `Tu n’as validé que ${doneSeries}/${totalSeries} séries (${missing} manquante${missing > 1 ? 's' : ''}).\n\nEs-tu sûr de ne pas avoir fait toute la séance ?`;

    if (Platform.OS === 'web') {
      if (window.confirm(`Séance incomplète\n\n${msg}`)) onFinished();
      return;
    }

    Alert.alert(
      'Séance incomplète',
      msg,
      [
        { text: 'Continuer à logger', style: 'cancel' },
        { text: 'Terminer quand même', style: 'destructive', onPress: onFinished },
      ],
    );
  };

  return (
    <Card style={{ marginTop: spacing.md, marginBottom: spacing.xl }}>
      <SectionTitle icon="🏁">Fin de séance</SectionTitle>
      <Text style={styles.finishHint}>
        {complete
          ? `Tout est validé (${doneSeries}/${totalSeries}). Tu peux clôturer.`
          : `${doneSeries}/${totalSeries} séries validées — il en reste ${missing}.`}
      </Text>
      <Button
        title="Terminer la séance"
        onPress={handlePress}
        variant={complete ? 'primary' : 'secondary'}
        style={{ marginTop: spacing.md }}
      />
    </Card>
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
  exercise, index, athleteId, sessionId, logDate, readOnly, isCoach, dayEntries, onLogged, onDeleted,
}: {
  exercise: ExerciseEntryDTO; index: number; athleteId: number; sessionId: number; logDate: string;
  readOnly: boolean; isCoach: boolean;
  dayEntries: PerformanceEntryDTO[]; onLogged: () => void; onDeleted: () => void;
}) {
  const [history, setHistory] = useState<PerformanceEntryDTO[]>([]);
  const [values, setValues] = useState<Record<number, { reps: string; load: string; note: string }>>({});
  const [noteOpenFor, setNoteOpenFor] = useState<number | null>(null);
  const [savingSeries, setSavingSeries] = useState<number | null>(null);
  const [justPR, setJustPR] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [editingSeries, setEditingSeries] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    lastPerformanceForExercise(athleteId, exercise.name)
      .then((entries) => {
        setHistory(entries);
        // Prefill empty series inputs from the most recent matching series
        setValues((prev) => {
          const next = { ...prev };
          const seriesCount = exercise.series.length || exercise.sets || 3;
          for (let n = 1; n <= seriesCount; n++) {
            if (next[n]?.reps || next[n]?.load) continue;
            const last = entries.find((e) => e.series_number === n) ?? entries[0];
            if (!last) continue;
            next[n] = {
              reps: last.reps != null ? String(last.reps) : '',
              load: last.load != null ? String(last.load) : '',
              note: '',
            };
          }
          return next;
        });
      })
      .catch(() => setHistory([]));
  }, [athleteId, exercise.name, exercise.series.length, exercise.sets]);

  const seriesList = exercise.series.length > 0
    ? exercise.series
    : Array.from({ length: exercise.sets ?? 3 }, (_, i) => ({ number: i + 1, description: '', text: `Série ${i + 1}`, is_main: false }));

  const getLastForSeries = (seriesNumber: number) => history.find((e) => e.series_number === seriesNumber);
  const getDayForSeries = (seriesNumber: number) => dayEntries.find((e) => e.series_number === seriesNumber);

  const bestLastLoad = history.reduce((max, e) => (e.load && e.load > max ? e.load : max), 0);
  const doneCount = seriesList.filter((s) => getDayForSeries(s.number)).length;
  const historyGroups = useMemo(() => groupHistoryByDate(history), [history]);

  const handleSave = async (seriesNumber: number, existing?: PerformanceEntryDTO | null) => {
    const last = getLastForSeries(seriesNumber);
    const v = values[seriesNumber] ?? { reps: '', load: '', note: '' };
    const repsStr = (v.reps || (existing?.reps != null ? String(existing.reps) : '') || (last?.reps != null ? String(last.reps) : '')).trim();
    const loadStr = (v.load || (existing?.load != null ? String(existing.load) : '') || (last?.load != null ? String(last.load) : '')).trim();
    if (!repsStr && !loadStr) {
      setSaveError('Entre au moins des reps ou une charge.');
      return;
    }
    setSaveError(null);
    setSavingSeries(seriesNumber);
    try {
      const load = loadStr ? parseFloat(loadStr.replace(',', '.')) : undefined;
      const reps = repsStr ? parseFloat(repsStr.replace(',', '.')) : undefined;
      const notes = v.note?.trim() ? v.note.trim() : (existing?.notes ?? undefined);

      if (existing?.id) {
        await updatePerformance(existing.id, {
          reps,
          load,
          notes: notes || null,
          series_number: seriesNumber,
        });
      } else {
        await createPerformance({
          athlete_id: athleteId,
          program_session_id: sessionId,
          entry_date: logDate,
          exercise: exercise.name,
          series_number: seriesNumber,
          reps,
          load,
          notes: notes || undefined,
        });
      }
      if (load && bestLastLoad && load > bestLastLoad) {
        setJustPR(seriesNumber);
      }
      setNoteOpenFor(null);
      setEditingSeries(null);
      lastPerformanceForExercise(athleteId, exercise.name).then(setHistory).catch(() => undefined);
      onLogged();
    } catch (err) {
      const msg = apiErrorMessage(err);
      setSaveError(msg);
      Alert.alert('Erreur', msg);
    } finally {
      setSavingSeries(null);
    }
  };

  const startEditDone = (done: PerformanceEntryDTO) => {
    const n = done.series_number ?? 0;
    setValues((v) => ({
      ...v,
      [n]: {
        reps: done.reps != null ? String(done.reps) : '',
        load: done.load != null ? String(done.load) : '',
        note: done.notes ?? '',
      },
    }));
    setEditingSeries(n);
    if (done.notes) setNoteOpenFor(n);
  };

  const handleDeleteDone = (done: PerformanceEntryDTO) => {
    const label = `S${done.series_number ?? '?'} — ${done.reps ?? '-'}×${done.load ?? '-'}kg`;
    const runDelete = async () => {
      try {
        setSaveError(null);
        await deletePerformance(done.id);
        setEditingSeries((cur) => (cur === done.series_number ? null : cur));
        setNoteOpenFor((cur) => (cur === done.series_number ? null : cur));
        lastPerformanceForExercise(athleteId, exercise.name).then(setHistory).catch(() => undefined);
        onLogged();
      } catch (err) {
        const msg = apiErrorMessage(err);
        setSaveError(msg);
        Alert.alert('Erreur', msg);
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Supprimer cette série loguée ?\n\n${label}`)) {
        void runDelete();
      }
      return;
    }
    Alert.alert('Supprimer la série', `Supprimer ${label} ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => { void runDelete(); } },
    ]);
  };

  const isComplete = doneCount === seriesList.length;

  const renderSeriesInputs = (sNumber: number, existing?: PerformanceEntryDTO | null) => {
    const current = values[sNumber] ?? { reps: '', load: '', note: '' };
    return (
      <View style={styles.inputsRow}>
        <Input
          style={styles.smallInput}
          keyboardType="numeric"
          placeholder="reps"
          value={current.reps}
          onChangeText={(t) => setValues((v) => ({
            ...v,
            [sNumber]: { reps: t, load: v[sNumber]?.load ?? '', note: v[sNumber]?.note ?? '' },
          }))}
        />
        <Input
          style={styles.smallInput}
          keyboardType="numeric"
          placeholder="kg"
          value={current.load}
          onChangeText={(t) => setValues((v) => ({
            ...v,
            [sNumber]: { reps: v[sNumber]?.reps ?? '', load: t, note: v[sNumber]?.note ?? '' },
          }))}
        />
        <Pressable
          onPress={() => setNoteOpenFor((cur) => (cur === sNumber ? null : sNumber))}
          style={styles.noteToggle}
        >
          <Text style={[styles.noteToggleText, !!current.note && styles.noteToggleActive]}>💬</Text>
        </Pressable>
        {existing ? (
          <>
            <Pressable onPress={() => handleDeleteDone(existing)} style={styles.deleteDoneBtn}>
              <Text style={styles.deleteDoneText}>🗑</Text>
            </Pressable>
            <Pressable onPress={() => setEditingSeries(null)} style={styles.noteToggle}>
              <Text style={styles.cancelEditText}>↩</Text>
            </Pressable>
          </>
        ) : null}
        <Pressable
          onPress={() => handleSave(sNumber, existing)}
          disabled={savingSeries === sNumber}
          style={{ opacity: savingSeries === sNumber ? 0.6 : 1 }}
        >
          <LinearGradient colors={gradients.success} style={styles.okButton}>
            <Text style={styles.okButtonText}>{savingSeries === sNumber ? '…' : '✓'}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    );
  };

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

      {!readOnly && historyGroups.length > 0 && (
        <View style={styles.historyBox}>
          <Text style={styles.historyTitle}>📈 Historique (surcharge)</Text>
          {historyGroups.map((g) => (
            <Text key={g.date} style={styles.historyLine} numberOfLines={2}>
              <Text style={styles.historyDate}>{formatDateFR(g.date)} · </Text>
              {g.series.map((s) => `S${s.series_number ?? '?'}: ${s.reps ?? '-'}×${s.load ?? '-'}kg`).join('  ')}
            </Text>
          ))}
        </View>
      )}

      {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}

      <View style={{ marginTop: spacing.md }}>
        {seriesList.map((s) => {
          const last = getLastForSeries(s.number);
          const done = getDayForSeries(s.number);
          const isEditingDone = editingSeries === s.number && !!done;
          const isPR = justPR === s.number || (done?.load && bestLastLoad && done.load > bestLastLoad);
          const current = values[s.number] ?? { reps: '', load: '', note: '' };
          const showInputs = !readOnly && (!done || isEditingDone);
          return (
            <View key={s.number}>
              <View style={styles.seriesRow}>
                <View style={[styles.seriesBadge, done && !isEditingDone && styles.seriesBadgeDone]}>
                  <Text style={[styles.seriesBadgeText, done && !isEditingDone && { color: '#fff' }]}>{s.number}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.seriesDesc} numberOfLines={1}>{s.description || `Série ${s.number}`}</Text>
                  {!done && last ? (
                    <Text style={styles.lastHint}>
                      Dernier: {last.reps ?? '-'}×{last.load ?? '-'}kg
                      {last.entry_date ? ` (${formatDateFR(last.entry_date)})` : ''}
                    </Text>
                  ) : null}
                </View>
                {readOnly ? (
                  <Text style={styles.doneText}>
                    {done ? `${done.reps ?? '-'} reps · ${done.load ?? '-'}kg` : '—'}
                  </Text>
                ) : showInputs ? (
                  renderSeriesInputs(s.number, isEditingDone ? done : null)
                ) : done ? (
                  <View style={styles.doneRow}>
                    {isPR ? <Text style={styles.prBadge}>🏆 PR</Text> : null}
                    <Text style={styles.doneText}>{done.reps}×{done.load}kg</Text>
                    <Pressable onPress={() => startEditDone(done)} style={styles.editDoneBtn}>
                      <Text style={styles.editDoneText}>✎</Text>
                    </Pressable>
                    <Pressable onPress={() => handleDeleteDone(done)} style={styles.deleteDoneBtn}>
                      <Text style={styles.deleteDoneText}>✕</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
              {!readOnly && showInputs && noteOpenFor === s.number && (
                <Input
                  placeholder="Remarque (ex: douleur épaule, tempo lent...)"
                  value={current.note}
                  onChangeText={(t) => setValues((v) => ({
                    ...v,
                    [s.number]: { reps: v[s.number]?.reps ?? '', load: v[s.number]?.load ?? '', note: t },
                  }))}
                  style={styles.noteInput}
                />
              )}
              {done?.notes && !isEditingDone ? <Text style={styles.doneNote}>💬 {done.notes}</Text> : null}
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
  dateBadge: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginTop: spacing.sm, backgroundColor: colors.surfaceHi, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
  },
  dateBadgeText: { color: colors.text, fontWeight: '800', fontSize: fontSize.sm },
  dateBadgeChange: { color: colors.primary, fontWeight: '700', fontSize: fontSize.xs, textTransform: 'uppercase' },
  confirmTitle: { color: colors.text, fontSize: fontSize.xl, fontWeight: '900', marginBottom: spacing.sm },
  confirmHint: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20, marginBottom: spacing.lg },
  priorBox: {
    marginBottom: spacing.lg, backgroundColor: colors.backgroundAlt, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  priorTitle: {
    color: colors.gold, fontWeight: '800', fontSize: fontSize.xs, marginBottom: spacing.sm,
    letterSpacing: 0.4, textTransform: 'uppercase',
  },
  priorHint: { color: colors.success, fontSize: fontSize.xs, fontWeight: '700', marginTop: spacing.xs },
  priorHintMuted: { color: colors.textFaint, fontSize: fontSize.xs, fontWeight: '600', marginTop: spacing.xs },
  resumeBanner: {
    color: colors.success, fontSize: fontSize.sm, fontWeight: '700', marginTop: spacing.sm,
    lineHeight: 20,
  },
  datePickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  dateShiftBtn: {
    width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.surfaceHi,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
  dateShiftText: { color: colors.text, fontSize: 28, fontWeight: '700', marginTop: -2 },
  dateCenter: { alignItems: 'center', flex: 1 },
  dateBig: { color: colors.text, fontSize: fontSize.lg, fontWeight: '900', textTransform: 'capitalize' },
  dateIso: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: 2, fontWeight: '600' },
  quickDates: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  quickChip: {
    backgroundColor: colors.primarySoft, borderColor: colors.primary, borderWidth: 1,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill,
  },
  quickChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  quickChipText: { color: colors.primary, fontWeight: '800', fontSize: fontSize.sm },
  quickChipTextActive: { color: '#08240F' },
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
  historyBox: {
    marginTop: spacing.md, backgroundColor: colors.backgroundAlt, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  historyTitle: { color: colors.gold, fontWeight: '800', fontSize: fontSize.xs, marginBottom: spacing.sm, letterSpacing: 0.5 },
  historyLine: { color: colors.textMuted, fontSize: fontSize.xs, marginBottom: 4, lineHeight: 16 },
  historyDate: { color: colors.text, fontWeight: '700' },
  saveError: { color: colors.danger, fontSize: fontSize.sm, fontWeight: '700', marginTop: spacing.sm },
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
  seriesDesc: { color: colors.textMuted, fontSize: fontSize.sm },
  lastHint: { color: colors.textFaint, fontSize: 11, marginTop: 2, fontWeight: '600' },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  prBadge: { color: colors.gold, fontWeight: '800', fontSize: fontSize.xs },
  doneText: { color: colors.success, fontWeight: '800', fontSize: fontSize.sm },
  editDoneBtn: {
    marginLeft: spacing.xs, paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: colors.surfaceHi, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
  },
  editDoneText: { color: colors.textMuted, fontWeight: '800', fontSize: fontSize.sm },
  deleteDoneBtn: {
    marginLeft: 2, paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: 'rgba(220, 38, 38, 0.12)', borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.danger,
  },
  deleteDoneText: { color: colors.danger, fontWeight: '800', fontSize: fontSize.sm },
  cancelEditText: { color: colors.textMuted, fontSize: 16, fontWeight: '700' },
  finishHint: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '600', lineHeight: 20 },
  inputsRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
  smallInput: {
    width: 62, minHeight: 40, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs,
    textAlign: 'center', fontSize: fontSize.sm, fontWeight: '700',
  },
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

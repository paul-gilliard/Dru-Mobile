import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useAthleteScope } from '../../context/AthleteScopeContext';
import {
  activateProgram, createProgram, createSession, deleteProgram, deleteSession, duplicateProgram, getProgram,
  listAthletes, listPrograms, renameProgram, renameSession,
} from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { ProgramDTO, UserDTO } from '../../api/types';
import { Badge, Button, Card, EmptyState, ErrorView, InlineLoading, Input, LoadingView, SectionTitle } from '../../components/ui';
import { colors, fontSize, gradients, muscleColors, radius, spacing } from '../../theme';
import { AthleteStackParamList } from '../../navigation/types';
import { DAY_NAMES, DAY_NAMES_SHORT, jsWeekdayToBackend } from '../../utils/format';

type Nav = NativeStackNavigationProp<AthleteStackParamList, 'Program'>;

const TODAY_DOW = jsWeekdayToBackend(new Date().getDay());

export default function ProgramScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { athleteId, readOnly } = useAthleteScope();
  const isCoach = user?.role === 'coach';

  const [programs, setPrograms] = useState<ProgramDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newProgramName, setNewProgramName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await listPrograms(athleteId);
      setPrograms(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [athleteId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleCreateProgram = async () => {
    if (!newProgramName.trim()) return;
    setCreating(true);
    try {
      await createProgram({ name: newProgramName.trim(), athlete_id: athleteId });
      setNewProgramName('');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const runDeleteProgram = async (programId: number) => {
    try {
      await deleteProgram(programId);
      await load();
    } catch (err) {
      Alert.alert('Suppression impossible', apiErrorMessage(err));
    }
  };

  const handleDeleteProgram = (programId: number, programName: string) => {
    const message = `Supprimer définitivement « ${programName} » ?`;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(message)) {
        void runDeleteProgram(programId);
      }
      return;
    }
    Alert.alert('Supprimer le programme', message, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => { void runDeleteProgram(programId); } },
    ]);
  };

  const handleActivateProgram = async (programId: number) => {
    try {
      await activateProgram(programId);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  if (loading) return <LoadingView label="Chargement du programme..." />;
  if (error) return <ErrorView message={error} onRetry={load} />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      {isCoach && (
        <Card style={{ marginBottom: spacing.lg }}>
          <SectionTitle icon="➕">Nouveau programme</SectionTitle>
          <View style={styles.row}>
            <Input
              style={{ flex: 1 }}
              placeholder="Nom du programme"
              value={newProgramName}
              onChangeText={setNewProgramName}
            />
            <Button title="Créer" onPress={handleCreateProgram} loading={creating} disabled={!newProgramName.trim()} style={styles.createBtn} />
          </View>
        </Card>
      )}

      {!isCoach && programs.length > 1 ? (
        <Text style={styles.hintText}>
          Plie / déplie tes programmes et choisis celui affiché sur l’accueil.
        </Text>
      ) : null}

      {programs.length === 0 ? (
        <EmptyState icon="🏋️" title="Aucun programme assigné" subtitle={isCoach ? 'Crée un programme ci-dessus.' : "Ton coach n'a pas encore créé de programme."} />
      ) : (
        programs.map((program, index) => {
          const anyActive = programs.some((p) => p.is_active);
          return (
            <ProgramCard
              key={program.id}
              program={program}
              athleteId={athleteId}
              isCoach={isCoach}
              readOnly={readOnly}
              defaultExpanded={!!program.is_active || programs.length === 1 || (!anyActive && index === 0)}
              onPressSession={(sessionId) => navigation.navigate('SessionDetail', { sessionId, athleteId, readOnly })}
              onDeleteProgram={() => handleDeleteProgram(program.id, program.name)}
              onActivate={() => handleActivateProgram(program.id)}
              onChanged={load}
            />
          );
        })
      )}
    </ScrollView>
  );
}

function ProgramCard({
  program, athleteId, isCoach, readOnly, defaultExpanded, onPressSession, onDeleteProgram, onActivate, onChanged,
}: {
  program: ProgramDTO;
  athleteId: number;
  isCoach: boolean;
  readOnly: boolean;
  defaultExpanded: boolean;
  onPressSession: (sessionId: number) => void;
  onDeleteProgram: () => void;
  onActivate: () => void;
  onChanged: () => void;
}) {
  const [full, setFull] = useState<ProgramDTO>(program);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [addingSession, setAddingSession] = useState(false);
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(program.name);
  const [busy, setBusy] = useState(false);
  const [activating, setActivating] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [sessionNameDraft, setSessionNameDraft] = useState('');
  const [recapOpen, setRecapOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(() => !Array.isArray(program.sessions));
  const detailsReadyRef = useRef(Array.isArray(program.sessions));

  const isActive = !!full.is_active;
  const detailsReady = Array.isArray(full.sessions);

  useEffect(() => {
    setFull(program);
    if (!Array.isArray(program.sessions) && !detailsReadyRef.current) {
      setDetailLoading(true);
    }
  }, [program]);

  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);

  useEffect(() => {
    detailsReadyRef.current = Array.isArray(full.sessions);
  }, [full.sessions]);

  const refresh = useCallback(async () => {
    const needsSpinner = !detailsReadyRef.current;
    if (needsSpinner) setDetailLoading(true);
    try {
      const detailed = await getProgram(program.id, { force: needsSpinner });
      setFull(detailed);
      detailsReadyRef.current = true;
    } catch {
      // silencieux : on garde les données déjà connues
    } finally {
      setDetailLoading(false);
    }
  }, [program.id]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const usedDays = new Set((full.sessions ?? []).map((s) => s.day_of_week));
  const sortedSessions = [...(full.sessions ?? [])].sort((a, b) => a.day_of_week - b.day_of_week);
  const totalExercises = sortedSessions.reduce((acc, s) => acc + s.exercises.length, 0);
  const totalSeries = sortedSessions.reduce(
    (acc, s) => acc + s.exercises.reduce((a2, ex) => a2 + (ex.series.length || ex.sets || 3), 0), 0,
  );

  const handleAddDay = async (day: number) => {
    setSavingDay(day);
    try {
      await createSession(program.id, { day_of_week: day });
      await refresh();
      setAddingSession(false);
    } catch {
      // ignore
    } finally {
      setSavingDay(null);
    }
  };

  const handleRenameProgram = async () => {
    if (!nameDraft.trim() || nameDraft.trim() === full.name) { setRenaming(false); return; }
    setBusy(true);
    try {
      await renameProgram(program.id, nameDraft.trim());
      await refresh();
    } finally {
      setBusy(false);
      setRenaming(false);
    }
  };

  const handleActivate = async () => {
    if (isActive) return;
    setActivating(true);
    try {
      await onActivate();
      setExpanded(true);
    } finally {
      setActivating(false);
    }
  };

  const handleRenameSession = async (sessionId: number) => {
    if (sessionNameDraft.trim()) {
      await renameSession(sessionId, sessionNameDraft.trim());
      await refresh();
    }
    setEditingSessionId(null);
  };

  const handleDeleteSession = async (sessionId: number) => {
    await deleteSession(sessionId);
    await refresh();
  };

  return (
    <Card style={[{ marginBottom: spacing.lg }, isActive && styles.activeCard]}>
      <View style={styles.cardHeader}>
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          style={styles.cardHeaderMain}
        >
          <Text style={styles.chevronToggle}>{expanded ? '▼' : '▶'}</Text>
          {renaming ? (
            <Input style={{ flex: 1 }} value={nameDraft} onChangeText={setNameDraft} autoFocus onSubmitEditing={handleRenameProgram} />
          ) : (
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <SectionTitle style={{ marginBottom: 0 }} icon="🏋️">{full.name}</SectionTitle>
                {isActive ? <Badge label="ACTUELLE" color={colors.success} /> : null}
              </View>
              <Text style={styles.collapsedMeta}>
                {detailLoading && !detailsReady
                  ? 'Chargement des séances…'
                  : `${sortedSessions.length} séance${sortedSessions.length > 1 ? 's' : ''}${totalExercises > 0 ? ` · ${totalExercises} exercices` : ''}${!expanded ? ' · appuyer pour déplier' : ''}`}
              </Text>
            </View>
          )}
        </Pressable>
        {!renaming && (
          <View style={styles.headerActions}>
            <Button title="Récap" variant="accent" onPress={() => setRecapOpen(true)} style={styles.smallBtn} />
            {isCoach && (
              <>
                <Button title="Dupl." variant="secondary" onPress={() => setDupOpen(true)} style={styles.smallBtn} />
                <Button title="Suppr." variant="danger" onPress={onDeleteProgram} style={styles.smallBtn} />
              </>
            )}
          </View>
        )}
        {renaming && <Button title="OK" onPress={handleRenameProgram} loading={busy} style={styles.smallBtn} />}
      </View>

      {(!readOnly || isCoach) && !isActive ? (
        <Button
          title="★ Définir comme actuelle"
          variant="secondary"
          onPress={handleActivate}
          loading={activating}
          style={{ marginBottom: expanded ? spacing.md : 0 }}
        />
      ) : null}

      {isCoach && !renaming ? (
        <Pressable onPress={() => setRenaming(true)} style={{ marginBottom: expanded ? spacing.sm : 0 }}>
          <Text style={styles.renameHint}>✎ Renommer le programme</Text>
        </Pressable>
      ) : null}

      <RecapModal visible={recapOpen} onClose={() => setRecapOpen(false)} programName={full.name} sessions={sortedSessions} />
      <DuplicateProgramModal
        visible={dupOpen}
        sourceName={full.name}
        sourceAthleteId={full.athlete_id || athleteId}
        programId={program.id}
        onClose={() => setDupOpen(false)}
        onDone={(targetAthleteId) => {
          setDupOpen(false);
          if (targetAthleteId === athleteId) onChanged();
          else Alert.alert('Programme dupliqué', 'La copie a été créée pour l’athlète choisi.');
        }}
      />

      {!expanded ? null : detailLoading && !detailsReady ? (
        <InlineLoading label="Chargement des exercices…" />
      ) : expanded ? (
        <>
          {(full.sessions ?? []).length > 0 && (
            <View style={styles.statsRow}>
              <StatPill value={totalExercises} label="Exercices" />
              <StatPill value={totalSeries} label="Séries" />
              <StatPill value={sortedSessions.length} label="Séances/sem." />
            </View>
          )}

          {(full.sessions ?? []).length === 0 ? (
            <Text style={styles.mutedText}>Aucune séance dans ce programme.</Text>
          ) : (
            (full.sessions ?? []).map((session) => {
              const isToday = session.day_of_week === TODAY_DOW;
              const isEditing = editingSessionId === session.id;
              return (
                <View key={session.id} style={[styles.sessionRow, isToday && styles.sessionRowToday]}>
                  <View style={[styles.dayBar, isToday && styles.dayBarToday]} />
                  <Pressable style={{ flex: 1 }} onPress={() => !isEditing && onPressSession(session.id)}>
                    <View style={styles.dayLabelRow}>
                      <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{DAY_NAMES[session.day_of_week]}</Text>
                      {isToday && <Badge label="AUJOURD'HUI" color={colors.primary} />}
                    </View>
                    {isEditing ? (
                      <Input
                        value={sessionNameDraft}
                        onChangeText={setSessionNameDraft}
                        autoFocus
                        onSubmitEditing={() => handleRenameSession(session.id)}
                        style={{ marginTop: spacing.xs }}
                      />
                    ) : (
                      <Text style={styles.sessionName}>{session.session_name}</Text>
                    )}
                    <View style={styles.chipRow}>
                      {session.exercises.map((ex) => (
                        <Badge key={ex.id} label={ex.name} color={muscleColors[ex.muscle ?? ''] ?? colors.primary} />
                      ))}
                      {session.exercises.length === 0 ? <Text style={styles.emptySession}>Aucun exercice — appuyer pour ajouter</Text> : null}
                    </View>
                  </Pressable>
                  {isCoach ? (
                    isEditing ? (
                      <Button title="OK" onPress={() => handleRenameSession(session.id)} style={styles.smallBtn} />
                    ) : (
                      <View style={styles.sessionActions}>
                        <Pressable onPress={() => { setSessionNameDraft(session.session_name ?? ''); setEditingSessionId(session.id); }}>
                          <Text style={styles.sessionActionIcon}>✎</Text>
                        </Pressable>
                        <Pressable onPress={() => handleDeleteSession(session.id)}>
                          <Text style={styles.sessionActionIcon}>🗑️</Text>
                        </Pressable>
                      </View>
                    )
                  ) : session.exercises.length > 0 ? (
                    <Pressable onPress={() => onPressSession(session.id)} style={styles.startBtnWrap}>
                      <LinearGradient
                        colors={isToday ? gradients.primary : [colors.surfaceHi, colors.surfaceHi]}
                        style={styles.startBtn}
                      >
                        <Text style={[styles.startBtnText, !isToday && { color: colors.text }]}>
                          {isToday ? '🔥 Attaquer' : 'Attaquer ›'}
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  ) : (
                    <Text style={styles.chevron}>›</Text>
                  )}
                </View>
              );
            })
          )}

          {isCoach && (
            addingSession ? (
              <View style={styles.dayPicker}>
                {DAY_NAMES_SHORT.map((label, day) => (
                  <Pressable
                    key={day}
                    onPress={() => !usedDays.has(day) && handleAddDay(day)}
                    disabled={usedDays.has(day)}
                    style={[styles.dayChip, usedDays.has(day) && styles.dayChipDisabled]}
                  >
                    <Text style={styles.dayChipText}>{savingDay === day ? '…' : label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Button title="+ Ajouter une séance" variant="secondary" onPress={() => setAddingSession(true)} style={{ marginTop: spacing.md }} />
            )
          )}
        </>
      ) : null}
    </Card>
  );
}

function StatPill({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statPillValue}>{value}</Text>
      <Text style={styles.statPillLabel}>{label}</Text>
    </View>
  );
}

function DuplicateProgramModal({
  visible, onClose, onDone, programId, sourceName, sourceAthleteId,
}: {
  visible: boolean;
  onClose: () => void;
  onDone: (athleteId: number) => void;
  programId: number;
  sourceName: string;
  sourceAthleteId: number;
}) {
  const [name, setName] = useState(`${sourceName} (copie)`);
  const [athletes, setAthletes] = useState<UserDTO[]>([]);
  const [athleteId, setAthleteId] = useState(sourceAthleteId);
  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(`${sourceName} (copie)`);
    setAthleteId(sourceAthleteId);
    setError(null);
    setLoadingAthletes(true);
    listAthletes()
      .then((list) => {
        setAthletes(list);
        if (!list.some((a) => a.id === sourceAthleteId) && list[0]) {
          setAthleteId(list[0].id);
        }
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoadingAthletes(false));
  }, [visible, sourceName, sourceAthleteId]);

  const handleConfirm = async () => {
    if (!name.trim()) {
      setError('Donne un nom au nouveau programme.');
      return;
    }
    if (!athleteId) {
      setError('Choisis un athlète.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await duplicateProgram(programId, { name: name.trim(), athlete_id: athleteId });
      onDone(athleteId);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Dupliquer le programme</Text>
          <Text style={styles.dupHint}>Choisis le nom et l’athlète de destination.</Text>

          <Text style={styles.fieldLabel}>Nom du nouveau programme</Text>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="Ex: Programme (copie)"
            autoFocus
          />

          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Athlète</Text>
          {loadingAthletes ? (
            <InlineLoading label="Chargement des athlètes…" />
          ) : (
            <ScrollView style={styles.athleteList} nestedScrollEnabled>
              {athletes.map((a) => {
                const selected = a.id === athleteId;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => setAthleteId(a.id)}
                    style={[styles.athleteRow, selected && styles.athleteRowOn]}
                  >
                    <Text style={[styles.athleteName, selected && styles.athleteNameOn]}>
                      {a.display_name || a.username}
                    </Text>
                    <Text style={styles.athleteCheck}>{selected ? '✓' : ''}</Text>
                  </Pressable>
                );
              })}
              {athletes.length === 0 ? (
                <Text style={styles.mutedText}>Aucun athlète trouvé.</Text>
              ) : null}
            </ScrollView>
          )}

          {error ? <Text style={styles.dupError}>{error}</Text> : null}

          <View style={styles.dupActions}>
            <Button title="Annuler" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Button
              title="Dupliquer"
              onPress={handleConfirm}
              loading={saving}
              disabled={!name.trim() || !athleteId || saving}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function RecapModal({
  visible, onClose, programName, sessions,
}: { visible: boolean; onClose: () => void; programName: string; sessions: import('../../api/types').ProgramSessionDTO[] }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <ScrollView>
            <Text style={styles.modalTitle}>📋 Récapitulatif — {programName}</Text>
            {sessions.length === 0 ? (
              <Text style={styles.mutedText}>Aucune séance.</Text>
            ) : (
              sessions.map((session) => (
                <View key={session.id} style={{ marginBottom: spacing.md }}>
                  <Text style={styles.modalDay}>{DAY_NAMES[session.day_of_week]}{session.session_name ? ` — ${session.session_name}` : ''}</Text>
                  {session.exercises.length === 0 ? (
                    <Text style={styles.modalEmptyDay}>Repos / aucun exercice</Text>
                  ) : (
                    session.exercises.map((ex) => (
                      <Text key={ex.id} style={styles.modalExerciseLine}>
                        • {ex.name} <Text style={styles.modalMuscle}>({ex.muscle ?? '-'})</Text> {ex.sets ?? ex.series.length ?? 3}S
                      </Text>
                    ))
                  )}
                </View>
              ))
            )}
          </ScrollView>
          <Button title="Fermer" onPress={onClose} style={{ marginTop: spacing.md }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  hintText: {
    color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '600',
    marginBottom: spacing.md, lineHeight: 20,
  },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  createBtn: { paddingHorizontal: spacing.lg },
  activeCard: { borderColor: colors.success, borderWidth: 1.5 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs, gap: spacing.xs },
  cardHeaderMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  chevronToggle: { color: colors.textMuted, fontSize: 12, fontWeight: '900', width: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  collapsedMeta: { color: colors.textFaint, fontSize: fontSize.xs, fontWeight: '600', marginTop: 2 },
  renameHint: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: spacing.xs, flexShrink: 0 },
  smallBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  sessionActions: { flexDirection: 'row', gap: spacing.sm, paddingLeft: spacing.xs },
  sessionActionIcon: { fontSize: 16, padding: spacing.xs },
  sessionRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.md,
  },
  sessionRowToday: { backgroundColor: colors.primarySoft, marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg, borderTopColor: 'transparent' },
  dayBar: { width: 3, height: '100%', borderRadius: 2, backgroundColor: 'transparent' },
  dayBarToday: { backgroundColor: colors.primary },
  dayLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  dayLabel: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  dayLabelToday: { color: colors.primary },
  sessionName: { color: colors.text, fontSize: fontSize.md, fontWeight: '700', marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chevron: { color: colors.textFaint, fontSize: 24 },
  startBtnWrap: { marginLeft: spacing.xs },
  startBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill },
  startBtnText: { color: '#fff', fontWeight: '800', fontSize: fontSize.xs },
  mutedText: { color: colors.textMuted },
  emptySession: { color: colors.textFaint, fontSize: fontSize.xs, fontStyle: 'italic' },
  dayPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  dayChip: {
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  dayChipDisabled: { backgroundColor: colors.surfaceAlt, opacity: 0.4 },
  dayChipText: { color: '#fff', fontWeight: '700', fontSize: fontSize.sm },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statPill: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingVertical: spacing.sm, alignItems: 'center', backgroundColor: colors.surfaceAlt,
  },
  statPillValue: { color: colors.primary, fontWeight: '900', fontSize: fontSize.lg },
  statPillLabel: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.lg },
  modalCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, maxHeight: '80%', borderWidth: 1, borderColor: colors.border,
  },
  modalTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '900', marginBottom: spacing.md },
  modalDay: { color: colors.primary, fontWeight: '800', fontSize: fontSize.sm, marginBottom: spacing.xs, textTransform: 'uppercase' },
  modalEmptyDay: { color: colors.textFaint, fontSize: fontSize.xs, fontStyle: 'italic' },
  modalExerciseLine: { color: colors.textMuted, fontSize: fontSize.sm, marginBottom: 2 },
  modalMuscle: { color: colors.textFaint, fontSize: fontSize.xs },
  dupHint: { color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.md, marginTop: -spacing.sm },
  fieldLabel: { color: colors.textFaint, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6 },
  athleteList: { maxHeight: 220, marginBottom: spacing.sm },
  athleteRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs, backgroundColor: colors.surfaceAlt,
  },
  athleteRowOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  athleteName: { color: colors.textMuted, fontWeight: '700', fontSize: fontSize.sm, flex: 1 },
  athleteNameOn: { color: colors.text },
  athleteCheck: { color: colors.primary, fontWeight: '900', fontSize: 16, width: 20, textAlign: 'right' },
  dupError: { color: colors.danger, fontWeight: '700', marginBottom: spacing.sm },
  dupActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});

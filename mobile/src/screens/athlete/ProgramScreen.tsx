import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useAthleteScope } from '../../context/AthleteScopeContext';
import { createProgram, createSession, deleteProgram, getProgram, listPrograms } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { ProgramDTO } from '../../api/types';
import { Badge, Button, Card, EmptyState, ErrorView, Input, LoadingView, SectionTitle } from '../../components/ui';
import { colors, fontSize, muscleColors, radius, spacing } from '../../theme';
import { AthleteStackParamList } from '../../navigation/types';
import { DAY_NAMES, DAY_NAMES_SHORT } from '../../utils/format';

type Nav = NativeStackNavigationProp<AthleteStackParamList, 'Program'>;

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

  const handleDeleteProgram = async (programId: number) => {
    try {
      await deleteProgram(programId);
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
          <SectionTitle>Nouveau programme</SectionTitle>
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

      {programs.length === 0 ? (
        <EmptyState title="Aucun programme assigné" subtitle={isCoach ? 'Crée un programme ci-dessus.' : "Ton coach n'a pas encore créé de programme."} />
      ) : (
        programs.map((program) => (
          <ProgramCard
            key={program.id}
            program={program}
            isCoach={isCoach}
            onPressSession={(sessionId) => navigation.navigate('SessionDetail', { sessionId, athleteId, readOnly })}
            onDeleteProgram={() => handleDeleteProgram(program.id)}
          />
        ))
      )}
    </ScrollView>
  );
}

function ProgramCard({
  program, isCoach, onPressSession, onDeleteProgram,
}: {
  program: ProgramDTO; isCoach: boolean; onPressSession: (sessionId: number) => void; onDeleteProgram: () => void;
}) {
  const [full, setFull] = useState<ProgramDTO>(program);
  const [addingSession, setAddingSession] = useState(false);
  const [savingDay, setSavingDay] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const detailed = await getProgram(program.id);
      setFull(detailed);
    } catch {
      // silencieux : on garde les données déjà connues
    }
  }, [program.id]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const usedDays = new Set((full.sessions ?? []).map((s) => s.day_of_week));

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

  return (
    <Card style={{ marginBottom: spacing.lg }}>
      <View style={styles.cardHeader}>
        <SectionTitle style={{ marginBottom: 0, flex: 1 }}>{full.name}</SectionTitle>
        {isCoach && <Button title="Suppr." variant="danger" onPress={onDeleteProgram} style={styles.smallBtn} />}
      </View>

      {(full.sessions ?? []).length === 0 ? (
        <Text style={styles.mutedText}>Aucune séance dans ce programme.</Text>
      ) : (
        (full.sessions ?? []).map((session) => (
          <View key={session.id} style={styles.sessionRow} onTouchEnd={() => onPressSession(session.id)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dayLabel}>{DAY_NAMES[session.day_of_week]}</Text>
              <Text style={styles.sessionName}>{session.session_name}</Text>
              <View style={styles.chipRow}>
                {session.exercises.slice(0, 4).map((ex) => (
                  <Badge key={ex.id} label={ex.name} color={muscleColors[ex.muscle ?? ''] ?? colors.primary} />
                ))}
                {session.exercises.length > 4 ? <Badge label={`+${session.exercises.length - 4}`} color={colors.textMuted} /> : null}
                {session.exercises.length === 0 ? <Text style={styles.emptySession}>Aucun exercice — appuyer pour ajouter</Text> : null}
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </View>
        ))
      )}

      {isCoach && (
        addingSession ? (
          <View style={styles.dayPicker}>
            {DAY_NAMES_SHORT.map((label, day) => (
              <View
                key={day}
                onTouchEnd={() => !usedDays.has(day) && handleAddDay(day)}
                style={[styles.dayChip, usedDays.has(day) && styles.dayChipDisabled]}
              >
                <Text style={styles.dayChipText}>{savingDay === day ? '…' : label}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Button title="+ Ajouter une séance" variant="secondary" onPress={() => setAddingSession(true)} style={{ marginTop: spacing.md }} />
        )
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  createBtn: { paddingHorizontal: spacing.lg },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  smallBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  sessionRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  dayLabel: { color: colors.primary, fontSize: fontSize.xs, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  sessionName: { color: colors.text, fontSize: fontSize.md, fontWeight: '600', marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chevron: { color: colors.textFaint, fontSize: 24 },
  mutedText: { color: colors.textMuted },
  emptySession: { color: colors.textFaint, fontSize: fontSize.xs, fontStyle: 'italic' },
  dayPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  dayChip: {
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  dayChipDisabled: { backgroundColor: colors.surfaceAlt, opacity: 0.4 },
  dayChipText: { color: '#fff', fontWeight: '600', fontSize: fontSize.sm },
});

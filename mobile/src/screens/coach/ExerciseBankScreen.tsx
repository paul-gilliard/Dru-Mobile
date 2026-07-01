import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { createExerciseBank, deleteExerciseBank, listExerciseBank } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { ExerciseBankDTO } from '../../api/types';
import { Badge, Button, Card, EmptyState, ErrorView, Input, LoadingView, SectionTitle } from '../../components/ui';
import { colors, fontSize, muscleColors, spacing } from '../../theme';

export default function ExerciseBankScreen() {
  const [exercises, setExercises] = useState<ExerciseBankDTO[]>([]);
  const [muscleGroups, setMuscleGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await listExerciseBank();
      setExercises(data.exercises);
      setMuscleGroups(data.muscle_groups);
      if (!muscle && data.muscle_groups.length) setMuscle(data.muscle_groups[0]);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleCreate = async () => {
    if (!name.trim() || !muscle) return;
    setSaving(true);
    try {
      await createExerciseBank({ name: name.trim(), muscle_group: muscle });
      setName('');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteExerciseBank(id);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  if (loading) return <LoadingView label="Chargement des exercices..." />;
  if (error) return <ErrorView message={error} onRetry={load} />;

  const byMuscle = new Map<string, ExerciseBankDTO[]>();
  for (const ex of exercises) {
    if (!byMuscle.has(ex.muscle_group)) byMuscle.set(ex.muscle_group, []);
    byMuscle.get(ex.muscle_group)!.push(ex);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      <Card style={{ marginBottom: spacing.lg }}>
        <SectionTitle icon="🏋️">Nouvel exercice</SectionTitle>
        <Input placeholder="Nom de l'exercice" value={name} onChangeText={setName} />
        <View style={styles.muscleRow}>
          {muscleGroups.map((mg) => (
            <Pressable key={mg} onPress={() => setMuscle(mg)}>
              <Badge label={mg} color={muscle === mg ? (muscleColors[mg] ?? colors.primary) : colors.textFaint} />
            </Pressable>
          ))}
        </View>
        <Button title="Ajouter" onPress={handleCreate} loading={saving} disabled={!name.trim()} style={{ marginTop: spacing.md }} />
      </Card>

      {exercises.length === 0 ? (
        <EmptyState icon="🏋️" title="Aucun exercice dans la banque" />
      ) : (
        Array.from(byMuscle.entries()).map(([mg, list]) => (
          <View key={mg} style={{ marginBottom: spacing.lg }}>
            <View style={styles.muscleTitleRow}>
              <View style={[styles.muscleDot, { backgroundColor: muscleColors[mg] ?? colors.primary }]} />
              <Text style={[styles.muscleTitle, { color: muscleColors[mg] ?? colors.text }]}>{mg}</Text>
            </View>
            {list.map((ex) => (
              <Card key={ex.id} style={styles.exerciseRow}>
                <Text style={styles.exerciseName}>{ex.name}</Text>
                <Button title="✕" variant="ghost" onPress={() => handleDelete(ex.id)} style={styles.deleteBtn} />
              </Card>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  muscleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  muscleTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  muscleDot: { width: 8, height: 8, borderRadius: 4 },
  muscleTitle: { fontWeight: '800', fontSize: fontSize.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, paddingVertical: spacing.sm },
  exerciseName: { color: colors.text, flex: 1, fontWeight: '600' },
  deleteBtn: { paddingVertical: 4, paddingHorizontal: spacing.sm },
});

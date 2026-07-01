import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAthleteScope } from '../../context/AthleteScopeContext';
import { listPerformance } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { PerformanceEntryDTO } from '../../api/types';
import { Card, EmptyState, ErrorView, LoadingView, SectionTitle } from '../../components/ui';
import { colors, fontSize, spacing } from '../../theme';
import { formatDateFR } from '../../utils/format';

export default function PerformanceScreen() {
  const { athleteId } = useAthleteScope();

  const [entries, setEntries] = useState<PerformanceEntryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await listPerformance({ athlete_id: athleteId });
      setEntries(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [athleteId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <LoadingView label="Chargement des performances..." />;
  if (error) return <ErrorView message={error} onRetry={load} />;

  const grouped = groupByDateAndExercise(entries);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      {grouped.length === 0 ? (
        <EmptyState icon="📈" title="Aucune performance enregistrée" subtitle="Log tes séries depuis l'écran d'une séance." />
      ) : (
        grouped.map(({ date, exercises }) => (
          <Card key={date} style={{ marginBottom: spacing.lg }}>
            <SectionTitle icon="📅">{formatDateFR(date)}</SectionTitle>
            {exercises.map(({ exercise, series }) => {
              const bestLoad = series.reduce((max, s) => (s.load && s.load > max ? s.load : max), 0);
              return (
                <View key={exercise} style={styles.exerciseBlock}>
                  <Text style={styles.exerciseName}>🏋️ {exercise}</Text>
                  <View style={styles.seriesRow}>
                    {series.map((s) => {
                      const isBest = !!s.load && s.load === bestLoad && bestLoad > 0;
                      return (
                        <View key={s.id} style={[styles.seriesChip, isBest && styles.seriesChipBest]}>
                          <Text style={[styles.seriesText, isBest && styles.seriesTextBest]}>
                            S{s.series_number ?? '-'} · {s.reps ?? '-'}×{s.load ?? '-'}kg{s.rpe ? ` · RPE${s.rpe}` : ''}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </Card>
        ))
      )}
    </ScrollView>
  );
}

function groupByDateAndExercise(entries: PerformanceEntryDTO[]) {
  const byDate = new Map<string, Map<string, PerformanceEntryDTO[]>>();
  for (const e of entries) {
    if (!byDate.has(e.entry_date)) byDate.set(e.entry_date, new Map());
    const byExercise = byDate.get(e.entry_date)!;
    if (!byExercise.has(e.exercise)) byExercise.set(e.exercise, []);
    byExercise.get(e.exercise)!.push(e);
  }
  return Array.from(byDate.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, byExercise]) => ({
      date,
      exercises: Array.from(byExercise.entries()).map(([exercise, series]) => ({
        exercise,
        series: series.sort((a, b) => (a.series_number ?? 0) - (b.series_number ?? 0)),
      })),
    }));
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  exerciseBlock: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  exerciseName: { color: colors.text, fontWeight: '800', marginBottom: spacing.sm },
  seriesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  seriesChip: { backgroundColor: colors.surfaceAlt, borderRadius: 10, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  seriesChipBest: { backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: colors.gold },
  seriesText: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '700' },
  seriesTextBest: { color: colors.gold },
});

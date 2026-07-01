import React, { useCallback, useState } from 'react';
import { Dimensions, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BarChart, LineChart } from 'react-native-chart-kit';
import { useAthleteScope } from '../../context/AthleteScopeContext';
import { getJournalTrend, getTonnageByMuscle } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { JournalTrendDTO, TonnageByMuscleDTO } from '../../api/types';
import { Card, EmptyState, ErrorView, LoadingView, SectionTitle } from '../../components/ui';
import { colors, fontSize, muscleColors, spacing } from '../../theme';

const screenWidth = Dimensions.get('window').width - spacing.lg * 2 - spacing.lg * 2;

const chartConfig = {
  backgroundGradientFrom: colors.surface,
  backgroundGradientTo: colors.surface,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(79, 140, 255, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(154, 163, 178, ${opacity})`,
  propsForBackgroundLines: { stroke: colors.border },
  barPercentage: 0.6,
};

export default function StatsScreen() {
  const { athleteId } = useAthleteScope();

  const [tonnage, setTonnage] = useState<TonnageByMuscleDTO | null>(null);
  const [journalTrend, setJournalTrend] = useState<JournalTrendDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [t, j] = await Promise.all([
        getTonnageByMuscle(athleteId, 30),
        getJournalTrend(athleteId, 30),
      ]);
      setTonnage(t);
      setJournalTrend(j);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [athleteId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <LoadingView label="Chargement des statistiques..." />;
  if (error) return <ErrorView message={error} onRetry={load} />;

  const weightPoints = journalTrend.filter((j) => j.weight != null);
  const hasTonnage = (tonnage?.by_muscle.length ?? 0) > 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      <Card style={{ marginBottom: spacing.lg }}>
        <SectionTitle>Tonnage par muscle (30j)</SectionTitle>
        {hasTonnage ? (
          <BarChart
            data={{
              labels: tonnage!.by_muscle.slice(0, 6).map((m) => m.muscle.slice(0, 4)),
              datasets: [{ data: tonnage!.by_muscle.slice(0, 6).map((m) => Math.round(m.tonnage)) }],
            }}
            width={screenWidth}
            height={200}
            fromZero
            chartConfig={chartConfig}
            style={styles.chart}
            yAxisLabel=""
            yAxisSuffix="kg"
          />
        ) : (
          <EmptyState title="Pas encore de données" subtitle="Log des séries pour voir le tonnage apparaître ici." />
        )}
        {hasTonnage && (
          <View style={styles.legendRow}>
            {tonnage!.by_muscle.map((m) => (
              <View key={m.muscle} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: muscleColors[m.muscle] ?? colors.primary }]} />
                <Text style={styles.legendText}>{m.muscle} · {Math.round(m.tonnage)}kg</Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card style={{ marginBottom: spacing.lg }}>
        <SectionTitle>Évolution du poids (30j)</SectionTitle>
        {weightPoints.length >= 2 ? (
          <LineChart
            data={{
              labels: weightPoints.map((j) => j.date.slice(5)),
              datasets: [{ data: weightPoints.map((j) => j.weight as number) }],
            }}
            width={screenWidth}
            height={200}
            chartConfig={chartConfig}
            style={styles.chart}
            bezier
            withDots={weightPoints.length <= 15}
            yAxisSuffix="kg"
          />
        ) : (
          <EmptyState title="Pas assez de données" subtitle="Complète le journal quotidien pour voir la courbe de poids." />
        )}
      </Card>

      {tonnage && tonnage.trend.length >= 2 && (
        <Card>
          <SectionTitle>Tonnage total / séance</SectionTitle>
          <LineChart
            data={{
              labels: tonnage.trend.map((t) => t.date.slice(5)),
              datasets: [{ data: tonnage.trend.map((t) => Math.round(t.tonnage)) }],
            }}
            width={screenWidth}
            height={200}
            chartConfig={chartConfig}
            style={styles.chart}
            bezier
            yAxisSuffix="kg"
          />
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  chart: { marginTop: spacing.sm, borderRadius: 14 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.textMuted, fontSize: fontSize.xs },
});

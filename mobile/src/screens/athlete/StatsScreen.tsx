import React, { useCallback, useState } from 'react';
import { Dimensions, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BarChart, LineChart } from 'react-native-chart-kit';
import { useAthleteScope } from '../../context/AthleteScopeContext';
import { getJournalTrend, getTonnageByMuscle } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { JournalTrendDTO, TonnageByMuscleDTO } from '../../api/types';
import { Card, EmptyState, ErrorView, LoadingView, SectionTitle, StatBlock } from '../../components/ui';
import { colors, fontSize, muscleColors, spacing } from '../../theme';

const screenWidth = Dimensions.get('window').width - spacing.lg * 2 - spacing.lg * 2;

const chartConfig = {
  backgroundGradientFrom: colors.surface,
  backgroundGradientTo: colors.surface,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(255, 75, 38, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(156, 158, 168, ${opacity})`,
  propsForBackgroundLines: { stroke: colors.border, strokeDasharray: '' },
  barPercentage: 0.55,
  fillShadowGradient: colors.primary,
  fillShadowGradientOpacity: 1,
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
  const totalTonnage = tonnage?.by_muscle.reduce((acc, m) => acc + m.tonnage, 0) ?? 0;
  const topMuscle = tonnage?.by_muscle[0];
  const weightDelta = weightPoints.length >= 2
    ? (weightPoints[weightPoints.length - 1].weight as number) - (weightPoints[0].weight as number)
    : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      <View style={styles.summaryRow}>
        <Card style={styles.summaryCard}>
          <StatBlock value={Math.round(totalTonnage).toLocaleString('fr-FR')} unit="kg" label="Tonnage 30j" color={colors.primary} />
        </Card>
        <Card style={styles.summaryCard}>
          <StatBlock
            value={weightDelta != null ? `${weightDelta > 0 ? '+' : ''}${weightDelta.toFixed(1)}` : '—'}
            unit="kg"
            label="Poids (30j)"
            color={weightDelta != null && weightDelta < 0 ? colors.success : colors.gold}
          />
        </Card>
      </View>

      <Card style={{ marginBottom: spacing.lg }}>
        <View style={styles.cardHeaderRow}>
          <SectionTitle icon="🔥" style={{ marginBottom: 0 }}>Tonnage par muscle</SectionTitle>
          {topMuscle ? <Text style={styles.topMuscleTag}>👑 {topMuscle.muscle}</Text> : null}
        </View>
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
          <EmptyState icon="📊" title="Pas encore de données" subtitle="Log des séries pour voir le tonnage apparaître ici." />
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
        <SectionTitle icon="⚖️">Évolution du poids</SectionTitle>
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
          <EmptyState icon="⚖️" title="Pas assez de données" subtitle="Complète le journal quotidien pour voir la courbe de poids." />
        )}
      </Card>

      {tonnage && tonnage.trend.length >= 2 && (
        <Card style={{ marginBottom: spacing.lg }}>
          <SectionTitle icon="📈">Tonnage total / séance</SectionTitle>
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
  summaryRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  summaryCard: { flex: 1, alignItems: 'center', paddingVertical: spacing.lg },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  topMuscleTag: { color: colors.gold, fontWeight: '800', fontSize: fontSize.xs },
  chart: { marginTop: spacing.sm, borderRadius: 14 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600' },
});

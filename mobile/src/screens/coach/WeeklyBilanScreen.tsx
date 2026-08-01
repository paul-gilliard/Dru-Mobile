import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { getWeeklyBilan, markWeeklyBilan, unmarkWeeklyBilan } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { WeeklyBilanEntryDTO } from '../../api/types';
import { Badge, Card, EmptyState, ErrorView, LoadingView, SectionTitle } from '../../components/ui';
import AttentionPanel from '../../components/AttentionPanel';
import WeeklyComparisonCard from '../../components/WeeklyComparisonCard';
import RemarksList from '../../components/RemarksList';
import { colors, fontSize, gradients, radius, spacing } from '../../theme';

export default function WeeklyBilanScreen() {
  const [entries, setEntries] = useState<WeeklyBilanEntryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setEntries(await getWeeklyBilan());
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleToggle = async (entry: WeeklyBilanEntryDTO) => {
    setEntries((prev) => prev.map((e) => (e.athlete.id === entry.athlete.id ? { ...e, done: !e.done } : e)));
    try {
      if (entry.done) await unmarkWeeklyBilan(entry.athlete.id, entry.week_start);
      else await markWeeklyBilan(entry.athlete.id, entry.week_start);
    } catch {
      await load();
    }
  };

  if (loading) return <LoadingView label="Chargement du bilan hebdo..." />;
  if (error) return <ErrorView message={error} onRetry={load} />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      <Text style={styles.pageTitle}>📈 Easy Bilan Hebdo</Text>
      <Text style={styles.pageSubtitle}>Synthèse semaine actuelle vs précédente, par athlète</Text>

      {entries.length === 0 ? (
        <EmptyState icon="📈" title="Aucun athlète à afficher" />
      ) : (
        entries.map((entry) => <AthleteBilanCard key={entry.athlete.id} entry={entry} onToggle={() => handleToggle(entry)} />)
      )}
    </ScrollView>
  );
}

function AthleteBilanCard({ entry, onToggle }: { entry: WeeklyBilanEntryDTO; onToggle: () => void }) {
  const [expanded, setExpanded] = useState(!entry.done);
  const [weeks, setWeeks] = useState<{ a: number; b: number }>({ a: 0, b: 1 });

  const handleWeeksChange = useCallback((a: number, b: number) => {
    setWeeks((prev) => (prev.a === a && prev.b === b ? prev : { a, b }));
  }, []);

  return (
    <Card style={{ marginBottom: spacing.lg }} glow={!entry.done}>
      <Pressable onPress={() => setExpanded((e) => !e)} style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.athleteName}>{entry.athlete.display_name}</Text>
          <Text style={styles.weekLabel}>Semaine du {entry.week_start} · {expanded ? 'Replier ▴' : 'Déplier ▾'}</Text>
        </View>
        <Pressable onPress={onToggle}>
          {entry.done ? (
            <LinearGradient colors={gradients.success} style={styles.doneChip}>
              <Text style={styles.doneChipText}>✓ Bilan fait</Text>
            </LinearGradient>
          ) : (
            <View style={styles.todoChip}>
              <Text style={styles.todoChipText}>À faire</Text>
            </View>
          )}
        </Pressable>
      </Pressable>

      {expanded && (
        <View style={{ marginTop: spacing.md }}>
          <AttentionPanel athleteId={entry.athlete.id} onWeeksChange={handleWeeksChange} />
          <WeeklyComparisonCard athleteId={entry.athlete.id} weekA={weeks.a} weekB={weeks.b} />
          <RemarksList athleteId={entry.athlete.id} limit={10} />

          {entry.objectives.length > 0 && (
            <Card style={{ marginBottom: spacing.lg }}>
              <SectionTitle icon="🎯">Objectifs</SectionTitle>
              <View style={styles.chipRow}>
                {entry.objectives.map((o) => <Badge key={o.id} label={o.title} color={colors.gold} />)}
              </View>
            </Card>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  pageTitle: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '900' },
  pageSubtitle: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '600', marginBottom: spacing.lg, marginTop: spacing.xs },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  athleteName: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  weekLabel: { color: colors.textFaint, fontSize: fontSize.xs, fontWeight: '600', marginTop: 2 },
  doneChip: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill },
  doneChipText: { color: '#08240F', fontWeight: '800', fontSize: fontSize.xs },
  todoChip: {
    paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
  },
  todoChipText: { color: colors.textMuted, fontWeight: '800', fontSize: fontSize.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
});

import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { getWeeklyBilan, markWeeklyBilan, unmarkWeeklyBilan } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { WeeklyBilanEntryDTO } from '../../api/types';
import { Badge, Card, EmptyState, ErrorView, LoadingView, SectionTitle } from '../../components/ui';
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
        entries.map((entry) => (
          <Card key={entry.athlete.id} style={{ marginBottom: spacing.lg }} glow={!entry.done}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.athleteName}>{entry.athlete.display_name}</Text>
                <Text style={styles.weekLabel}>Semaine du {entry.week_start}</Text>
              </View>
              <Pressable onPress={() => handleToggle(entry)}>
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
            </View>

            <SectionTitle icon="📊" style={{ marginTop: spacing.md }}>Comparaison hebdomadaire</SectionTitle>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 2 }]}>Métrique</Text>
                <Text style={[styles.tableCell, styles.tableHeaderText]}>Actuel</Text>
                <Text style={[styles.tableCell, styles.tableHeaderText]}>Préc.</Text>
                <Text style={[styles.tableCell, styles.tableHeaderText]}>Diff</Text>
              </View>
              {entry.metrics.map((m) => {
                const diffColor = m.diff == null || m.diff === 0 ? colors.textFaint : m.diff > 0 ? colors.success : colors.danger;
                return (
                  <View key={m.key} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.metricLabel, { flex: 2 }]}>{m.label}</Text>
                    <Text style={styles.tableCell}>{m.current ?? '—'}</Text>
                    <Text style={[styles.tableCell, styles.mutedCell]}>{m.previous ?? '—'}</Text>
                    <Text style={[styles.tableCell, { color: diffColor, fontWeight: '800' }]}>
                      {m.diff == null ? '—' : m.diff > 0 ? `+${m.diff}` : m.diff}
                    </Text>
                  </View>
                );
              })}
            </View>

            {entry.objectives.length > 0 && (
              <>
                <SectionTitle icon="🎯" style={{ marginTop: spacing.md }}>Objectifs</SectionTitle>
                <View style={styles.chipRow}>
                  {entry.objectives.map((o) => <Badge key={o.id} label={o.title} color={colors.gold} />)}
                </View>
              </>
            )}
          </Card>
        ))
      )}
    </ScrollView>
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
  table: { marginTop: spacing.sm },
  tableHeaderRow: { flexDirection: 'row', paddingBottom: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableHeaderText: { color: colors.textFaint, fontWeight: '800', fontSize: fontSize.xs, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableCell: { flex: 1, color: colors.text, fontSize: fontSize.sm, fontWeight: '700' },
  metricLabel: { color: colors.textMuted, fontWeight: '600' },
  mutedCell: { color: colors.textFaint },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
});

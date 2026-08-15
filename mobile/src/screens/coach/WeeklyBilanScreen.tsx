import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { getWeeklyBilan, markWeeklyBilan, unmarkWeeklyBilan, TTL } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { AttentionPanelDTO, WeeklyBilanEntryDTO, WeeklyComparisonDTO } from '../../api/types';
import { Badge, Card, EmptyState, ErrorView, LoadingView, SectionTitle } from '../../components/ui';
import { Icon } from '../../components/Icon';
import AttentionPanel from '../../components/AttentionPanel';
import WeeklyComparisonCard from '../../components/WeeklyComparisonCard';
import RemarksList from '../../components/RemarksList';
import { colors, fontSize, gradients, radius, spacing } from '../../theme';
import { TAB_BAR_CLEARANCE } from '../../navigation/useTabBarStyle';
import { cacheGetSync, cachePeekSync } from '../../utils/apiCache';

function seedAttention(entry: WeeklyBilanEntryDTO): AttentionPanelDTO {
  return {
    week_a: { offset: 0, label: 'Cette sem.', start: entry.week_start, end: entry.week_start },
    week_b: { offset: 1, label: 'S-1', start: entry.week_start, end: entry.week_start },
    body_weight: {
      current: entry.metrics.find((m) => m.key === 'weight')?.current ?? null,
      previous: entry.metrics.find((m) => m.key === 'weight')?.previous ?? null,
    },
    buckets: entry.attention,
  };
}

function seedComparison(entry: WeeklyBilanEntryDTO): WeeklyComparisonDTO {
  return {
    week_a: { offset: 0, label: 'Cette sem.', start: entry.week_start, end: entry.week_start },
    week_b: { offset: 1, label: 'S-1', start: entry.week_start, end: entry.week_start },
    health: entry.metrics,
    muscles: entry.muscles,
  };
}

export default function WeeklyBilanScreen() {
  const cached = cacheGetSync<WeeklyBilanEntryDTO[]>('bilan:hebdo', TTL.bilan)
    ?? cachePeekSync<WeeklyBilanEntryDTO[]>('bilan:hebdo')?.data
    ?? null;
  const [entries, setEntries] = useState<WeeklyBilanEntryDTO[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasDataRef = React.useRef(!!cached?.length);

  const load = useCallback(async (force = false) => {
    if (!hasDataRef.current) setLoading(true);
    else if (force) setRefreshing(true);
    try {
      setError(null);
      const next = await getWeeklyBilan({ force });
      hasDataRef.current = true;
      setEntries(next);
    } catch (err) {
      if (!hasDataRef.current) setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(false); }, [load]));

  const handleToggle = async (entry: WeeklyBilanEntryDTO) => {
    setEntries((prev) => prev.map((e) => (e.athlete.id === entry.athlete.id ? { ...e, done: !e.done } : e)));
    try {
      if (entry.done) await unmarkWeeklyBilan(entry.athlete.id, entry.week_start);
      else await markWeeklyBilan(entry.athlete.id, entry.week_start);
    } catch {
      await load(true);
    }
  };

  if (loading && !entries.length) return <LoadingView label="Chargement du bilan hebdo..." />;
  if (error && !entries.length) return <ErrorView message={error} onRetry={() => void load(true)} />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true); }} tintColor={colors.primary} />}
    >
      <View style={styles.pageTitleRow}>
        <Icon name="trend-up" size={22} color={colors.text} />
        <Text style={styles.pageTitle}>Easy Bilan Hebdo</Text>
      </View>
      <Text style={styles.pageSubtitle}>Synthèse semaine actuelle vs précédente, par athlète</Text>

      {entries.length === 0 ? (
        <EmptyState icon="trend-up" title="Aucun athlète à afficher" />
      ) : (
        entries.map((entry) => <AthleteBilanCard key={entry.athlete.id} entry={entry} onToggle={() => handleToggle(entry)} />)
      )}
    </ScrollView>
  );
}

function AthleteBilanCard({ entry, onToggle }: { entry: WeeklyBilanEntryDTO; onToggle: () => void }) {
  // Collapse par défaut : évite N×3 requêtes lourdes à l'ouverture
  const [expanded, setExpanded] = useState(false);
  const [weeks, setWeeks] = useState<{ a: number; b: number }>({ a: 0, b: 1 });

  const handleWeeksChange = useCallback((a: number, b: number) => {
    setWeeks((prev) => (prev.a === a && prev.b === b ? prev : { a, b }));
  }, []);

  const useSeed = weeks.a === 0 && weeks.b === 1;

  return (
    <Card style={{ marginBottom: spacing.lg }} glow={!entry.done}>
      <Pressable onPress={() => setExpanded((e) => !e)} style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.athleteName}>{entry.athlete.display_name}</Text>
          <View style={styles.weekLabelRow}>
            <Text style={styles.weekLabel}>Semaine du {entry.week_start} · {expanded ? 'Replier' : 'Déplier'} </Text>
            <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={11} color={colors.textFaint} />
          </View>
        </View>
        <Pressable onPress={onToggle}>
          {entry.done ? (
            <LinearGradient colors={gradients.success} style={styles.doneChip}>
              <View style={styles.doneChipRow}>
                <Icon name="check" size={12} color="#08240F" />
                <Text style={styles.doneChipText}>Bilan fait</Text>
              </View>
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
          <AttentionPanel
            athleteId={entry.athlete.id}
            onWeeksChange={handleWeeksChange}
            initialData={useSeed ? seedAttention(entry) : undefined}
          />
          <WeeklyComparisonCard
            athleteId={entry.athlete.id}
            weekA={weeks.a}
            weekB={weeks.b}
            initialData={useSeed ? seedComparison(entry) : undefined}
          />
          <RemarksList athleteId={entry.athlete.id} limit={10} />

          {entry.objectives.length > 0 && (
            <Card style={{ marginBottom: spacing.lg }}>
              <SectionTitle icon="target">Objectifs</SectionTitle>
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
  content: { padding: spacing.lg, paddingBottom: spacing.xxl + TAB_BAR_CLEARANCE },
  pageTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pageTitle: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '900' },
  pageSubtitle: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '600', marginBottom: spacing.lg, marginTop: spacing.xs },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  athleteName: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  weekLabelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  weekLabel: { color: colors.textFaint, fontSize: fontSize.xs, fontWeight: '600' },
  doneChip: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill },
  doneChipRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  doneChipText: { color: '#08240F', fontWeight: '800', fontSize: fontSize.xs },
  todoChip: {
    paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
  },
  todoChipText: { color: colors.textMuted, fontWeight: '800', fontSize: fontSize.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
});

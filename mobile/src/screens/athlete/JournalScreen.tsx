import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAthleteScope } from '../../context/AthleteScopeContext';
import { listJournal, upsertJournal } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { JournalEntryDTO } from '../../api/types';
import { Badge, Button, Card, EmptyState, ErrorView, Input, LoadingView, SectionTitle } from '../../components/ui';
import { colors, fontSize, spacing } from '../../theme';
import { formatDateFR, isoDaysAgo, todayISO } from '../../utils/format';

const FIELD_DEFS: { key: keyof JournalEntryDTO; label: string; unit?: string; icon: string }[] = [
  { key: 'weight', label: 'Poids', unit: 'kg', icon: '⚖️' },
  { key: 'sleep_hours', label: 'Sommeil', unit: 'h', icon: '💤' },
  { key: 'steps', label: 'Pas', icon: '👟' },
  { key: 'water_ml', label: 'Eau', unit: 'ml', icon: '💧' },
  { key: 'kcals', label: 'Calories', unit: 'kcal', icon: '🔥' },
  { key: 'protein', label: 'Protéines', unit: 'g', icon: '🥩' },
  { key: 'carbs', label: 'Glucides', unit: 'g', icon: '🍚' },
  { key: 'fats', label: 'Lipides', unit: 'g', icon: '🥑' },
  { key: 'energy', label: 'Énergie', unit: '/10', icon: '⚡' },
  { key: 'stress', label: 'Stress', unit: '/10', icon: '😤' },
  { key: 'hunger', label: 'Faim', unit: '/10', icon: '🍽️' },
];

const TEXT_FIELD_DEFS: { key: keyof JournalEntryDTO; label: string; icon: string; placeholder: string }[] = [
  { key: 'food_quality', label: 'Qualité aliments', icon: '⭐', placeholder: 'ex: Très bonne' },
  { key: 'digestion', label: 'Digestion', icon: '🌿', placeholder: 'ex: Facile' },
];

const CYCLE_PHASES = ['SPM', 'phase menstruelle', 'en paix'];

export default function JournalScreen() {
  const { athleteId, readOnly } = useAthleteScope();

  const [entries, setEntries] = useState<JournalEntryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [cyclePhase, setCyclePhase] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await listJournal(athleteId, isoDaysAgo(30), todayISO());
      setEntries(data);
      const today = data.find((e) => e.entry_date === todayISO());
      if (today) {
        const initial: Record<string, string> = {};
        [...FIELD_DEFS, ...TEXT_FIELD_DEFS].forEach(({ key }) => {
          const val = today[key];
          if (val !== null && val !== undefined) initial[key as string] = String(val);
        });
        setForm(initial);
        setCyclePhase(today.menstrual_cycle ?? '');
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [athleteId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { athlete_id: athleteId, entry_date: todayISO() };
      FIELD_DEFS.forEach(({ key }) => {
        const raw = form[key as string];
        if (raw !== undefined && raw !== '') {
          payload[key as string] = Number(raw.replace(',', '.'));
        }
      });
      TEXT_FIELD_DEFS.forEach(({ key }) => {
        const raw = form[key as string];
        if (raw) payload[key as string] = raw;
      });
      if (cyclePhase) payload.menstrual_cycle = cyclePhase;
      await upsertJournal(payload);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingView label="Chargement du journal..." />;
  if (error) return <ErrorView message={error} onRetry={load} />;

  const history = entries.filter((e) => e.entry_date !== todayISO());
  const streak = computeStreak(entries);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      {streak > 0 && (
        <View style={styles.streakBanner}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={styles.streakText}>{streak} jour{streak > 1 ? 's' : ''} de suite — continue comme ça !</Text>
        </View>
      )}

      {!readOnly && (
        <Card>
          <SectionTitle icon="📓">Aujourd'hui — {formatDateFR(todayISO())}</SectionTitle>
          <View style={styles.grid}>
            {FIELD_DEFS.map(({ key, label, unit, icon }) => (
              <View key={key as string} style={styles.gridItem}>
                <Text style={styles.fieldLabel}>{icon} {label}{unit ? ` (${unit})` : ''}</Text>
                <Input
                  keyboardType="numeric"
                  value={form[key as string] ?? ''}
                  onChangeText={(t) => setForm((f) => ({ ...f, [key as string]: t }))}
                  placeholder="-"
                />
              </View>
            ))}
          </View>
          <View style={styles.textGrid}>
            {TEXT_FIELD_DEFS.map(({ key, label, icon, placeholder }) => (
              <View key={key as string} style={styles.textGridItem}>
                <Text style={styles.fieldLabel}>{icon} {label}</Text>
                <Input
                  value={form[key as string] ?? ''}
                  onChangeText={(t) => setForm((f) => ({ ...f, [key as string]: t }))}
                  placeholder={placeholder}
                />
              </View>
            ))}
          </View>
          <Text style={[styles.fieldLabel, { marginTop: spacing.sm }]}>🔄 Cycle menstruel</Text>
          <View style={styles.phaseRow}>
            {CYCLE_PHASES.map((phase) => (
              <Pressable key={phase} onPress={() => setCyclePhase(cyclePhase === phase ? '' : phase)}>
                <Badge label={phase} color={cyclePhase === phase ? colors.secondary : colors.textFaint} />
              </Pressable>
            ))}
          </View>
          <Button title="Enregistrer" onPress={handleSave} loading={saving} style={{ marginTop: spacing.lg }} />
        </Card>
      )}

      <SectionTitle style={{ marginTop: spacing.xl }} icon="🗓️">Historique</SectionTitle>
      {history.length === 0 ? (
        <EmptyState icon="📓" title="Aucune entrée précédente" />
      ) : (
        history.map((entry) => (
          <Card key={entry.id} style={{ marginBottom: spacing.md }}>
            <Text style={styles.historyDate}>{formatDateFR(entry.entry_date)}</Text>
            <View style={styles.historyRow}>
              {entry.weight != null && <Text style={styles.historyStat}>⚖️ {entry.weight}kg</Text>}
              {entry.sleep_hours != null && <Text style={styles.historyStat}>💤 {entry.sleep_hours}h</Text>}
              {entry.steps != null && <Text style={styles.historyStat}>👟 {entry.steps}</Text>}
              {entry.kcals != null && <Text style={styles.historyStat}>🔥 {entry.kcals}kcal</Text>}
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

function computeStreak(entries: JournalEntryDTO[]): number {
  const dates = new Set(entries.map((e) => e.entry_date));
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const iso = cursor.toISOString().slice(0, 10);
    if (!dates.has(iso)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  streakBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.goldSoft,
    borderRadius: 16, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.gold,
  },
  streakEmoji: { fontSize: 22 },
  streakText: { color: colors.gold, fontWeight: '800', flex: 1, fontSize: fontSize.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  gridItem: { width: '31%' },
  textGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  textGridItem: { width: '47%' },
  phaseRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  fieldLabel: { color: colors.textMuted, fontSize: fontSize.xs, marginBottom: spacing.xs, fontWeight: '600' },
  historyDate: { color: colors.text, fontWeight: '800', marginBottom: spacing.xs, textTransform: 'capitalize' },
  historyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  historyStat: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '600' },
});

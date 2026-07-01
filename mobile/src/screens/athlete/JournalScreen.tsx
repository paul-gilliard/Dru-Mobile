import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAthleteScope } from '../../context/AthleteScopeContext';
import { listJournal, upsertJournal } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { JournalEntryDTO } from '../../api/types';
import { Button, Card, EmptyState, ErrorView, Input, LoadingView, SectionTitle } from '../../components/ui';
import { colors, fontSize, spacing } from '../../theme';
import { formatDateFR, isoDaysAgo, todayISO } from '../../utils/format';

const FIELD_DEFS: { key: keyof JournalEntryDTO; label: string; unit?: string }[] = [
  { key: 'weight', label: 'Poids', unit: 'kg' },
  { key: 'sleep_hours', label: 'Sommeil', unit: 'h' },
  { key: 'steps', label: 'Pas' },
  { key: 'water_ml', label: 'Eau', unit: 'ml' },
  { key: 'kcals', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protéines', unit: 'g' },
  { key: 'carbs', label: 'Glucides', unit: 'g' },
  { key: 'fats', label: 'Lipides', unit: 'g' },
  { key: 'energy', label: 'Énergie', unit: '/10' },
  { key: 'stress', label: 'Stress', unit: '/10' },
  { key: 'hunger', label: 'Faim', unit: '/10' },
];

export default function JournalScreen() {
  const { athleteId, readOnly } = useAthleteScope();

  const [entries, setEntries] = useState<JournalEntryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await listJournal(athleteId, isoDaysAgo(30), todayISO());
      setEntries(data);
      const today = data.find((e) => e.entry_date === todayISO());
      if (today) {
        const initial: Record<string, string> = {};
        FIELD_DEFS.forEach(({ key }) => {
          const val = today[key];
          if (val !== null && val !== undefined) initial[key as string] = String(val);
        });
        setForm(initial);
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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      {!readOnly && (
        <Card>
          <SectionTitle>Aujourd'hui — {formatDateFR(todayISO())}</SectionTitle>
          <View style={styles.grid}>
            {FIELD_DEFS.map(({ key, label, unit }) => (
              <View key={key as string} style={styles.gridItem}>
                <Text style={styles.fieldLabel}>{label}{unit ? ` (${unit})` : ''}</Text>
                <Input
                  keyboardType="numeric"
                  value={form[key as string] ?? ''}
                  onChangeText={(t) => setForm((f) => ({ ...f, [key as string]: t }))}
                  placeholder="-"
                />
              </View>
            ))}
          </View>
          <Button title="Enregistrer" onPress={handleSave} loading={saving} style={{ marginTop: spacing.lg }} />
        </Card>
      )}

      <SectionTitle style={{ marginTop: spacing.xl }}>Historique</SectionTitle>
      {history.length === 0 ? (
        <EmptyState title="Aucune entrée précédente" />
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  gridItem: { width: '31%' },
  fieldLabel: { color: colors.textMuted, fontSize: fontSize.xs, marginBottom: spacing.xs },
  historyDate: { color: colors.text, fontWeight: '700', marginBottom: spacing.xs, textTransform: 'capitalize' },
  historyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  historyStat: { color: colors.textMuted, fontSize: fontSize.sm },
});

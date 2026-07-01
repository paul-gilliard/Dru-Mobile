import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { getRemarks } from '../api/resources';
import { RemarkDTO } from '../api/types';
import { colors, fontSize, spacing } from '../theme';
import { Card, SectionTitle } from './ui';

export default function RemarksList({ athleteId, limit = 15 }: { athleteId: number; limit?: number }) {
  const [remarks, setRemarks] = useState<RemarkDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setRemarks(await getRemarks(athleteId, limit));
    } catch {
      setRemarks([]);
    } finally {
      setLoading(false);
    }
  }, [athleteId, limit]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  if (loading) {
    return <Card style={{ marginBottom: spacing.lg, alignItems: 'center', paddingVertical: spacing.lg }}><ActivityIndicator color={colors.primary} /></Card>;
  }
  if (remarks.length === 0) return null;

  return (
    <Card style={{ marginBottom: spacing.lg }}>
      <SectionTitle icon="💬">Remarques de l'athlète</SectionTitle>
      {remarks.map((r, i) => (
        <View key={`${r.date}-${r.exercise}-${i}`} style={styles.row}>
          <View style={styles.rowHead}>
            <Text style={styles.date}>{r.date}</Text>
            <Text style={styles.exercise}>{r.exercise}{r.series_number ? ` · S${r.series_number}` : ''}</Text>
          </View>
          <Text style={styles.note}>{r.notes}</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  rowHead: { flexDirection: 'row', gap: spacing.sm, marginBottom: 2 },
  date: { color: colors.textFaint, fontSize: fontSize.xs, fontWeight: '700' },
  exercise: { color: colors.text, fontSize: fontSize.xs, fontWeight: '800' },
  note: { color: colors.textMuted, fontSize: fontSize.sm },
});

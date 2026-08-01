import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getWeeklyComparison } from '../api/resources';
import { apiErrorMessage } from '../api/client';
import { MuscleComparisonRowDTO, WeeklyComparisonDTO } from '../api/types';
import { colors, fontSize, muscleColors, radius, spacing } from '../theme';
import { Button, Card, SectionTitle } from './ui';

function diffColor(diff: number | null) {
  if (diff == null) return colors.textFaint;
  if (Math.abs(diff) < 0.1) return colors.textFaint;
  return diff > 0 ? colors.success : colors.danger;
}

function fmtDiff(diff: number | null) {
  if (diff == null) return '—';
  if (Math.abs(diff) < 0.1) return '→ stable';
  return diff > 0 ? `↑ +${diff}` : `↓ ${diff}`;
}

function MuscleDetailModal({
  row, onClose,
}: { row: MuscleComparisonRowDTO | null; onClose: () => void }) {
  return (
    <Modal visible={!!row} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <ScrollView>
            <Text style={styles.modalTitle}>{row?.muscle} — détail par exercice</Text>
            {row?.exercises.length === 0 ? (
              <Text style={styles.mutedText}>Aucune donnée.</Text>
            ) : (
              row?.exercises.map((ex) => (
                <View key={ex.name} style={styles.modalExRow}>
                  <Text style={styles.modalExName}>{ex.name}</Text>
                  <View style={styles.modalExValsRow}>
                    <Text style={styles.modalExVal}>{ex.current} kg</Text>
                    <Text style={styles.modalExValFaint}>{ex.previous} kg</Text>
                    <Text style={[styles.modalExPct, { color: ex.diff_pct > 0 ? colors.success : ex.diff_pct < 0 ? colors.danger : colors.textFaint }]}>
                      {ex.diff_pct > 0 ? '▲' : ex.diff_pct < 0 ? '▼' : '→'} {ex.diff_pct > 0 ? '+' : ''}{ex.diff_pct}%
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
          <Button title="Fermer" onPress={onClose} style={{ marginTop: spacing.md }} />
        </View>
      </View>
    </Modal>
  );
}

export default function WeeklyComparisonCard({
  athleteId, weekA, weekB,
}: { athleteId: number; weekA: number; weekB: number }) {
  const [data, setData] = useState<WeeklyComparisonDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMuscle, setOpenMuscle] = useState<MuscleComparisonRowDTO | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await getWeeklyComparison(athleteId, weekA, weekB);
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) {
          setError(apiErrorMessage(err));
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [athleteId, weekA, weekB]);

  if (loading && !data) {
    return <Card style={{ marginBottom: spacing.lg, alignItems: 'center', paddingVertical: spacing.lg }}><ActivityIndicator color={colors.primary} /></Card>;
  }
  if (error || !data) {
    return <Card style={{ marginBottom: spacing.lg }}><Text style={styles.errorText}>{error ?? 'Erreur'}</Text></Card>;
  }

  return (
    <Card style={{ marginBottom: spacing.lg, opacity: loading ? 0.7 : 1 }}>
      <SectionTitle icon="📊">Comparaison hebdomadaire ({data.week_a.label} vs {data.week_b.label})</SectionTitle>
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 2 }]}>Métrique</Text>
        <Text style={[styles.tableCell, styles.tableHeaderText]}>{data.week_a.label}</Text>
        <Text style={[styles.tableCell, styles.tableHeaderText]}>{data.week_b.label}</Text>
        <Text style={[styles.tableCell, styles.tableHeaderText]}>Diff</Text>
      </View>
      {data.health.map((m) => (
        <View key={m.key} style={styles.tableRow}>
          <Text style={[styles.tableCell, styles.metricLabel, { flex: 2 }]}>{m.label}</Text>
          <Text style={styles.tableCell}>{m.current ?? '—'}</Text>
          <Text style={[styles.tableCell, styles.mutedCell]}>{m.previous ?? '—'}</Text>
          <Text style={[styles.tableCell, { color: diffColor(m.diff), fontWeight: '800', fontSize: fontSize.xs }]}>{fmtDiff(m.diff)}</Text>
        </View>
      ))}

      {data.muscles.length > 0 && (
        <>
          <View style={{ height: spacing.md }} />
          {data.muscles.map((row) => (
            <Pressable key={row.muscle} onPress={() => setOpenMuscle(row)} style={styles.muscleRow}>
              <View style={[styles.muscleDot, { backgroundColor: muscleColors[row.muscle] ?? colors.primary }]} />
              <Text style={styles.muscleLabel}>{row.muscle}</Text>
              <Text style={[styles.muscleDiff, { color: diffColor(row.diff) }]}>{fmtDiff(row.diff)} kg</Text>
              <Text style={styles.muscleDetailLink}>Détails ›</Text>
            </Pressable>
          ))}
        </>
      )}

      <MuscleDetailModal row={openMuscle} onClose={() => setOpenMuscle(null)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  tableHeaderRow: { flexDirection: 'row', paddingBottom: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableHeaderText: { color: colors.textFaint, fontWeight: '800', fontSize: fontSize.xs, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableCell: { flex: 1, color: colors.text, fontSize: fontSize.sm, fontWeight: '700' },
  metricLabel: { color: colors.textMuted, fontWeight: '600' },
  mutedCell: { color: colors.textFaint },
  errorText: { color: colors.danger, fontSize: fontSize.sm },
  muscleRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  muscleDot: { width: 8, height: 8, borderRadius: 4 },
  muscleLabel: { color: colors.text, fontWeight: '700', fontSize: fontSize.sm, flex: 1 },
  muscleDiff: { fontWeight: '800', fontSize: fontSize.xs },
  muscleDetailLink: { color: colors.secondary, fontSize: fontSize.xs, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.lg },
  modalCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, maxHeight: '80%',
    borderWidth: 1, borderColor: colors.border,
  },
  modalTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '900', marginBottom: spacing.md },
  mutedText: { color: colors.textMuted },
  modalExRow: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  modalExName: { color: colors.text, fontWeight: '700', fontSize: fontSize.sm, marginBottom: 4 },
  modalExValsRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  modalExVal: { color: colors.text, fontSize: fontSize.sm, fontWeight: '700' },
  modalExValFaint: { color: colors.textFaint, fontSize: fontSize.sm },
  modalExPct: { fontWeight: '800', fontSize: fontSize.sm, marginLeft: 'auto' },
});

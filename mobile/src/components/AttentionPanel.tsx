import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { getAttentionPanel } from '../api/resources';
import { apiErrorMessage } from '../api/client';
import { AttentionItemDTO, AttentionPanelDTO, AttentionVerdict } from '../api/types';
import { colors, fontSize, radius, spacing } from '../theme';
import { Card, SectionTitle } from './ui';

const MAX_WEEKS_BACK = 16;

type BucketKey = keyof AttentionPanelDTO['buckets'];

const BUCKET_META: Record<BucketKey, { icon: string; label: string; color: string; soft: string }> = {
  regression: { icon: '🔴', label: 'Régressions', color: colors.danger, soft: colors.dangerSoft },
  review: { icon: '👀', label: 'Vue du coach', color: colors.violet, soft: colors.violetSoft },
  stagnation: { icon: '🟠', label: 'Stagnations', color: colors.warning, soft: colors.warningSoft },
  progress: { icon: '🟢', label: 'Progrès', color: colors.success, soft: colors.successSoft },
  new: { icon: '🆕', label: 'Nouveaux', color: colors.secondary, soft: colors.secondarySoft },
  abandoned: { icon: '🚫', label: 'Abandonnés', color: colors.muted, soft: colors.mutedSoft },
};

const BUCKET_ORDER: BucketKey[] = ['regression', 'review', 'stagnation', 'progress', 'new', 'abandoned'];

function weekLabel(offset: number) {
  return offset === 0 ? 'Cette sem.' : `S-${offset}`;
}

function WeekStepper({
  label, offset, onChange,
}: { label: string; offset: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable
          onPress={() => onChange(Math.min(MAX_WEEKS_BACK, offset + 1))}
          style={styles.stepperBtn}
          hitSlop={8}
        >
          <Text style={styles.stepperBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.stepperValue}>{weekLabel(offset)}</Text>
        <Pressable onPress={() => onChange(Math.max(0, offset - 1))} style={styles.stepperBtn} hitSlop={8}>
          <Text style={styles.stepperBtnText}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

function bodyWeightBadge(current: number | null, previous: number | null) {
  if (current == null && previous == null) return <Text style={styles.mutedInline}>Pas de donnée poids corporel</Text>;
  if (current == null || previous == null) {
    return <Text style={styles.mutedInline}>{current ?? '—'} kg vs {previous ?? '—'} kg</Text>;
  }
  const diff = current - previous;
  if (diff > 0.1) return <Text style={[styles.weightBadge, { color: colors.secondary }]}>↑ +{diff.toFixed(2)} kg <Text style={styles.mutedInline}>({current.toFixed(1)} vs {previous.toFixed(1)} kg)</Text></Text>;
  if (diff < -0.1) return <Text style={[styles.weightBadge, { color: colors.danger }]}>↓ {diff.toFixed(2)} kg <Text style={styles.mutedInline}>({current.toFixed(1)} vs {previous.toFixed(1)} kg)</Text></Text>;
  return <Text style={[styles.weightBadge, { color: colors.textMuted }]}>→ Stable ({current.toFixed(1)} kg)</Text>;
}

function ExerciseChip({ item, color, aLabel, bLabel }: { item: AttentionItemDTO; color: string; aLabel: string; bLabel: string }) {
  const [open, setOpen] = useState(false);
  const hasDetail = !!(item.detail && item.detail.rows.length);

  return (
    <View style={styles.chipWrap}>
      <Pressable
        onPress={() => hasDetail && setOpen((o) => !o)}
        style={[styles.chip, { backgroundColor: color }]}
      >
        <Text style={styles.chipText}>{item.name}{hasDetail ? (open ? ' ▴' : ' ▾') : ''}</Text>
      </Pressable>
      {open && item.detail ? (
        <View style={styles.detailCard}>
          <View style={styles.detailHeaderRow}>
            <Text style={styles.detailHeaderText}>{aLabel} : <Text style={{ color: colors.secondary }}>{item.detail.cur_date}</Text></Text>
            <Text style={styles.detailVs}>vs</Text>
            <Text style={styles.detailHeaderText}>{bLabel} : <Text style={{ color: colors.textFaint }}>{item.detail.prev_date}</Text></Text>
          </View>
          {item.detail.rows.map((r) => {
            const rowColor = r.verdict === 'regression' ? colors.danger : r.verdict === 'progress' ? colors.success : r.verdict === 'same' ? colors.textMuted : colors.textFaint;
            const rowText = r.verdict === 'regression' ? '↓ Régression' : r.verdict === 'progress' ? '↑ Progrès' : r.verdict === 'same' ? '→ Identique' : '? Incomplet';
            return (
              <View key={r.num} style={styles.detailRow}>
                <Text style={styles.detailRowNum}>S{r.num}</Text>
                <Text style={styles.detailRowVal}>{r.c_load ?? '—'} kg × {r.c_reps ?? '—'}</Text>
                <Text style={[styles.detailRowVal, { color: colors.textFaint }]}>{r.p_load ?? '—'} kg × {r.p_reps ?? '—'}</Text>
                <Text style={[styles.detailRowVerdict, { color: rowColor }]}>{rowText}</Text>
              </View>
            );
          })}
          <View style={styles.detailFooterRow}>
            <Text style={styles.mutedInline}>
              🟢 {item.detail.stats.count_progress} · 🔴 {item.detail.stats.count_regression} · → {item.detail.stats.count_same}
            </Text>
            <Text style={[styles.detailTonnage, { color: item.detail.stats.tonnage_diff > 0 ? colors.success : item.detail.stats.tonnage_diff < 0 ? colors.danger : colors.textMuted }]}>
              Tonnage {item.detail.stats.cur_tonnage} vs {item.detail.stats.prev_tonnage} kg ({item.detail.stats.tonnage_diff > 0 ? '+' : ''}{item.detail.stats.tonnage_diff})
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function BucketSection({
  bucketKey, items, aLabel, bLabel,
}: { bucketKey: BucketKey; items: AttentionItemDTO[]; aLabel: string; bLabel: string }) {
  const meta = BUCKET_META[bucketKey];
  return (
    <View style={[styles.bucket, { backgroundColor: meta.soft, borderLeftColor: meta.color }]}>
      <Text style={styles.bucketTitle}>{meta.icon} {meta.label} ({items.length})</Text>
      {items.length === 0 ? (
        <Text style={styles.mutedInline}>Aucun</Text>
      ) : (
        <View style={styles.chipRow}>
          {items.map((item, i) => (
            <ExerciseChip key={`${item.name}-${i}`} item={item} color={meta.color} aLabel={aLabel} bLabel={bLabel} />
          ))}
        </View>
      )}
    </View>
  );
}

export default function AttentionPanel({
  athleteId, onWeeksChange,
}: { athleteId: number; onWeeksChange?: (weekA: number, weekB: number) => void }) {
  const [weekA, setWeekA] = useState(0);
  const [weekB, setWeekB] = useState(1);
  const [data, setData] = useState<AttentionPanelDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await getAttentionPanel(athleteId, weekA, weekB);
      setData(res);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [athleteId, weekA, weekB]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useEffect(() => { onWeeksChange?.(weekA, weekB); }, [weekA, weekB, onWeeksChange]);

  const aLabel = useMemo(() => weekLabel(weekA), [weekA]);
  const bLabel = useMemo(() => weekLabel(weekB), [weekB]);

  return (
    <Card style={{ marginBottom: spacing.lg }}>
      <SectionTitle icon="🎯">Points d'attention coach</SectionTitle>
      <View style={styles.stepperContainer}>
        <WeekStepper label="Sem. A" offset={weekA} onChange={setWeekA} />
        <Text style={styles.vsLabel}>vs</Text>
        <WeekStepper label="Sem. B" offset={weekB} onChange={setWeekB} />
      </View>

      {loading ? (
        <View style={styles.loadingRow}><ActivityIndicator color={colors.primary} /></View>
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : data ? (
        <>
          <View style={[styles.bucket, { backgroundColor: colors.secondarySoft, borderLeftColor: colors.secondary }]}>
            <Text style={styles.bucketTitle}>⚖️ Poids corporel</Text>
            {bodyWeightBadge(data.body_weight.current, data.body_weight.previous)}
          </View>
          {BUCKET_ORDER.filter((k) => k === 'regression' || k === 'review' || k === 'stagnation' || k === 'progress' || data.buckets[k].length > 0).map((k) => (
            <BucketSection key={k} bucketKey={k} items={data.buckets[k]} aLabel={aLabel} bLabel={bLabel} />
          ))}
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  stepperContainer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stepperLabel: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '700' },
  stepper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.xs,
  },
  stepperBtn: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
  stepperBtnText: { color: colors.primary, fontWeight: '900', fontSize: fontSize.md },
  stepperValue: { color: colors.text, fontWeight: '800', fontSize: fontSize.xs, minWidth: 58, textAlign: 'center' },
  vsLabel: { color: colors.textFaint, fontSize: fontSize.xs, fontWeight: '700' },
  loadingRow: { paddingVertical: spacing.lg, alignItems: 'center' },
  errorText: { color: colors.danger, fontSize: fontSize.sm },
  bucket: { borderLeftWidth: 3, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.sm },
  bucketTitle: { color: colors.text, fontWeight: '800', fontSize: fontSize.sm, marginBottom: spacing.xs },
  mutedInline: { color: colors.textFaint, fontSize: fontSize.xs, fontStyle: 'italic' },
  weightBadge: { fontWeight: '800', fontSize: fontSize.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chipWrap: { marginBottom: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.sm },
  chipText: { color: '#fff', fontWeight: '700', fontSize: fontSize.xs },
  detailCard: {
    backgroundColor: colors.surface, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.xs,
    borderWidth: 1, borderColor: colors.border, minWidth: 260,
  },
  detailHeaderRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs, flexWrap: 'wrap' },
  detailHeaderText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  detailVs: { color: colors.textFaint, fontSize: 11 },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border },
  detailRowNum: { color: colors.textFaint, fontSize: 11, fontWeight: '700', width: 22 },
  detailRowVal: { color: colors.text, fontSize: 11, flex: 1 },
  detailRowVerdict: { fontSize: 11, fontWeight: '800' },
  detailFooterRow: { marginTop: spacing.xs, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, gap: 2 },
  detailTonnage: { fontSize: 11, fontWeight: '800' },
});

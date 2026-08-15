import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { getAttentionPanel } from '../api/resources';
import { apiErrorMessage } from '../api/client';
import { AttentionItemDTO, AttentionPanelDTO } from '../api/types';
import { colors, fontSize, radius, spacing } from '../theme';
import { Card, SectionTitle } from './ui';
import { Icon, IconName } from './Icon';

const MAX_WEEKS_BACK = 16;

type BucketKey = keyof AttentionPanelDTO['buckets'];

const BUCKET_META: Record<BucketKey, { icon: IconName; label: string; color: string; soft: string }> = {
  regression: { icon: 'trend-down', label: 'Régressions', color: colors.danger, soft: colors.dangerSoft },
  review: { icon: 'eye', label: 'Vue du coach', color: colors.violet, soft: colors.violetSoft },
  stagnation: { icon: 'trend-flat', label: 'Stagnations', color: colors.warning, soft: colors.warningSoft },
  progress: { icon: 'trend-up', label: 'Progrès', color: colors.success, soft: colors.successSoft },
  new: { icon: 'sparkle', label: 'Nouveaux', color: colors.secondary, soft: colors.secondarySoft },
  abandoned: { icon: 'ban', label: 'Abandonnés', color: colors.muted, soft: colors.mutedSoft },
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
          <Icon name="chevron-left" size={16} color={colors.primary} />
        </Pressable>
        <Text style={styles.stepperValue}>{weekLabel(offset)}</Text>
        <Pressable onPress={() => onChange(Math.max(0, offset - 1))} style={styles.stepperBtn} hitSlop={8}>
          <Icon name="chevron-right" size={16} color={colors.primary} />
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
  const flat = Math.abs(diff) <= 0.1;
  const color = flat ? colors.textMuted : diff > 0 ? colors.secondary : colors.danger;
  const icon: IconName = flat ? 'trend-flat' : diff > 0 ? 'trend-up' : 'trend-down';
  const label = flat ? 'Stable' : `${diff > 0 ? '+' : ''}${diff.toFixed(2)} kg`;
  return (
    <View style={styles.weightBadgeRow}>
      <Icon name={icon} size={14} color={color} />
      <Text style={[styles.weightBadge, { color }]}>{label} </Text>
      <Text style={styles.mutedInline}>({current.toFixed(1)} vs {previous.toFixed(1)} kg)</Text>
    </View>
  );
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
        <Text style={styles.chipText}>{item.name}</Text>
        {hasDetail ? <Icon name={open ? 'chevron-up' : 'chevron-down'} size={13} color="#fff" /> : null}
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
            const rowIcon: IconName = r.verdict === 'regression' ? 'trend-down' : r.verdict === 'progress' ? 'trend-up' : r.verdict === 'same' ? 'trend-flat' : 'warning';
            const rowText = r.verdict === 'regression' ? 'Régression' : r.verdict === 'progress' ? 'Progrès' : r.verdict === 'same' ? 'Identique' : 'Incomplet';
            return (
              <View key={r.num} style={styles.detailRow}>
                <Text style={styles.detailRowNum}>S{r.num}</Text>
                <Text style={styles.detailRowVal}>{r.c_load ?? '—'} kg × {r.c_reps ?? '—'}</Text>
                <Text style={[styles.detailRowVal, { color: colors.textFaint }]}>{r.p_load ?? '—'} kg × {r.p_reps ?? '—'}</Text>
                <View style={styles.detailRowVerdictRow}>
                  <Icon name={rowIcon} size={12} color={rowColor} />
                  <Text style={[styles.detailRowVerdict, { color: rowColor }]}>{rowText}</Text>
                </View>
              </View>
            );
          })}
          <View style={styles.detailFooterRow}>
            <View style={styles.detailFooterCountsRow}>
              <Icon name="trend-up" size={12} color={colors.success} />
              <Text style={styles.mutedInline}>{item.detail.stats.count_progress}</Text>
              <Icon name="trend-down" size={12} color={colors.danger} />
              <Text style={styles.mutedInline}>{item.detail.stats.count_regression}</Text>
              <Icon name="trend-flat" size={12} color={colors.textFaint} />
              <Text style={styles.mutedInline}>{item.detail.stats.count_same}</Text>
            </View>
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
      <View style={styles.bucketTitleRow}>
        <Icon name={meta.icon} size={14} color={meta.color} />
        <Text style={styles.bucketTitle}>{meta.label} ({items.length})</Text>
      </View>
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
  athleteId, onWeeksChange, initialData,
}: {
  athleteId: number;
  onWeeksChange?: (weekA: number, weekB: number) => void;
  /** Données déjà fournies par le bilan (évite un refetch pour semaines 0/1). */
  initialData?: AttentionPanelDTO | null;
}) {
  const [weekA, setWeekA] = useState(0);
  const [weekB, setWeekB] = useState(1);
  const [data, setData] = useState<AttentionPanelDTO | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const onWeeksChangeRef = useRef(onWeeksChange);
  onWeeksChangeRef.current = onWeeksChange;

  // Notify parent only when week offsets actually change (stable callback via ref).
  useEffect(() => {
    onWeeksChangeRef.current?.(weekA, weekB);
  }, [weekA, weekB]);

  // Ignore stale responses when the user switches weeks quickly.
  useEffect(() => {
    let cancelled = false;
    const canUseSeed = weekA === 0 && weekB === 1 && initialData;
    if (canUseSeed) {
      setData(initialData);
      setLoading(false);
      setError(null);
      return () => { cancelled = true; };
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await getAttentionPanel(athleteId, weekA, weekB);
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
  }, [athleteId, weekA, weekB, initialData]);

  const aLabel = useMemo(() => weekLabel(weekA), [weekA]);
  const bLabel = useMemo(() => weekLabel(weekB), [weekB]);

  return (
    <Card style={{ marginBottom: spacing.lg }}>
      <SectionTitle icon="target">Points d'attention coach</SectionTitle>
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
            <View style={styles.bucketTitleRow}>
              <Icon name="scale" size={14} color={colors.secondary} />
              <Text style={styles.bucketTitle}>Poids corporel</Text>
            </View>
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
  stepperValue: { color: colors.text, fontWeight: '800', fontSize: fontSize.xs, minWidth: 58, textAlign: 'center' },
  vsLabel: { color: colors.textFaint, fontSize: fontSize.xs, fontWeight: '700' },
  loadingRow: { paddingVertical: spacing.lg, alignItems: 'center' },
  errorText: { color: colors.danger, fontSize: fontSize.sm },
  bucket: { borderLeftWidth: 3, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.sm },
  bucketTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs },
  bucketTitle: { color: colors.text, fontWeight: '800', fontSize: fontSize.sm },
  mutedInline: { color: colors.textFaint, fontSize: fontSize.xs, fontStyle: 'italic' },
  weightBadgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  weightBadge: { fontWeight: '800', fontSize: fontSize.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chipWrap: { marginBottom: spacing.xs },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.sm,
  },
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
  detailRowVerdictRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  detailRowVerdict: { fontSize: 11, fontWeight: '800' },
  detailFooterRow: { marginTop: spacing.xs, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, gap: 2 },
  detailFooterCountsRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  detailTonnage: { fontSize: 11, fontWeight: '800' },
});

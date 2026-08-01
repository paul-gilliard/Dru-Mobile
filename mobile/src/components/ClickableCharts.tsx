import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { colors, fontSize, radius, spacing } from '../theme';

export type ChartDatum = {
  id: string;
  /** Libellé axe (court) */
  label: string;
  value: number;
  color?: string;
  /** Nom complet (légende / accessibilité) */
  fullLabel?: string;
};

type CommonProps = {
  data: ChartDatum[];
  width: number;
  height?: number;
  onPointPress?: (item: ChartDatum, index: number) => void;
  empty?: string;
  ySuffix?: string;
  selectedId?: string | null;
  hint?: string;
};

function niceMax(values: number[]) {
  const m = Math.max(0, ...values);
  if (m <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(m));
  return Math.ceil(m / pow) * pow;
}

function fmtTick(v: number) {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function ChartLegend({
  data, selectedId, onPress,
}: {
  data: ChartDatum[];
  selectedId?: string | null;
  onPress?: (item: ChartDatum, index: number) => void;
}) {
  const needsLegend = data.some((d) => (d.fullLabel ?? d.label).length > 8);
  if (!needsLegend) return null;
  return (
    <View style={styles.legend}>
      {data.map((d, i) => {
        const selected = selectedId === d.id;
        return (
          <Pressable
            key={d.id}
            onPress={() => onPress?.(d, i)}
            style={[styles.legendRow, selected && styles.legendRowOn]}
          >
            <View style={[styles.legendDot, { backgroundColor: d.color ?? colors.primary }]} />
            <Text style={[styles.legendIdx, selected && { color: colors.text }]}>{i + 1}</Text>
            <Text style={[styles.legendText, selected && { color: colors.text }]} numberOfLines={2}>
              {d.fullLabel ?? d.label}
            </Text>
            <Text style={styles.legendVal}>{fmtTick(d.value)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Barres verticales — idéales pour périodes courtes (S-1, 27, juil…). */
export function TapBarChart({
  data, width, height = 200, onPointPress, empty, ySuffix = '', selectedId, hint,
}: CommonProps) {
  const padL = 36;
  const padR = 10;
  const padT = 16;
  const padB = 34;
  const chartW = Math.max(120, width);
  const innerW = chartW - padL - padR;
  const innerH = height - padT - padB;
  const maxY = useMemo(() => niceMax(data.map((d) => d.value)), [data]);

  if (!data.length) {
    return <Text style={styles.empty}>{empty ?? 'Pas de données.'}</Text>;
  }

  const gap = Math.min(12, innerW / data.length / 4);
  const barW = Math.max(8, (innerW - gap * (data.length + 1)) / data.length);
  const useIndexLabels = data.some((d) => (d.fullLabel ?? d.label).length > 8);

  return (
    <View style={styles.wrap}>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <Svg width={chartW} height={height}>
        {[0, 0.5, 1].map((t) => {
          const y = padT + innerH * (1 - t);
          return (
            <G key={t}>
              <Line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke={colors.border} strokeWidth={1} />
              <SvgText x={padL - 6} y={y + 3} fill={colors.textFaint} fontSize={9} textAnchor="end">
                {fmtTick(maxY * t)}{ySuffix}
              </SvgText>
            </G>
          );
        })}
        {data.map((d, i) => {
          const h = maxY > 0 ? (d.value / maxY) * innerH : 0;
          const x = padL + gap + i * (barW + gap);
          const y = padT + innerH - h;
          const selected = selectedId === d.id;
          const fill = d.color ?? colors.primary;
          const axis = useIndexLabels ? String(i + 1) : d.label;
          return (
            <G key={d.id}>
              <Rect
                x={x} y={padT} width={barW} height={innerH}
                fill="rgba(255,255,255,0.001)"
                onPress={() => onPointPress?.(d, i)}
                // @ts-expect-error web
                onClick={() => onPointPress?.(d, i)}
              />
              <Rect
                x={x} y={y} width={barW} height={Math.max(2, h)} rx={4}
                fill={fill}
                opacity={selected ? 1 : 0.85}
                stroke={selected ? '#fff' : 'transparent'}
                strokeWidth={selected ? 2 : 0}
                onPress={() => onPointPress?.(d, i)}
                // @ts-expect-error web
                onClick={() => onPointPress?.(d, i)}
              />
              <SvgText
                x={x + barW / 2}
                y={height - 12}
                fill={selected ? colors.text : colors.textMuted}
                fontSize={9}
                fontWeight={selected ? '700' : '600'}
                textAnchor="middle"
              >
                {axis}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      <ChartLegend data={data} selectedId={selectedId} onPress={onPointPress} />
      <Text style={styles.tapHint}>Tape une barre{useIndexLabels ? ' ou un nom' : ''} pour le détail</Text>
    </View>
  );
}

/**
 * Barres horizontales — noms longs lisibles à gauche (muscles / exercices).
 */
export function TapHBarChart({
  data, width, height, onPointPress, empty, selectedId, hint,
}: CommonProps) {
  const rowH = 36;
  const padL = 152;
  const padR = 48;
  const padT = 8;
  const padB = 8;
  const chartW = Math.max(160, width);
  const n = Math.max(1, data.length);
  const chartH = height ?? padT + padB + n * rowH;
  const innerW = chartW - padL - padR;
  const maxY = useMemo(() => niceMax(data.map((d) => d.value)), [data]);

  if (!data.length) {
    return <Text style={styles.empty}>{empty ?? 'Pas de données.'}</Text>;
  }

  return (
    <View style={styles.wrap}>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <Svg width={chartW} height={chartH}>
        {data.map((d, i) => {
          const y = padT + i * rowH;
          const barW = maxY > 0 ? (d.value / maxY) * innerW : 0;
          const selected = selectedId === d.id;
          const fill = d.color ?? colors.primary;
          const name = d.fullLabel ?? d.label;
          const shown = name.length > 22 ? `${name.slice(0, 21)}…` : name;
          return (
            <G key={d.id}>
              <Rect
                x={0} y={y} width={chartW} height={rowH - 4}
                fill={selected ? 'rgba(255,75,38,0.12)' : 'rgba(255,255,255,0.001)'}
                rx={6}
                onPress={() => onPointPress?.(d, i)}
                // @ts-expect-error web
                onClick={() => onPointPress?.(d, i)}
              />
              <SvgText
                x={padL - 8}
                y={y + rowH / 2 - 2}
                fill={selected ? colors.text : colors.textMuted}
                fontSize={10}
                fontWeight={selected ? '700' : '600'}
                textAnchor="end"
              >
                {shown}
              </SvgText>
              <Rect
                x={padL}
                y={y + 6}
                width={Math.max(3, barW)}
                height={rowH - 16}
                rx={4}
                fill={fill}
                opacity={selected ? 1 : 0.88}
                onPress={() => onPointPress?.(d, i)}
                // @ts-expect-error web
                onClick={() => onPointPress?.(d, i)}
              />
              <SvgText
                x={padL + Math.max(3, barW) + 6}
                y={y + rowH / 2 - 2}
                fill={colors.text}
                fontSize={10}
                fontWeight="800"
              >
                {fmtTick(d.value)}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      <Text style={styles.tapHint}>Tape une ligne pour le détail</Text>
    </View>
  );
}

/** Courbe + points SVG cliquables. */
export function TapLineChart({
  data, width, height = 200, onPointPress, empty, ySuffix = '', selectedId, hint, color,
}: CommonProps & { color?: string }) {
  const padL = 40;
  const padR = 12;
  const padT = 16;
  const padB = 36;
  const chartW = Math.max(120, width);
  const innerW = chartW - padL - padR;
  const innerH = height - padT - padB;
  const stroke = color ?? colors.primary;

  const maxY = useMemo(() => niceMax(data.map((d) => d.value)), [data]);
  const minY = useMemo(() => {
    const vals = data.map((d) => d.value);
    if (!vals.length) return 0;
    const mn = Math.min(...vals);
    if (mn > 0 && mn / maxY > 0.4) return Math.max(0, mn * 0.85);
    return 0;
  }, [data, maxY]);

  if (!data.length) {
    return <Text style={styles.empty}>{empty ?? 'Pas de données.'}</Text>;
  }

  const points = data.map((d, i) => {
    const x = padL + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
    const ratio = maxY === minY ? 0.5 : (d.value - minY) / (maxY - minY);
    const y = padT + innerH * (1 - ratio);
    return { ...d, x, y, i };
  });

  return (
    <View style={styles.wrap}>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <Svg width={chartW} height={height}>
        {[0, 0.5, 1].map((t) => {
          const y = padT + innerH * (1 - t);
          const val = minY + (maxY - minY) * t;
          return (
            <G key={t}>
              <Line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke={colors.border} strokeWidth={1} />
              <SvgText x={padL - 6} y={y + 3} fill={colors.textFaint} fontSize={9} textAnchor="end">
                {fmtTick(val)}{ySuffix ? ` ${ySuffix}` : ''}
              </SvgText>
            </G>
          );
        })}
        {points.slice(1).map((p, i) => (
          <Line
            key={`seg-${p.id}`}
            x1={points[i].x}
            y1={points[i].y}
            x2={p.x}
            y2={p.y}
            stroke={stroke}
            strokeWidth={2.5}
            strokeOpacity={0.9}
          />
        ))}
        {points.map((p) => {
          const selected = selectedId === p.id;
          return (
            <G key={p.id}>
              <Circle
                cx={p.x} cy={p.y} r={18}
                fill="rgba(255,255,255,0.001)"
                onPress={() => onPointPress?.(data[p.i], p.i)}
                // @ts-expect-error web
                onClick={() => onPointPress?.(data[p.i], p.i)}
              />
              <Circle
                cx={p.x} cy={p.y}
                r={selected ? 7 : 5}
                fill={selected ? '#fff' : stroke}
                stroke={stroke}
                strokeWidth={selected ? 3 : 2}
                onPress={() => onPointPress?.(data[p.i], p.i)}
                // @ts-expect-error web
                onClick={() => onPointPress?.(data[p.i], p.i)}
              />
              <SvgText
                x={p.x}
                y={height - 14}
                fill={selected ? colors.text : colors.textMuted}
                fontSize={9}
                fontWeight={selected ? '700' : '600'}
                textAnchor="middle"
              >
                {p.label}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      <Text style={styles.tapHint}>Tape un point pour le détail</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    overflow: 'hidden',
  },
  hint: {
    color: colors.textFaint,
    fontSize: fontSize.xs,
    fontWeight: '600',
    paddingHorizontal: spacing.sm,
    marginBottom: 2,
  },
  tapHint: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  empty: {
    color: colors.textFaint,
    fontSize: fontSize.xs,
    fontWeight: '600',
    padding: spacing.md,
  },
  legend: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    gap: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
  },
  legendRowOn: {
    backgroundColor: colors.primarySoft,
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendIdx: {
    color: colors.textFaint,
    fontWeight: '800',
    fontSize: 11,
    width: 16,
  },
  legendText: {
    flex: 1,
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: fontSize.xs,
  },
  legendVal: {
    color: colors.primary,
    fontWeight: '900',
    fontSize: fontSize.xs,
  },
});

import React from 'react';
import {
  ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fontSize, gradients, radius, shadow, spacing } from '../theme';

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Card({ children, style, glow }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; glow?: boolean }) {
  return <View style={[styles.card, glow && styles.cardGlow, style]}>{children}</View>;
}

export function GradientCard({
  children, style, colors: gradientColors = gradients.primary,
}: { children: React.ReactNode; style?: StyleProp<ViewStyle>; colors?: readonly [string, string, ...string[]] }) {
  return (
    <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.gradientCard, style]}>
      {children}
    </LinearGradient>
  );
}

export function SectionTitle({ children, style, icon }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; icon?: string }) {
  return (
    <View style={[styles.sectionTitleRow, style]}>
      <View style={styles.sectionTitleBar} />
      <Text style={styles.sectionTitle}>{icon ? `${icon}  ` : ''}{children}</Text>
    </View>
  );
}

export function Badge({ label, color = colors.primary }: { label: string; color?: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}2E`, borderColor: `${color}70` }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function StatBlock({
  value, label, color = colors.text, unit,
}: { value: string | number; label: string; color?: string; unit?: string }) {
  return (
    <View style={styles.statBlock}>
      <Text style={[styles.statValue, { color }]}>{value}{unit ? <Text style={styles.statUnit}>{unit}</Text> : null}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, onPress, variant = 'primary', disabled, loading, style }: ButtonProps) {
  const isInverted = variant === 'secondary' || variant === 'ghost';
  const textColor = isInverted ? colors.text : '#fff';

  if (variant === 'primary' && !disabled && !loading) {
    return (
      <Pressable onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [pressed && { opacity: 0.85 }, style]}>
        <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.button, shadow.glow]}>
          <Text style={[styles.buttonText, { color: '#fff' }]}>{title.toUpperCase()}</Text>
        </LinearGradient>
      </Pressable>
    );
  }

  const variantStyle = {
    primary: { backgroundColor: colors.surfaceAlt, opacity: 0.5 },
    secondary: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.borderLight },
    danger: { backgroundColor: colors.danger },
    accent: { backgroundColor: colors.accent },
    ghost: { backgroundColor: 'transparent' },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variantStyle,
        (disabled || loading) && { opacity: 0.45 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.buttonText, { color: variant === 'accent' ? '#0A0A0C' : textColor }]}>{title.toUpperCase()}</Text>
      )}
    </Pressable>
  );
}

export function Input({ style, ...rest }: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.textFaint}
      {...rest}
      // style AFTER {...rest} so callers can't wipe text color / background
      style={[styles.input, style]}
    />
  );
}

export function LoadingView({ label }: { label?: string }) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.primary} size="large" />
      {label ? <Text style={styles.mutedText}>{label}</Text> : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.errorEmoji}>⚠️</Text>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? <Button title="Réessayer" onPress={onRetry} variant="secondary" style={{ marginTop: spacing.lg }} /> : null}
    </View>
  );
}

export function EmptyState({ title, subtitle, icon = '💪' }: { title: string; subtitle?: string; icon?: string }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.mutedText}>{subtitle}</Text> : null}
    </View>
  );
}

export function ProgressBar({ value, color = colors.primary }: { value: number; color?: string }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${clamped * 100}%`, backgroundColor: color, shadowColor: color }]} />
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardGlow: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 14,
  },
  gradientCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.glow,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  sectionTitleBar: {
    width: 4, height: 16, borderRadius: 2, backgroundColor: colors.primary, marginRight: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  statBlock: { alignItems: 'center' },
  statValue: { fontSize: fontSize.xxl, fontWeight: '900', letterSpacing: -0.5 },
  statUnit: { fontSize: fontSize.sm, fontWeight: '700' },
  statLabel: {
    color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2,
  },
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: fontSize.sm, fontWeight: '800', letterSpacing: 0.6 },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  mutedText: { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
  errorEmoji: { fontSize: 40, marginBottom: spacing.sm },
  errorText: { color: colors.danger, textAlign: 'center', fontSize: fontSize.md, fontWeight: '600' },
  emptyIcon: { fontSize: 48, marginBottom: spacing.sm },
  emptyTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: '700', textAlign: 'center' },
  progressTrack: {
    height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: radius.pill,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 6,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
});

import React from 'react';
import {
  ActivityIndicator, Platform, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  colors, fontFamily, fontSize, gradients, radius, shadow, spacing,
} from '../theme';
import { Icon, IconName } from './Icon';

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

/** Carte "Bento" — coins ~24px, bordure fine, pas d'effet néomorphique. */
export function Card({ children, style, glow }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; glow?: boolean }) {
  return (
    <View
      style={[
        styles.card,
        glow && { borderColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.28, shadowRadius: 16 },
        style,
      ]}
    >
      {children}
    </View>
  );
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

/**
 * Surface "verre dépoli" — réservée aux éléments flottants/overlays selon la
 * charte (tab bar, modales, timers flottants). Ne jamais l'utiliser comme
 * fond de carte de contenu classique.
 */
export function GlassView({
  children, style, intensity = 42, tint = 'dark',
}: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; intensity?: number; tint?: 'light' | 'dark' | 'default' }) {
  return (
    <BlurView intensity={intensity} tint={tint} style={[styles.glass, style]}>
      {children}
    </BlurView>
  );
}

export function SectionTitle({ children, style, icon }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; icon?: IconName }) {
  return (
    <View style={[styles.sectionTitleRow, style]}>
      <View style={[styles.sectionTitleBar, { backgroundColor: colors.primary }]} />
      {icon ? <Icon name={icon} size={15} color={colors.text} /> : null}
      <Text style={[styles.sectionTitle, icon && { marginLeft: spacing.xs }]}>{children}</Text>
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
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, onPress, variant = 'primary', disabled, loading, icon, style }: ButtonProps) {
  const isInverted = variant === 'secondary' || variant === 'ghost';
  const textColor = isInverted ? colors.text : '#fff';

  if (variant === 'primary' && !disabled && !loading) {
    return (
      <Pressable onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [pressed && { opacity: 0.85 }, style]}>
        <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.button, shadow.glow, { shadowColor: colors.primary, shadowOpacity: 0.22 }]}>
          <View style={styles.buttonContentRow}>
            {icon ? <Icon name={icon} size={16} color={colors.textOnAccent} /> : null}
            {title ? <Text style={[styles.buttonText, { color: colors.textOnAccent }]}>{title}</Text> : null}
          </View>
        </LinearGradient>
      </Pressable>
    );
  }

  const variantStyle = {
    primary: { backgroundColor: colors.surfaceAlt, opacity: 0.5 },
    secondary: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.borderLight },
    danger: { backgroundColor: colors.danger },
    accent: { backgroundColor: colors.accentSoft, borderWidth: 1.5, borderColor: colors.accent },
    ghost: { backgroundColor: 'transparent' },
  }[variant];

  const finalTextColor = variant === 'accent' ? colors.accent : textColor;

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
        <ActivityIndicator color={finalTextColor} />
      ) : (
        <View style={styles.buttonContentRow}>
          {icon ? <Icon name={icon} size={16} color={finalTextColor} /> : null}
          {title ? <Text style={[styles.buttonText, { color: finalTextColor }]}>{title}</Text> : null}
        </View>
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

/** Compact spinner for card / section async loads (not full-screen). */
export function InlineLoading({
  label,
  style,
}: {
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.inlineLoading, style]}>
      <ActivityIndicator color={colors.primary} />
      {label ? <Text style={styles.mutedText}>{label}</Text> : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.centered}>
      <View style={styles.errorIconWrap}>
        <Icon name="warning" size={28} color={colors.danger} />
      </View>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? <Button title="Réessayer" onPress={onRetry} variant="secondary" style={{ marginTop: spacing.lg }} /> : null}
    </View>
  );
}

export function EmptyState({ title, subtitle, icon = 'flex' }: { title: string; subtitle?: string; icon?: IconName }) {
  return (
    <View style={styles.centered}>
      <View style={styles.emptyIconWrap}>
        <Icon name={icon} size={30} color={colors.textFaint} />
      </View>
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

/** Fond "verre dépoli" pour la tab bar flottante (voir useTabBarStyle). */
export function GlassTabBarBackground() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.glassTabTint]} />
    </View>
  );
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
  gradientCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.glow,
  },
  glass: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...(Platform.OS === 'web' ? { backgroundColor: 'rgba(21, 23, 28, 0.55)' } : null),
  },
  glassTabTint: {
    backgroundColor: Platform.OS === 'web' ? 'rgba(13, 15, 18, 0.72)' : 'rgba(13, 15, 18, 0.38)',
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  sectionTitleBar: {
    width: 4, height: 16, borderRadius: 2, marginRight: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.extrabold,
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
  badgeText: { fontSize: 13, fontFamily: fontFamily.bold, letterSpacing: 0.3 },
  statBlock: { alignItems: 'center' },
  statValue: { fontSize: fontSize.xxl, fontFamily: fontFamily.black, letterSpacing: -0.5 },
  statUnit: { fontSize: fontSize.sm, fontFamily: fontFamily.bold },
  statLabel: {
    color: colors.textMuted, fontSize: fontSize.xs, fontFamily: fontFamily.bold,
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2,
  },
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: fontSize.sm, fontFamily: fontFamily.bold, letterSpacing: 0.2 },
  buttonContentRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
  inlineLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  mutedText: { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
  errorIconWrap: {
    width: 56, height: 56, borderRadius: radius.pill, backgroundColor: colors.dangerSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  errorText: { color: colors.danger, textAlign: 'center', fontSize: fontSize.md, fontWeight: '600' },
  emptyIconWrap: {
    width: 60, height: 60, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
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

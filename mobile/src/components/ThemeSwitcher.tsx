import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import { Card, SectionTitle } from './ui';
import { Icon } from './Icon';
import { fontFamily, fontSize, spacing } from '../theme';

/**
 * Sélecteur de couleur d'accent — disponible côté coach ET athlète (chaque
 * profil peut choisir sa propre teinte, cyan électrique par défaut).
 */
export function ThemeSwitcher() {
  const { accent, setAccent, presets, order } = useAppTheme();

  return (
    <Card style={styles.card}>
      <SectionTitle icon="palette">Apparence</SectionTitle>
      <Text style={styles.hint}>Choisis la couleur d'accent de l'appli.</Text>
      <View style={styles.row}>
        {order.map((key) => {
          const preset = presets[key];
          const active = accent === key;
          return (
            <Pressable
              key={key}
              onPress={() => setAccent(key)}
              style={styles.swatchWrap}
              accessibilityRole="button"
              accessibilityLabel={preset.label}
            >
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: preset.hex },
                  active && { borderColor: '#fff', borderWidth: 3 },
                ]}
              >
                {active ? <Icon name="check" size={18} color={preset.textOn} /> : null}
              </View>
              <Text style={[styles.swatchLabel, active && { color: preset.hex, fontFamily: fontFamily.bold }]} numberOfLines={1}>
                {preset.label.split(' ')[0]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.lg },
  hint: { color: '#9BA0AC', fontSize: fontSize.sm, marginBottom: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  swatchWrap: { alignItems: 'center', width: 64 },
  swatch: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  swatchLabel: {
    color: '#9BA0AC', fontSize: 11, fontFamily: fontFamily.semibold, marginTop: spacing.xs, textAlign: 'center',
  },
});

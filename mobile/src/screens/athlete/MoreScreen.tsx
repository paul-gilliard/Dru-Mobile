import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { Button, Card } from '../../components/ui';
import { colors, fontSize, spacing } from '../../theme';
import { AthleteStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<AthleteStackParamList, 'More'>;

export default function MoreScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation<Nav>();

  const items: { label: string; icon: string; onPress: () => void }[] = [
    { label: 'Performances', icon: '📈', onPress: () => navigation.navigate('Performance') },
    { label: 'Disponibilités', icon: '🗓️', onPress: () => navigation.navigate('Availability') },
    { label: 'Objectifs', icon: '🎯', onPress: () => navigation.navigate('Objectives') },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={styles.name}>{user?.display_name}</Text>
        <Text style={styles.role}>{user?.role === 'coach' ? 'Coach' : 'Athlète'}</Text>
      </Card>

      {items.map((item) => (
        <Pressable key={item.label} onPress={item.onPress}>
          <Card style={styles.menuRow}>
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.chevron}>›</Text>
          </Card>
        </Pressable>
      ))}

      <Button title="Déconnexion" variant="danger" onPress={logout} style={{ marginTop: spacing.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  name: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  role: { color: colors.textMuted, marginTop: spacing.xs },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, paddingVertical: spacing.md,
  },
  menuIcon: { fontSize: 20, marginRight: spacing.md },
  menuLabel: { color: colors.text, fontSize: fontSize.md, flex: 1, fontWeight: '600' },
  chevron: { color: colors.textFaint, fontSize: 22 },
});

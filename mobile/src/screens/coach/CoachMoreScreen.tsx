import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { Button, Card } from '../../components/ui';
import { colors, fontSize, gradients, radius, spacing } from '../../theme';
import { CoachStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<CoachStackParamList, 'Dashboard'>;

const MENU_ITEMS: { label: string; icon: string; screen: 'Users' | 'WeeklyBilan' }[] = [
  { label: 'Utilisateurs', icon: '👥', screen: 'Users' },
  { label: 'Easy Bilan Hebdo', icon: '📈', screen: 'WeeklyBilan' },
];

export default function CoachMoreScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation<Nav>();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card style={styles.profileCard}>
        <LinearGradient colors={gradients.cool} style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.display_name ?? '?').charAt(0).toUpperCase()}</Text>
        </LinearGradient>
        <View>
          <Text style={styles.name}>{user?.display_name}</Text>
          <Text style={styles.role}>🎖️ Coach</Text>
        </View>
      </Card>

      {MENU_ITEMS.map((item) => (
        <Pressable key={item.screen} onPress={() => navigation.navigate(item.screen)}>
          <Card style={styles.menuRow}>
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.chevron}>›</Text>
          </Card>
        </Pressable>
      ))}

      <Button title="Déconnexion" variant="danger" onPress={logout} style={{ marginTop: spacing.md }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  avatar: { width: 56, height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: fontSize.lg },
  name: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  role: { color: colors.textMuted, marginTop: spacing.xs, fontWeight: '600' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  menuIcon: { fontSize: 22 },
  menuLabel: { flex: 1, color: colors.text, fontWeight: '700', fontSize: fontSize.md },
  chevron: { color: colors.textFaint, fontSize: 24 },
});

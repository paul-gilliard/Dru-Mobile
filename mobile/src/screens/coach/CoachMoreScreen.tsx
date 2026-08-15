import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { Button, Card } from '../../components/ui';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';
import { Icon, IconName } from '../../components/Icon';
import { colors, fontFamily, fontSize, gradients, radius, spacing } from '../../theme';
import { TAB_BAR_CLEARANCE } from '../../navigation/useTabBarStyle';
import { CoachStackParamList } from '../../navigation/types';
import { isAdmin, SUBSCRIPTION_LABELS } from '../../utils/roles';

type Nav = NativeStackNavigationProp<CoachStackParamList, 'Dashboard'>;

export default function CoachMoreScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation<Nav>();
  const admin = isAdmin(user);

  const menuItems: { label: string; icon: IconName; screen: 'Users' | 'InviteAthlete' | 'ManageTeam' }[] = admin
    ? [{ label: 'Utilisateurs', icon: 'users', screen: 'Users' }]
    : [
        { label: 'Inviter un athlète', icon: 'plus', screen: 'InviteAthlete' },
        { label: 'Gérer mon équipe', icon: 'users', screen: 'ManageTeam' },
      ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card style={styles.profileCard}>
        <LinearGradient colors={gradients.cool} style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.display_name ?? '?').charAt(0).toUpperCase()}</Text>
        </LinearGradient>
        <View>
          <Text style={styles.name}>{user?.display_name}</Text>
          <View style={styles.roleRow}>
            <Icon name={admin ? 'settings' : 'award'} size={13} color={colors.textMuted} />
            <Text style={styles.role}>{admin ? 'Admin' : 'Coach'}</Text>
          </View>
          {!admin && (
            <Text style={styles.tier}>
              {SUBSCRIPTION_LABELS[user?.subscription_tier ?? 0] ?? ''}
            </Text>
          )}
        </View>
      </Card>

      <ThemeSwitcher />

      {menuItems.map((item) => (
        <Pressable key={item.screen} onPress={() => navigation.navigate(item.screen)}>
          <Card style={styles.menuRow}>
            <Icon name={item.icon} size={20} color={colors.textMuted} />
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Icon name="chevron-right" size={20} color={colors.textFaint} />
          </Card>
        </Pressable>
      ))}

      <Button title="Déconnexion" variant="danger" onPress={logout} style={{ marginTop: spacing.md }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl + TAB_BAR_CLEARANCE },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  avatar: { width: 56, height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontFamily: fontFamily.black, fontSize: fontSize.lg },
  name: { color: colors.text, fontSize: fontSize.lg, fontFamily: fontFamily.extrabold },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  role: { color: colors.textMuted, fontWeight: '600' },
  tier: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: 4 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  menuLabel: { flex: 1, color: colors.text, fontWeight: '700', fontSize: fontSize.md },
});

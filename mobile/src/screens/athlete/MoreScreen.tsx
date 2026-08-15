import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import { Button, Card, SectionTitle } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';
import { colors, fontFamily, fontSize, gradients, radius, spacing } from '../../theme';
import { TAB_BAR_CLEARANCE } from '../../navigation/useTabBarStyle';

export default function MoreScreen() {
  const { user, logout } = useAuth();
  // S'abonner au thème pour que cet écran se re-rende immédiatement au changement d'accent.
  const { accent } = useAppTheme();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card style={styles.profileCard}>
        <LinearGradient key={accent} colors={gradients.primary} style={styles.avatar}>
          <Text style={[styles.avatarText, { color: colors.textOnAccent }]}>{(user?.display_name ?? '?').charAt(0).toUpperCase()}</Text>
        </LinearGradient>
        <View>
          <Text style={styles.name}>{user?.display_name}</Text>
          <View style={styles.roleRow}>
            <Icon name={user?.role === 'coach' ? 'award' : 'flex'} size={13} color={colors.textMuted} />
            <Text style={styles.role}>{user?.role === 'coach' ? 'Coach' : 'Athlète'}</Text>
          </View>
        </View>
      </Card>

      <ThemeSwitcher />

      <Card style={{ marginBottom: spacing.lg }}>
        <SectionTitle icon="info">À propos</SectionTitle>
        <Text style={styles.infoText}>
          Ton coach s'occupe de tes objectifs, de ta régularité et de tes statistiques — retrouve toutes
          tes séances et ton suivi nutrition/journal directement dans les onglets ci-dessous.
        </Text>
      </Card>

      <Button title="Déconnexion" variant="danger" onPress={logout} style={{ marginTop: spacing.md }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl + TAB_BAR_CLEARANCE },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  avatar: { width: 56, height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fontFamily.black, fontSize: fontSize.lg },
  name: { color: colors.text, fontSize: fontSize.lg, fontFamily: fontFamily.extrabold },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  role: { color: colors.textMuted, fontWeight: '600' },
  infoText: { color: colors.textMuted, lineHeight: 20 },
});

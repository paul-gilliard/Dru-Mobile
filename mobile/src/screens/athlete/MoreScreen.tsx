import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { Button, Card, SectionTitle } from '../../components/ui';
import { colors, fontSize, gradients, radius, spacing } from '../../theme';

export default function MoreScreen() {
  const { user, logout } = useAuth();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card style={styles.profileCard}>
        <LinearGradient colors={gradients.primary} style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.display_name ?? '?').charAt(0).toUpperCase()}</Text>
        </LinearGradient>
        <View>
          <Text style={styles.name}>{user?.display_name}</Text>
          <Text style={styles.role}>{user?.role === 'coach' ? '🎖️ Coach' : '💪 Athlète'}</Text>
        </View>
      </Card>

      <Card style={{ marginBottom: spacing.lg }}>
        <SectionTitle icon="ℹ️">À propos</SectionTitle>
        <Text style={styles.infoText}>
          Ton coach s'occupe de tes objectifs, de ta régularité et de tes statistiques — retrouve toutes
          tes séances et ton suivi nutrition/journal directement dans les onglets ci-dessous. 💪
        </Text>
      </Card>

      <Button title="Déconnexion" variant="danger" onPress={logout} style={{ marginTop: spacing.md }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  avatar: { width: 56, height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: fontSize.lg },
  name: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  role: { color: colors.textMuted, marginTop: spacing.xs, fontWeight: '600' },
  infoText: { color: colors.textMuted, lineHeight: 20 },
});

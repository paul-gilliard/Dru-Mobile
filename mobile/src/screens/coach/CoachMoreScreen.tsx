import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { Button, Card } from '../../components/ui';
import { colors, fontSize, gradients, radius, spacing } from '../../theme';

export default function CoachMoreScreen() {
  const { user, logout } = useAuth();

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
      <Button title="Déconnexion" variant="danger" onPress={logout} />
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
});

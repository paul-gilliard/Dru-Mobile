import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Button, Card } from '../../components/ui';
import { colors, fontSize, spacing } from '../../theme';

export default function CoachMoreScreen() {
  const { user, logout } = useAuth();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={styles.name}>{user?.display_name}</Text>
        <Text style={styles.role}>Coach</Text>
      </Card>
      <Button title="Déconnexion" variant="danger" onPress={logout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  name: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  role: { color: colors.textMuted, marginTop: spacing.xs },
});

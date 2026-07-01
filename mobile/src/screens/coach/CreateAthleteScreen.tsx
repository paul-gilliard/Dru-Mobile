import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createAthlete } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { Button, Card, Input, SectionTitle } from '../../components/ui';
import { colors, fontSize, spacing } from '../../theme';
import { CoachStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<CoachStackParamList, 'CreateAthlete'>;

export default function CreateAthleteScreen() {
  const navigation = useNavigation<Nav>();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim() || !password) return;
    setSaving(true);
    setError(null);
    try {
      await createAthlete({ username: username.trim(), password, display_name: displayName.trim() || undefined });
      navigation.goBack();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <SectionTitle icon="👤">Nouvel athlète</SectionTitle>
        <Text style={styles.label}>Nom affiché</Text>
        <Input value={displayName} onChangeText={setDisplayName} placeholder="Ex: Julie Dupont" />

        <Text style={[styles.label, { marginTop: spacing.md }]}>Identifiant de connexion</Text>
        <Input value={username} onChangeText={setUsername} placeholder="ex: julie" autoCapitalize="none" />

        <Text style={[styles.label, { marginTop: spacing.md }]}>Mot de passe</Text>
        <Input value={password} onChangeText={setPassword} placeholder="mot de passe temporaire" secureTextEntry />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title="Créer l'athlète"
          onPress={handleSubmit}
          loading={saving}
          disabled={!username.trim() || !password}
          style={{ marginTop: spacing.lg }}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  label: { color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.xs, fontWeight: '600' },
  error: { color: colors.danger, marginTop: spacing.md },
});

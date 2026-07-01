import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { createUser, deleteUser, listUsers } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { UserDTO } from '../../api/types';
import { Badge, Button, Card, EmptyState, ErrorView, Input, LoadingView, SectionTitle } from '../../components/ui';
import { colors, fontSize, spacing } from '../../theme';

export default function UsersScreen() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'athlete' | 'coach'>('athlete');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setUsers(await listUsers());
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleCreate = async () => {
    if (!username.trim() || !password) return;
    setSaving(true);
    setFormError(null);
    try {
      await createUser({
        username: username.trim(), password, role, display_name: displayName.trim() || undefined,
      });
      setDisplayName(''); setUsername(''); setPassword(''); setRole('athlete');
      await load();
    } catch (err) {
      setFormError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteUser(id);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  if (loading) return <LoadingView label="Chargement des utilisateurs..." />;
  if (error) return <ErrorView message={error} onRetry={load} />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      <Card style={{ marginBottom: spacing.lg }}>
        <SectionTitle icon="👤">Nouvel utilisateur</SectionTitle>
        <Text style={styles.label}>Nom affiché</Text>
        <Input value={displayName} onChangeText={setDisplayName} placeholder="Ex: Julie Dupont" />

        <Text style={[styles.label, { marginTop: spacing.md }]}>Identifiant de connexion</Text>
        <Input value={username} onChangeText={setUsername} placeholder="ex: julie" autoCapitalize="none" />

        <Text style={[styles.label, { marginTop: spacing.md }]}>Mot de passe</Text>
        <Input value={password} onChangeText={setPassword} placeholder="mot de passe temporaire" secureTextEntry />

        <Text style={[styles.label, { marginTop: spacing.md }]}>Rôle</Text>
        <View style={styles.roleRow}>
          <Button
            title="Athlète"
            variant={role === 'athlete' ? 'primary' : 'secondary'}
            onPress={() => setRole('athlete')}
            style={{ flex: 1 }}
          />
          <Button
            title="Coach"
            variant={role === 'coach' ? 'primary' : 'secondary'}
            onPress={() => setRole('coach')}
            style={{ flex: 1 }}
          />
        </View>

        {formError ? <Text style={styles.error}>{formError}</Text> : null}

        <Button
          title="Créer l'utilisateur"
          onPress={handleCreate}
          loading={saving}
          disabled={!username.trim() || !password}
          style={{ marginTop: spacing.lg }}
        />
      </Card>

      <SectionTitle icon="👥">Utilisateurs existants</SectionTitle>
      {users.length === 0 ? (
        <EmptyState icon="👥" title="Aucun utilisateur" />
      ) : (
        users.map((u) => (
          <Card key={u.id} style={styles.userRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{u.display_name}</Text>
              <View style={styles.chipRow}>
                <Badge label={u.username} color={colors.textMuted} />
                <Badge label={u.role === 'coach' ? '🎖️ Coach' : '💪 Athlète'} color={u.role === 'coach' ? colors.secondary : colors.success} />
              </View>
            </View>
            {u.id !== currentUser?.id && (
              <Button title="Suppr." variant="danger" onPress={() => handleDelete(u.id)} style={styles.deleteBtn} />
            )}
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  label: { color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.xs, fontWeight: '600' },
  error: { color: colors.danger, marginTop: spacing.md },
  roleRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, gap: spacing.md },
  userName: { color: colors.text, fontWeight: '800', fontSize: fontSize.md },
  chipRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs, flexWrap: 'wrap' },
  deleteBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
});

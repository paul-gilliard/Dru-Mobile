import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { createUser, deleteUser, listUsers, updateUser } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { UserDTO } from '../../api/types';
import { Badge, Button, Card, EmptyState, ErrorView, Input, LoadingView, SectionTitle } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { colors, fontSize, spacing } from '../../theme';
import { TAB_BAR_CLEARANCE } from '../../navigation/useTabBarStyle';
import { SUBSCRIPTION_LABELS } from '../../utils/roles';

type CreateRole = 'athlete' | 'coach' | 'admin';

async function confirmDelete(u: UserDTO): Promise<boolean> {
  const message = `Supprimer définitivement ${u.display_name} (${u.email || u.username}) ?`;
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' && window.confirm(message);
  }
  return new Promise((resolve) => {
    Alert.alert('Supprimer', message, [
      { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Supprimer', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

export default function UsersScreen() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<CreateRole>('athlete');
  const [tier, setTier] = useState(0);
  const [coachId, setCoachId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const coaches = useMemo(() => users.filter((u) => u.role === 'coach'), [users]);

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
        username: username.trim(),
        password,
        role,
        display_name: displayName.trim() || undefined,
        subscription_tier: role === 'coach' ? tier : undefined,
        coach_id: role === 'athlete' ? coachId : undefined,
      });
      setDisplayName(''); setUsername(''); setPassword(''); setRole('athlete'); setTier(0); setCoachId(null);
      await load();
    } catch (err) {
      setFormError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: UserDTO) => {
    const ok = await confirmDelete(u);
    if (!ok) return;
    setDeletingId(u.id);
    setError(null);
    try {
      await deleteUser(u.id);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (err) {
      const msg = apiErrorMessage(err);
      setError(msg);
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Erreur', msg);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetTier = async (u: UserDTO, nextTier: number) => {
    try {
      await updateUser(u.id, { subscription_tier: nextTier, auto_trim: true });
      await load();
    } catch (err) {
      Alert.alert('Erreur', apiErrorMessage(err));
    }
  };

  const handleAttachCoach = async (athlete: UserDTO, nextCoachId: number | null) => {
    try {
      await updateUser(athlete.id, { coach_id: nextCoachId });
      await load();
    } catch (err) {
      Alert.alert('Erreur', apiErrorMessage(err));
    }
  };

  if (loading) return <LoadingView label="Chargement des utilisateurs..." />;
  if (error && users.length === 0) return <ErrorView message={error} onRetry={load} />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

      <Card style={{ marginBottom: spacing.lg }}>
        <SectionTitle icon="user">Nouvel utilisateur</SectionTitle>
        <Text style={styles.label}>Nom affiché</Text>
        <Input value={displayName} onChangeText={setDisplayName} placeholder="Ex: Julie Dupont" />

        <Text style={[styles.label, { marginTop: spacing.md }]}>
          {role === 'athlete' ? 'Email (connexion)' : 'Identifiant / email'}
        </Text>
        <Input
          value={username}
          onChangeText={setUsername}
          placeholder={role === 'athlete' ? 'ex: julie@mail.com' : 'ex: Superadmin'}
          autoCapitalize="none"
          keyboardType={role === 'athlete' ? 'email-address' : 'default'}
        />

        <Text style={[styles.label, { marginTop: spacing.md }]}>Mot de passe</Text>
        <Input value={password} onChangeText={setPassword} placeholder="mot de passe temporaire" secureTextEntry />

        <Text style={[styles.label, { marginTop: spacing.md }]}>Rôle</Text>
        <View style={styles.roleRow}>
          {(['athlete', 'coach', 'admin'] as CreateRole[]).map((r) => (
            <Button
              key={r}
              title={r === 'athlete' ? 'Athlète' : r === 'coach' ? 'Coach' : 'Admin'}
              variant={role === r ? 'primary' : 'secondary'}
              onPress={() => setRole(r)}
              style={{ flex: 1 }}
            />
          ))}
        </View>

        {role === 'coach' && (
          <>
            <Text style={[styles.label, { marginTop: spacing.md }]}>Abonnement</Text>
            <View style={styles.tierCol}>
              {[0, 1, 2, 3].map((t) => (
                <Button
                  key={t}
                  title={SUBSCRIPTION_LABELS[t]}
                  variant={tier === t ? 'primary' : 'secondary'}
                  onPress={() => setTier(t)}
                  style={{ marginBottom: spacing.xs }}
                />
              ))}
            </View>
          </>
        )}

        {role === 'athlete' && coaches.length > 0 && (
          <>
            <Text style={[styles.label, { marginTop: spacing.md }]}>Rattacher à un coach (optionnel)</Text>
            <View style={styles.tierCol}>
              <Button
                title="Aucun"
                variant={coachId == null ? 'primary' : 'secondary'}
                onPress={() => setCoachId(null)}
                style={{ marginBottom: spacing.xs }}
              />
              {coaches.map((c) => (
                <Button
                  key={c.id}
                  title={c.display_name}
                  variant={coachId === c.id ? 'primary' : 'secondary'}
                  onPress={() => setCoachId(c.id)}
                  style={{ marginBottom: spacing.xs }}
                />
              ))}
            </View>
          </>
        )}

        {formError ? <Text style={styles.error}>{formError}</Text> : null}

        <Button
          title="Créer l'utilisateur"
          onPress={handleCreate}
          loading={saving}
          disabled={!username.trim() || !password}
          style={{ marginTop: spacing.lg }}
        />
      </Card>

      <SectionTitle icon="users">Utilisateurs existants</SectionTitle>
      {users.length === 0 ? (
        <EmptyState icon="users" title="Aucun utilisateur" />
      ) : (
        users.map((u) => (
          <Card key={u.id} style={styles.userRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{u.display_name}</Text>
              <View style={styles.chipRow}>
                <Badge label={u.email || u.username} color={colors.textMuted} />
                <View style={[styles.roleChip, {
                  borderColor: u.role === 'admin' ? colors.gold : u.role === 'coach' ? colors.secondary : colors.success,
                }]}>
                  <Icon
                    name={u.role === 'admin' ? 'settings' : u.role === 'coach' ? 'award' : 'flex'}
                    size={11}
                    color={u.role === 'admin' ? colors.gold : u.role === 'coach' ? colors.secondary : colors.success}
                  />
                  <Text style={[styles.roleChipText, {
                    color: u.role === 'admin' ? colors.gold : u.role === 'coach' ? colors.secondary : colors.success,
                  }]}>
                    {u.role === 'admin' ? 'Admin' : u.role === 'coach' ? 'Coach' : 'Athlète'}
                  </Text>
                </View>
              </View>

              {u.role === 'coach' && (
                <View style={{ marginTop: spacing.sm }}>
                  <Text style={styles.meta}>{SUBSCRIPTION_LABELS[u.subscription_tier ?? 0]}</Text>
                  <View style={styles.miniRow}>
                    {[0, 1, 2, 3].map((t) => (
                      <Button
                        key={t}
                        title={`N${t}`}
                        variant={(u.subscription_tier ?? 0) === t ? 'primary' : 'ghost'}
                        onPress={() => handleSetTier(u, t)}
                        style={styles.miniBtn}
                      />
                    ))}
                  </View>
                </View>
              )}

              {u.role === 'athlete' && (
                <View style={{ marginTop: spacing.sm }}>
                  <Text style={styles.meta}>
                    Coach : {u.coach_name ?? (u.coach_id ? `#${u.coach_id}` : 'aucun')}
                  </Text>
                  <View style={styles.miniRow}>
                    <Button title="Détacher" variant="ghost" onPress={() => handleAttachCoach(u, null)} style={styles.miniBtn} />
                    {coaches.slice(0, 4).map((c) => (
                      <Button
                        key={c.id}
                        title={c.display_name.split(' ')[0]}
                        variant={u.coach_id === c.id ? 'primary' : 'ghost'}
                        onPress={() => handleAttachCoach(u, c.id)}
                        style={styles.miniBtn}
                      />
                    ))}
                  </View>
                </View>
              )}
            </View>
            {u.id !== currentUser?.id && (
              <Button
                title="Suppr."
                variant="danger"
                loading={deletingId === u.id}
                disabled={deletingId != null}
                onPress={() => handleDelete(u)}
                style={styles.deleteBtn}
              />
            )}
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl + TAB_BAR_CLEARANCE },
  label: { color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.xs, fontWeight: '600' },
  error: { color: colors.danger, marginTop: spacing.md },
  errorBanner: { color: colors.danger, marginBottom: spacing.md, fontWeight: '600' },
  roleRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  tierCol: { marginTop: spacing.xs },
  userRow: { marginBottom: spacing.md, gap: spacing.md },
  userName: { color: colors.text, fontWeight: '800', fontSize: fontSize.md },
  chipRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs, flexWrap: 'wrap' },
  roleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 999, borderWidth: 1.5,
  },
  roleChipText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  deleteBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, alignSelf: 'flex-start' },
  meta: { color: colors.textFaint, fontSize: fontSize.xs, marginBottom: spacing.xs },
  miniRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  miniBtn: { paddingVertical: 4, paddingHorizontal: spacing.sm },
});

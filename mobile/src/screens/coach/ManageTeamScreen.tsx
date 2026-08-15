import React, { useCallback, useState } from 'react';
import { Alert, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { listAthletes, unlinkAthlete } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { UserDTO } from '../../api/types';
import { Button, Card, EmptyState, ErrorView, LoadingView, SectionTitle } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { colors, fontSize, spacing } from '../../theme';
import { TAB_BAR_CLEARANCE } from '../../navigation/useTabBarStyle';

async function confirmUnlink(name: string): Promise<boolean> {
  const message = `${name} gardera ses programmes et plans alimentaires, mais ne sera plus associé à toi.`;
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' && window.confirm(`Retirer de mon équipe ?\n\n${message}`);
  }
  return new Promise((resolve) => {
    Alert.alert('Retirer de mon équipe', message, [
      { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Retirer', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

export default function ManageTeamScreen() {
  const [athletes, setAthletes] = useState<UserDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setAthletes(await listAthletes());
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleUnlink = async (athlete: UserDTO) => {
    const ok = await confirmUnlink(athlete.display_name);
    if (!ok) return;
    setBusyId(athlete.id);
    setError(null);
    try {
      await unlinkAthlete(athlete.id);
      setAthletes((prev) => prev.filter((a) => a.id !== athlete.id));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <LoadingView label="Chargement de l'équipe..." />;
  if (error && athletes.length === 0) return <ErrorView message={error} onRetry={load} />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      <Card style={{ marginBottom: spacing.lg }}>
        <SectionTitle icon="users">Mon équipe</SectionTitle>
        <Text style={styles.hint}>
          Retire un athlète de ton équipe. Il conserve ses programmes et plans alimentaires.
        </Text>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {athletes.length === 0 ? (
        <EmptyState
          icon="users"
          title="Aucun athlète"
          subtitle="Invite un athlète depuis le menu Plus pour constituer ton équipe."
        />
      ) : (
        athletes.map((athlete) => (
          <Card key={athlete.id} style={styles.row}>
            <View style={styles.rowMain}>
              <Icon name="user" size={18} color={colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{athlete.display_name}</Text>
                <Text style={styles.username}>{athlete.email || athlete.username}</Text>
              </View>
            </View>
            <Button
              title="Retirer"
              variant="danger"
              loading={busyId === athlete.id}
              disabled={busyId != null}
              onPress={() => handleUnlink(athlete)}
              style={styles.unlinkBtn}
            />
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl + TAB_BAR_CLEARANCE },
  hint: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20, marginTop: spacing.sm },
  error: { color: colors.danger, marginBottom: spacing.md, fontWeight: '600' },
  row: { marginBottom: spacing.md, gap: spacing.md },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { color: colors.text, fontWeight: '800', fontSize: fontSize.md },
  username: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: 2 },
  unlinkBtn: { alignSelf: 'stretch' },
});

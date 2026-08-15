import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { inviteAthlete, searchAthletes } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { UserDTO } from '../../api/types';
import { Button, Card, EmptyState, Input, SectionTitle } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { colors, fontSize, spacing } from '../../theme';
import { TAB_BAR_CLEARANCE } from '../../navigation/useTabBarStyle';
import { CoachStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<CoachStackParamList, 'InviteAthlete'>;

export default function InviteAthleteScreen() {
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserDTO[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitingId, setInvitingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    const q = query.trim();
    if (q.length < 2) {
      setError('Saisis au moins 2 caractères');
      return;
    }
    setSearching(true);
    setError(null);
    try {
      setResults(await searchAthletes(q));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSearching(false);
    }
  };

  const handleInvite = async (athlete: UserDTO) => {
    setInvitingId(athlete.id);
    setError(null);
    try {
      await inviteAthlete(athlete.id);
      Alert.alert('Invitation envoyée', `${athlete.display_name} a reçu ta demande de coaching.`);
      navigation.goBack();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setInvitingId(null);
    }
  };

  return (
    <View style={styles.screen}>
      <Card style={{ marginBottom: spacing.lg }}>
        <SectionTitle icon="search">Inviter un athlète</SectionTitle>
        <Text style={styles.hint}>
          Cherche un athlète déjà inscrit (par nom ou adresse email). Il devra accepter l'invitation depuis son accueil.
        </Text>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="ex: julie@mail.com"
          autoCapitalize="none"
          keyboardType="email-address"
          style={{ marginTop: spacing.md }}
        />
        <Button
          title="Rechercher"
          onPress={handleSearch}
          loading={searching}
          style={{ marginTop: spacing.md }}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      {results.length === 0 ? (
        <EmptyState icon="users" title="Aucun résultat" subtitle="Les athlètes déjà coachés n'apparaissent pas." />
      ) : (
        results.map((a) => (
          <Card key={a.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{a.display_name}</Text>
              <Text style={styles.username}>{a.email || a.username}</Text>
            </View>
            <Button
              title="Inviter"
              icon="plus"
              onPress={() => handleInvite(a)}
              loading={invitingId === a.id}
              style={styles.inviteBtn}
            />
          </Card>
        ))
      )}
      <Pressable onPress={() => navigation.goBack()} style={styles.back}>
        <Icon name="chevron-left" size={16} color={colors.textMuted} />
        <Text style={styles.backText}>Retour</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, paddingBottom: spacing.xxl + TAB_BAR_CLEARANCE },
  hint: { color: colors.textFaint, fontSize: fontSize.sm, lineHeight: 18 },
  error: { color: colors.danger, marginTop: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  name: { color: colors.text, fontWeight: '800', fontSize: fontSize.md },
  username: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
  inviteBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.lg },
  backText: { color: colors.textMuted, fontWeight: '600' },
});

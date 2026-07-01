import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getCoachDashboard } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { AthleteSummaryDTO } from '../../api/types';
import { Badge, Button, Card, EmptyState, ErrorView, LoadingView, SectionTitle } from '../../components/ui';
import { colors, fontSize, spacing } from '../../theme';
import { CoachStackParamList } from '../../navigation/types';
import { formatDateFR } from '../../utils/format';

type Nav = NativeStackNavigationProp<CoachStackParamList, 'Dashboard'>;

export default function CoachDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const [athletes, setAthletes] = useState<AthleteSummaryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await getCoachDashboard();
      setAthletes(data.athletes);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <LoadingView label="Chargement des athlètes..." />;
  if (error) return <ErrorView message={error} onRetry={load} />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      <View style={styles.headerRow}>
        <SectionTitle style={{ marginBottom: 0 }}>Mes athlètes ({athletes.length})</SectionTitle>
        <Button title="+ Ajouter" variant="secondary" onPress={() => navigation.navigate('CreateAthlete')} />
      </View>

      {athletes.length === 0 ? (
        <EmptyState title="Aucun athlète" subtitle="Ajoute ton premier athlète pour commencer." />
      ) : (
        athletes.map(({ athlete, last_journal_date, objectives_count, programs_count }) => (
          <View key={athlete.id} onTouchEnd={() => navigation.navigate('AthleteDetail', { athleteId: athlete.id, athleteName: athlete.display_name })}>
            <Card style={styles.athleteCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{athlete.display_name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.athleteName}>{athlete.display_name}</Text>
                <View style={styles.chipRow}>
                  <Badge label={`${programs_count} programme${programs_count > 1 ? 's' : ''}`} />
                  <Badge label={`${objectives_count} objectif${objectives_count > 1 ? 's' : ''}`} color={colors.success} />
                </View>
                <Text style={styles.lastJournal}>
                  {last_journal_date ? `Journal : ${formatDateFR(last_journal_date)}` : 'Aucun journal rempli'}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Card>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  athleteCard: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, gap: spacing.md },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: fontSize.md },
  athleteName: { color: colors.text, fontWeight: '700', fontSize: fontSize.md },
  chipRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs, flexWrap: 'wrap' },
  lastJournal: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: spacing.xs },
  chevron: { color: colors.textFaint, fontSize: 24 },
});

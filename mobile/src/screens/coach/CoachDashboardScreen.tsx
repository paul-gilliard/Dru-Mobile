import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { getCoachDashboard } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { AthleteSummaryDTO } from '../../api/types';
import { Badge, Button, Card, EmptyState, ErrorView, LoadingView, SectionTitle } from '../../components/ui';
import { colors, fontSize, gradients, radius, spacing } from '../../theme';
import { CoachStackParamList } from '../../navigation/types';
import { formatDateFR, todayISO } from '../../utils/format';

type Nav = NativeStackNavigationProp<CoachStackParamList, 'Dashboard'>;

const AVATAR_GRADIENTS = [gradients.primary, gradients.cool, gradients.fire, gradients.success];

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

  const activeToday = athletes.filter((a) => a.last_journal_date === todayISO()).length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      <Text style={styles.pageTitle}>Ton équipe 💪</Text>

      <View style={styles.summaryRow}>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{athletes.length}</Text>
          <Text style={styles.summaryLabel}>Athlètes</Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: colors.success }]}>{activeToday}</Text>
          <Text style={styles.summaryLabel}>Actifs aujourd'hui</Text>
        </Card>
      </View>

      <View style={styles.headerRow}>
        <SectionTitle style={{ marginBottom: 0 }}>Mes athlètes</SectionTitle>
        <Button title="+ Ajouter" variant="secondary" onPress={() => navigation.navigate('CreateAthlete')} />
      </View>

      {athletes.length === 0 ? (
        <EmptyState icon="👥" title="Aucun athlète" subtitle="Ajoute ton premier athlète pour commencer." />
      ) : (
        athletes.map(({ athlete, last_journal_date, objectives_count, programs_count }, idx) => {
          const isActiveToday = last_journal_date === todayISO();
          return (
            <Pressable key={athlete.id} onPress={() => navigation.navigate('AthleteDetail', { athleteId: athlete.id, athleteName: athlete.display_name })}>
              <Card style={styles.athleteCard}>
                <LinearGradient colors={AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]} style={styles.avatar}>
                  <Text style={styles.avatarText}>{athlete.display_name.charAt(0).toUpperCase()}</Text>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.athleteName}>{athlete.display_name}</Text>
                    {isActiveToday && <View style={styles.liveDot} />}
                  </View>
                  <View style={styles.chipRow}>
                    <Badge label={`${programs_count} prog.`} />
                    <Badge label={`${objectives_count} objectif${objectives_count > 1 ? 's' : ''}`} color={colors.success} />
                  </View>
                  <Text style={styles.lastJournal}>
                    {last_journal_date ? `Journal : ${formatDateFR(last_journal_date)}` : 'Aucun journal rempli'}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Card>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  pageTitle: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '900', marginBottom: spacing.lg },
  summaryRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  summaryCard: { flex: 1, alignItems: 'center', paddingVertical: spacing.lg },
  summaryValue: { color: colors.primary, fontSize: 30, fontWeight: '900' },
  summaryLabel: {
    color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '700', marginTop: spacing.xs,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  athleteCard: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, gap: spacing.md },
  avatar: {
    width: 48, height: 48, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: fontSize.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  athleteName: { color: colors.text, fontWeight: '800', fontSize: fontSize.md },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  chipRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs, flexWrap: 'wrap' },
  lastJournal: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: spacing.xs, fontWeight: '600' },
  chevron: { color: colors.textFaint, fontSize: 24 },
});

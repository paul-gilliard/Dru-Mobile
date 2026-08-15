import React, { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { getCoachDashboard, resolveCoachQuota, TTL } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { CoachDashboardDTO } from '../../api/types';
import { Badge, Button, Card, EmptyState, ErrorView, LoadingView, SectionTitle } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { colors, fontFamily, fontSize, gradients, radius, spacing } from '../../theme';
import { TAB_BAR_CLEARANCE } from '../../navigation/useTabBarStyle';
import { CoachStackParamList } from '../../navigation/types';
import { formatDateFR, todayISO } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import { isAdmin, isCoach, SUBSCRIPTION_LABELS } from '../../utils/roles';
import { cacheGetSync, cachePeekSync } from '../../utils/apiCache';

type Nav = NativeStackNavigationProp<CoachStackParamList, 'Dashboard'>;

const AVATAR_GRADIENTS = [gradients.primary, gradients.cool, gradients.fire, gradients.success];

export default function CoachDashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const cached = cacheGetSync<CoachDashboardDTO>('dashboard:coach', TTL.dashboard)
    ?? cachePeekSync<CoachDashboardDTO>('dashboard:coach')?.data
    ?? null;
  const [dashboard, setDashboard] = useState<CoachDashboardDTO | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keepIds, setKeepIds] = useState<number[]>(
    cached?.over_quota && cached.athlete_limit != null
      ? cached.athletes.slice(0, cached.athlete_limit).map((a) => a.athlete.id)
      : [],
  );
  const [resolving, setResolving] = useState(false);
  const hasDataRef = React.useRef(!!cached);

  const athletes = dashboard?.athletes ?? [];
  const limit = dashboard?.athlete_limit ?? null;
  const overQuota = !!dashboard?.over_quota;

  const load = useCallback(async (force = false) => {
    if (!hasDataRef.current) setLoading(true);
    else if (force) setRefreshing(true);
    try {
      setError(null);
      const data = await getCoachDashboard();
      hasDataRef.current = true;
      setDashboard(data);
      if (data.over_quota && data.athlete_limit != null) {
        setKeepIds(data.athletes.slice(0, data.athlete_limit).map((a) => a.athlete.id));
      }
    } catch (err) {
      if (!hasDataRef.current) setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(false); }, [load]));

  const toggleKeep = (id: number) => {
    if (limit == null) return;
    setKeepIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= limit) return prev;
      return [...prev, id];
    });
  };

  const handleResolveQuota = async () => {
    if (limit == null) return;
    if (keepIds.length !== limit) {
      Alert.alert('Sélection incomplète', `Choisis exactement ${limit} athlète(s) à garder.`);
      return;
    }
    setResolving(true);
    try {
      await resolveCoachQuota(keepIds);
      await load(true);
    } catch (err) {
      Alert.alert('Erreur', apiErrorMessage(err));
    } finally {
      setResolving(false);
    }
  };

  if (loading && !dashboard) return <LoadingView label="Chargement des athlètes..." />;
  if (error && !dashboard) return <ErrorView message={error} onRetry={() => void load(true)} />;

  const activeToday = athletes.filter((a) => a.last_journal_date === todayISO()).length;
  const tierLabel = isCoach(user)
    ? SUBSCRIPTION_LABELS[dashboard?.subscription_tier ?? 0] ?? 'Abonnement'
    : 'Admin — accès complet';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true); }} tintColor={colors.primary} />}
    >
      <Text style={styles.pageTitle}>{isAdmin(user) ? 'Tous les athlètes' : 'Ton équipe'}</Text>
      <Text style={styles.tierHint}>{tierLabel}</Text>

      {overQuota && isCoach(user) && (
        <Card style={styles.quotaCard}>
          <SectionTitle icon="warning">Quota dépassé</SectionTitle>
          <Text style={styles.quotaText}>
            Tu as {athletes.length} athlètes pour une limite de {limit}. Sélectionne ceux à garder
            ({keepIds.length}/{limit}). Les autres seront détachés (leurs données restent).
          </Text>
          {athletes.map(({ athlete }) => {
            const selected = keepIds.includes(athlete.id);
            return (
              <Pressable key={athlete.id} onPress={() => toggleKeep(athlete.id)} style={styles.quotaRow}>
                <Icon name={selected ? 'check-circle' : 'circle'} size={18} color={selected ? colors.success : colors.textFaint} />
                <Text style={styles.quotaName}>{athlete.display_name}</Text>
              </Pressable>
            );
          })}
          <Button title="Valider ma sélection" onPress={handleResolveQuota} loading={resolving} style={{ marginTop: spacing.md }} />
        </Card>
      )}

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

      <SectionTitle>Mes athlètes</SectionTitle>

      {athletes.length === 0 ? (
        <EmptyState
          icon="users"
          title="Aucun athlète"
          subtitle={isCoach(user) ? 'Invite un athlète depuis Plus → Inviter un athlète.' : 'Aucun athlète sur la plateforme.'}
        />
      ) : (
        athletes.map(({ athlete, last_journal_date, objectives_count, programs_count }, idx) => {
          const isActiveToday = last_journal_date === todayISO();
          return (
            <Card key={athlete.id} style={styles.athleteCard}>
              <Pressable
                style={styles.athleteMain}
                onPress={() => navigation.navigate('AthleteDetail', { athleteId: athlete.id, athleteName: athlete.display_name })}
              >
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
                <Icon name="chevron-right" size={20} color={colors.textFaint} />
              </Pressable>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl + TAB_BAR_CLEARANCE },
  pageTitle: { color: colors.text, fontSize: fontSize.xl, fontFamily: fontFamily.extrabold, marginBottom: spacing.xs },
  tierHint: { color: colors.textFaint, fontSize: fontSize.sm, marginBottom: spacing.lg },
  summaryRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  summaryCard: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  summaryValue: { color: colors.text, fontSize: 28, fontFamily: fontFamily.black },
  summaryLabel: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '700', marginTop: 4 },
  athleteCard: { marginBottom: spacing.md },
  athleteMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontFamily: fontFamily.black, fontSize: fontSize.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  athleteName: { color: colors.text, fontWeight: '800', fontSize: fontSize.md },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  lastJournal: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: spacing.xs },
  quotaCard: { marginBottom: spacing.lg, borderColor: colors.warning, borderWidth: 1 },
  quotaText: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 18, marginBottom: spacing.md },
  quotaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  quotaName: { color: colors.text, fontWeight: '700' },
});

import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { acceptInvitation, getAthleteDashboard, refuseInvitation, TTL } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { AthleteDashboardDTO, CoachingInvitationDTO } from '../../api/types';
import { Badge, Button, Card, EmptyState, ErrorView, LoadingView, SectionTitle } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { colors, fontFamily, fontSize, gradients, radius, shadow, spacing } from '../../theme';
import { AthleteStackParamList } from '../../navigation/types';
import { DAY_NAMES, DAY_NAMES_SHORT } from '../../utils/format';
import { TAB_BAR_CLEARANCE } from '../../navigation/useTabBarStyle';
import { cacheGetSync, cachePeekSync } from '../../utils/apiCache';

type Nav = NativeStackNavigationProp<AthleteStackParamList, 'Home'>;

export default function HomeScreen() {
  const { user, refreshUser } = useAuth();
  const navigation = useNavigation<Nav>();
  const cached = cacheGetSync<AthleteDashboardDTO>('dashboard:athlete', TTL.dashboard)
    ?? cachePeekSync<AthleteDashboardDTO>('dashboard:athlete')?.data
    ?? null;
  const [data, setData] = useState<AthleteDashboardDTO | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState<number | null>(null);
  const hasDataRef = React.useRef(!!cached);

  const load = useCallback(async (force = false) => {
    if (!hasDataRef.current) setLoading(true);
    else if (force) setRefreshing(true);
    try {
      setError(null);
      const dashboard = await getAthleteDashboard();
      hasDataRef.current = true;
      setData(dashboard);
    } catch (err) {
      if (!hasDataRef.current) setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(false); }, [load]));

  const handleAccept = async (inv: CoachingInvitationDTO) => {
    setInviteBusy(inv.id);
    try {
      await acceptInvitation(inv.id);
      await refreshUser();
      await load(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setInviteBusy(null);
    }
  };

  const handleRefuse = async (inv: CoachingInvitationDTO) => {
    setInviteBusy(inv.id);
    try {
      await refuseInvitation(inv.id);
      await load(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setInviteBusy(null);
    }
  };

  if (loading && !data) return <LoadingView label="Chargement du tableau de bord..." />;
  if (error && !data) return <ErrorView message={error} onRetry={() => void load(true)} />;
  if (!data) return null;

  const firstName = (user?.display_name ?? '').split(' ')[0];
  const pending = data.pending_invitations ?? [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true); }} tintColor={colors.primary} />}
    >
      {/* Header — identité de marque + accès rapide au profil */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.brand}>DRU</Text>
          <Text style={styles.greeting}>Salut {firstName}</Text>
          {data.coach_name ? <Text style={styles.coachLine}>Coach : {data.coach_name}</Text> : null}
        </View>
        <Pressable onPress={() => navigation.getParent()?.navigate('MoreTab' as never)}>
          <LinearGradient colors={gradients.primary} style={styles.avatar}>
            <Text style={[styles.avatarText, { color: colors.textOnAccent }]}>{(user?.display_name ?? '?').charAt(0).toUpperCase()}</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {pending.length > 0 && (
        <Card style={styles.inviteCard}>
          <SectionTitle icon="award">Invitations de coaching</SectionTitle>
          {pending.map((inv) => (
            <View key={inv.id} style={styles.inviteRow}>
              <Text style={styles.inviteText}>
                <Text style={{ fontWeight: '800' }}>{inv.coach_name}</Text> souhaite te coacher.
              </Text>
              <View style={styles.inviteActions}>
                <Button
                  title="Accepter"
                  onPress={() => handleAccept(inv)}
                  loading={inviteBusy === inv.id}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Refuser"
                  variant="secondary"
                  onPress={() => handleRefuse(inv)}
                  disabled={inviteBusy === inv.id}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ))}
        </Card>
      )}

      {/* Hero Bento — séance du jour */}
      {data.today_session ? (
        <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.heroCard, shadow.glow, { shadowColor: colors.primary }]}>
          <View style={styles.heroGlow} pointerEvents="none" />
          <Text style={styles.dateKicker}>{DAY_NAMES[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]}</Text>
          <View style={styles.heroLabelRow}>
            <Icon name="flame" size={13} color="rgba(255,255,255,0.9)" />
            <Text style={styles.heroLabel}>Séance du jour</Text>
          </View>
          {data.program?.name ? <Text style={styles.heroProgram}>{data.program.name}</Text> : null}
          <Text style={styles.heroTitle}>{data.today_session.session_name}</Text>
          <View style={styles.chipRow}>
            {data.today_session.exercises.slice(0, 5).map((ex) => (
              <View key={ex.id} style={styles.heroChip}>
                <Text style={styles.heroChipText}>{ex.name}</Text>
              </View>
            ))}
          </View>
          <Button
            title="Attaquer la séance"
            variant="secondary"
            onPress={() => navigation.navigate('SessionDetail', { sessionId: data.today_session!.id })}
            style={{ marginTop: spacing.lg, backgroundColor: 'rgba(0,0,0,0.3)', borderColor: 'rgba(255,255,255,0.3)' }}
          />
        </LinearGradient>
      ) : (
        <Card style={styles.restCard}>
          <View style={styles.restIconWrap}>
            <Icon name="moon" size={26} color={colors.textMuted} />
          </View>
          <Text style={styles.restTitle}>Repos aujourd'hui</Text>
          <Text style={styles.mutedText}>Pas de séance programmée. Récupération = progression.</Text>
        </Card>
      )}

      {/* Bento pair — métriques du jour, chiffres XL en Inter Black */}
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          {data.has_logged_today ? (
            <Icon name="check-circle" size={30} color={colors.success} />
          ) : (
            <Text style={[styles.statBig, { color: colors.textFaint }]}>—</Text>
          )}
          <Text style={styles.statLabel}>Journal du jour</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statBig, { color: colors.gold }]}>{data.objectives.length}</Text>
          <Text style={styles.statLabel}>Objectifs actifs</Text>
        </Card>
      </View>

      {data.week_sessions.length > 0 && (
        <Card style={{ marginTop: spacing.lg }}>
          <SectionTitle icon="calendar">
            Ma semaine{data.program?.name ? ` — ${data.program.name}` : ''}
          </SectionTitle>
          {data.week_sessions.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => navigation.navigate('SessionDetail', { sessionId: s.id })}
              style={[styles.weekRow, s.is_today && { backgroundColor: colors.primarySoft, marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg, borderTopColor: 'transparent' }]}
            >
              <View style={styles.weekDayBadge}>
                <Text style={[styles.weekDayBadgeText, s.is_today && { color: colors.primary }]}>
                  {DAY_NAMES_SHORT[s.day_of_week]}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.weekSessionName}>{s.session_name ?? 'Séance'}</Text>
                <Text style={styles.mutedText}>
                  {s.exercise_count} exercice{s.exercise_count > 1 ? 's' : ''}
                  {s.last_logged_date ? ` · dernier log le ${s.last_logged_date.split('-').reverse().join('/')}` : ' · jamais loggée'}
                </Text>
              </View>
              {s.is_today ? (
                <View style={[styles.weekCta, styles.weekCtaRow, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.weekCtaText, { color: colors.textOnAccent }]}>Attaquer</Text>
                  <Icon name="chevron-right" size={14} color={colors.textOnAccent} />
                </View>
              ) : (
                <View style={styles.weekCtaRow}>
                  <Text style={styles.chevronMuted}>Attaquer</Text>
                  <Icon name="chevron-right" size={14} color={colors.textFaint} />
                </View>
              )}
            </Pressable>
          ))}
        </Card>
      )}

      <Card style={{ marginTop: spacing.lg }}>
        <SectionTitle icon="journal">Journal du jour</SectionTitle>
        {data.has_logged_today ? (
          <View style={styles.okRow}>
            <Icon name="check-circle" size={16} color={colors.success} />
            <Text style={styles.okText}>Nickel, journal rempli aujourd'hui</Text>
          </View>
        ) : (
          <Text style={styles.mutedText}>Tu n'as pas encore rempli ton journal aujourd'hui.</Text>
        )}
        <Button
          title={data.has_logged_today ? 'Modifier le journal' : 'Remplir le journal'}
          variant="secondary"
          onPress={() => navigation.getParent()?.navigate('JournalTab' as never)}
          style={{ marginTop: spacing.md }}
        />
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <SectionTitle icon="target">Objectifs en cours</SectionTitle>
        {data.objectives.length === 0 ? (
          <EmptyState icon="target" title="Aucun objectif défini" subtitle="Ton coach peut t'en fixer un." />
        ) : (
          data.objectives.map((o) => (
            <View key={o.id} style={styles.objectiveRow}>
              <View style={styles.objectiveDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.objectiveTitle}>{o.title}</Text>
                {o.description ? <Text style={styles.mutedText}>{o.description}</Text> : null}
              </View>
            </View>
          ))
        )}
      </Card>

      {data.program && (
        <Card style={{ marginTop: spacing.lg, marginBottom: spacing.lg }}>
          <SectionTitle icon="program">Programme actuel</SectionTitle>
          <View style={styles.programRow}>
            <Text style={styles.sessionName}>{data.program.name}</Text>
            <Badge label="ACTIF" color={colors.success} />
          </View>
          <Button
            title="Voir tout le programme"
            variant="secondary"
            onPress={() => navigation.navigate('Program')}
            style={{ marginTop: spacing.md }}
          />
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl + TAB_BAR_CLEARANCE },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  brand: {
    color: colors.textFaint, fontSize: 11, fontFamily: fontFamily.extrabold,
    textTransform: 'uppercase', letterSpacing: 3,
  },
  greeting: { color: colors.text, fontSize: fontSize.xxl, fontFamily: fontFamily.black, marginTop: 2 },
  coachLine: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: 2 },
  inviteCard: { marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.primary },
  inviteRow: { marginBottom: spacing.md },
  inviteText: { color: colors.text, marginBottom: spacing.sm, lineHeight: 20 },
  inviteActions: { flexDirection: 'row', gap: spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fontFamily.black, fontSize: fontSize.md },
  heroCard: { borderRadius: radius.lg, padding: spacing.lg, overflow: 'hidden' },
  heroGlow: {
    position: 'absolute', top: -60, right: -40, width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  dateKicker: {
    color: 'rgba(255,255,255,0.7)', fontSize: 11, fontFamily: fontFamily.extrabold,
    textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4,
  },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroLabel: { color: 'rgba(255,255,255,0.9)', fontSize: fontSize.xs, fontFamily: fontFamily.extrabold, letterSpacing: 1, textTransform: 'uppercase' },
  heroProgram: { color: 'rgba(255,255,255,0.75)', fontSize: fontSize.xs, fontFamily: fontFamily.semibold, marginTop: 4 },
  heroTitle: { color: '#fff', fontSize: fontSize.xl, fontFamily: fontFamily.black, marginTop: spacing.xs, marginBottom: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  heroChip: { backgroundColor: 'rgba(0,0,0,0.25)', paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.pill },
  heroChipText: { color: '#fff', fontSize: fontSize.xs, fontFamily: fontFamily.bold },
  restCard: { alignItems: 'center', paddingVertical: spacing.xl },
  restIconWrap: {
    width: 56, height: 56, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  restTitle: { color: colors.text, fontSize: fontSize.lg, fontFamily: fontFamily.extrabold },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: spacing.lg },
  statBig: { fontSize: 32, fontFamily: fontFamily.black },
  statLabel: {
    color: colors.textMuted, fontSize: fontSize.xs, fontFamily: fontFamily.bold, marginTop: spacing.xs,
    textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center',
  },
  mutedText: { color: colors.textMuted },
  okRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  okText: { color: colors.success, fontWeight: '700' },
  objectiveRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm, gap: spacing.sm },
  objectiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold, marginTop: 6 },
  objectiveTitle: { color: colors.text, fontWeight: '700' },
  programRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionName: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  weekRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  weekDayBadge: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceHi,
    alignItems: 'center', justifyContent: 'center',
  },
  weekDayBadgeText: { color: colors.textMuted, fontWeight: '800', fontSize: fontSize.xs, textTransform: 'uppercase' },
  weekSessionName: { color: colors.text, fontWeight: '700', fontSize: fontSize.sm },
  weekCta: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.pill },
  weekCtaRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  weekCtaText: { fontWeight: '800', fontSize: fontSize.xs },
  chevronMuted: { color: colors.textFaint, fontWeight: '700', fontSize: fontSize.xs },
});

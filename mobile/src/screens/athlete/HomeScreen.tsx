import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { getAthleteDashboard } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { AthleteDashboardDTO } from '../../api/types';
import { Badge, Button, Card, EmptyState, ErrorView, LoadingView, SectionTitle } from '../../components/ui';
import { colors, fontSize, gradients, muscleColors, radius, shadow, spacing } from '../../theme';
import { AthleteStackParamList } from '../../navigation/types';
import { DAY_NAMES } from '../../utils/format';

type Nav = NativeStackNavigationProp<AthleteStackParamList, 'Home'>;

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation<Nav>();
  const [data, setData] = useState<AthleteDashboardDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const dashboard = await getAthleteDashboard();
      setData(dashboard);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <LoadingView label="Chargement du tableau de bord..." />;
  if (error) return <ErrorView message={error} onRetry={load} />;
  if (!data) return null;

  const firstName = (user?.display_name ?? '').split(' ')[0];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.dateText}>{DAY_NAMES[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]}</Text>
          <Text style={styles.greeting}>Salut {firstName} 💪</Text>
        </View>
        <Button title="⏻" variant="ghost" onPress={logout} style={styles.logoutBtn} />
      </View>

      {data.today_session ? (
        <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.heroCard, shadow.glow]}>
          <Text style={styles.heroLabel}>🔥 SÉANCE DU JOUR</Text>
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
            style={{ marginTop: spacing.lg, backgroundColor: 'rgba(0,0,0,0.28)', borderColor: 'rgba(255,255,255,0.3)' }}
          />
        </LinearGradient>
      ) : (
        <Card style={styles.restCard}>
          <Text style={styles.restEmoji}>😴</Text>
          <Text style={styles.restTitle}>Repos aujourd'hui</Text>
          <Text style={styles.mutedText}>Pas de séance programmée. Récupération = progression 🧘</Text>
        </Card>
      )}

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={[styles.statBig, { color: data.has_logged_today ? colors.success : colors.textFaint }]}>
            {data.has_logged_today ? '✓' : '—'}
          </Text>
          <Text style={styles.statLabel}>Journal du jour</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statBig, { color: colors.gold }]}>{data.objectives.length}</Text>
          <Text style={styles.statLabel}>Objectifs actifs</Text>
        </Card>
      </View>

      <Card style={{ marginTop: spacing.lg }}>
        <SectionTitle icon="📓">Journal du jour</SectionTitle>
        {data.has_logged_today ? (
          <Text style={styles.okText}>✓ Nickel, journal rempli aujourd'hui</Text>
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
        <SectionTitle icon="🎯">Objectifs en cours</SectionTitle>
        {data.objectives.length === 0 ? (
          <EmptyState icon="🎯" title="Aucun objectif défini" subtitle="Ton coach peut t'en fixer un." />
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
          <SectionTitle icon="🏋️">Programme actuel</SectionTitle>
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
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  dateText: {
    color: colors.textFaint, fontSize: fontSize.xs, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  greeting: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '900', marginTop: 2 },
  logoutBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  heroCard: { borderRadius: radius.lg, padding: spacing.lg },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: fontSize.xs, fontWeight: '800', letterSpacing: 1 },
  heroTitle: { color: '#fff', fontSize: fontSize.xl, fontWeight: '900', marginTop: spacing.xs, marginBottom: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  heroChip: { backgroundColor: 'rgba(0,0,0,0.25)', paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.pill },
  heroChipText: { color: '#fff', fontSize: fontSize.xs, fontWeight: '700' },
  restCard: { alignItems: 'center', paddingVertical: spacing.xl },
  restEmoji: { fontSize: 40, marginBottom: spacing.sm },
  restTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: spacing.lg },
  statBig: { fontSize: 30, fontWeight: '900' },
  statLabel: {
    color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '700', marginTop: spacing.xs,
    textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center',
  },
  mutedText: { color: colors.textMuted },
  okText: { color: colors.success, fontWeight: '700' },
  objectiveRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm, gap: spacing.sm },
  objectiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold, marginTop: 6 },
  objectiveTitle: { color: colors.text, fontWeight: '700' },
  programRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionName: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
});

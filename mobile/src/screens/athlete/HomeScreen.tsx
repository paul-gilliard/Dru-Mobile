import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { getAthleteDashboard } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { AthleteDashboardDTO } from '../../api/types';
import { Badge, Button, Card, ErrorView, LoadingView, SectionTitle } from '../../components/ui';
import { colors, fontSize, muscleColors, spacing } from '../../theme';
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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.greeting}>Salut {user?.display_name} 👋</Text>
          <Text style={styles.dateText}>{DAY_NAMES[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]}</Text>
        </View>
        <Button title="Déconnexion" variant="ghost" onPress={logout} />
      </View>

      <Card style={{ marginTop: spacing.lg }}>
        <SectionTitle>Séance du jour</SectionTitle>
        {data.today_session ? (
          <View>
            <Text style={styles.sessionName}>{data.today_session.session_name}</Text>
            <View style={styles.chipRow}>
              {data.today_session.exercises.slice(0, 6).map((ex) => (
                <Badge key={ex.id} label={ex.name} color={muscleColors[ex.muscle ?? ''] ?? colors.primary} />
              ))}
            </View>
            <Button
              title="Voir la séance"
              onPress={() => navigation.navigate('SessionDetail', { sessionId: data.today_session!.id })}
              style={{ marginTop: spacing.md }}
            />
          </View>
        ) : (
          <Text style={styles.mutedText}>Pas de séance programmée aujourd'hui. Profites-en pour récupérer 💤</Text>
        )}
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <SectionTitle>Journal du jour</SectionTitle>
        {data.has_logged_today ? (
          <Text style={styles.okText}>✓ Journal déjà rempli aujourd'hui</Text>
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
        <SectionTitle>Objectifs en cours</SectionTitle>
        {data.objectives.length === 0 ? (
          <Text style={styles.mutedText}>Aucun objectif défini pour l'instant.</Text>
        ) : (
          data.objectives.map((o) => (
            <View key={o.id} style={styles.objectiveRow}>
              <Text style={styles.objectiveTitle}>🎯 {o.title}</Text>
              {o.description ? <Text style={styles.mutedText}>{o.description}</Text> : null}
            </View>
          ))
        )}
      </Card>

      {data.program && (
        <Card style={{ marginTop: spacing.lg }}>
          <SectionTitle>Programme actuel</SectionTitle>
          <Text style={styles.sessionName}>{data.program.name}</Text>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800' },
  dateText: { color: colors.textMuted, marginTop: spacing.xs, textTransform: 'capitalize' },
  sessionName: { color: colors.text, fontSize: fontSize.md, fontWeight: '700', marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  mutedText: { color: colors.textMuted },
  okText: { color: colors.success, fontWeight: '600' },
  objectiveRow: { marginBottom: spacing.sm },
  objectiveTitle: { color: colors.text, fontWeight: '600' },
});

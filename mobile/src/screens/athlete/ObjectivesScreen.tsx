import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useAthleteScope } from '../../context/AthleteScopeContext';
import { createObjective, deleteObjective, listObjectives } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { ObjectiveDTO } from '../../api/types';
import { Button, Card, EmptyState, ErrorView, Input, LoadingView, SectionTitle } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { colors, fontSize, spacing } from '../../theme';
import { TAB_BAR_CLEARANCE } from '../../navigation/useTabBarStyle';

export default function ObjectivesScreen() {
  const { user } = useAuth();
  const { athleteId } = useAthleteScope();
  const isCoach = user?.role === 'coach' || user?.role === 'admin';

  const [objectives, setObjectives] = useState<ObjectiveDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setObjectives(await listObjectives(athleteId));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [athleteId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await createObjective({ athlete_id: athleteId, title: title.trim(), description: description.trim() || undefined });
      setTitle('');
      setDescription('');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteObjective(id);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  if (loading) return <LoadingView label="Chargement des objectifs..." />;
  if (error) return <ErrorView message={error} onRetry={load} />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      {isCoach && (
        <Card style={{ marginBottom: spacing.lg }}>
          <SectionTitle icon="target">Nouvel objectif</SectionTitle>
          <Input placeholder="Titre" value={title} onChangeText={setTitle} />
          <Input
            placeholder="Description (optionnel)"
            value={description}
            onChangeText={setDescription}
            style={{ marginTop: spacing.sm, minHeight: 70, textAlignVertical: 'top' }}
            multiline
          />
          <Button title="Ajouter" onPress={handleCreate} loading={saving} disabled={!title.trim()} style={{ marginTop: spacing.md }} />
        </Card>
      )}

      {objectives.length === 0 ? (
        <EmptyState icon="target" title="Aucun objectif" subtitle="Aucun objectif n'a encore été défini." />
      ) : (
        objectives.map((o) => (
          <Card key={o.id} style={{ marginBottom: spacing.md }} glow>
            <View style={styles.row}>
              <View style={styles.iconWrap}>
                <Icon name="target" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{o.title}</Text>
                {o.description ? <Text style={styles.description}>{o.description}</Text> : null}
              </View>
              {isCoach && (
                <Button title="Suppr." variant="danger" onPress={() => handleDelete(o.id)} style={styles.deleteButton} />
              )}
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl + TAB_BAR_CLEARANCE },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  iconWrap: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: colors.text, fontWeight: '800', fontSize: fontSize.md },
  description: { color: colors.textMuted, marginTop: spacing.xs },
  deleteButton: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
});

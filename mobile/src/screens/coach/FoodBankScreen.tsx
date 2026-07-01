import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { createFood, deleteFood, listFoods } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { FoodDTO } from '../../api/types';
import { Button, Card, EmptyState, ErrorView, Input, LoadingView, SectionTitle } from '../../components/ui';
import { colors, fontSize, spacing } from '../../theme';

export default function FoodBankScreen() {
  const [foods, setFoods] = useState<FoodDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [proteins, setProteins] = useState('');
  const [carbs, setCarbs] = useState('');
  const [lipids, setLipids] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (query?: string) => {
    try {
      setError(null);
      setFoods(await listFoods(query));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleCreate = async () => {
    if (!name.trim() || !kcal || !carbs) return;
    setSaving(true);
    try {
      await createFood({
        name: name.trim(),
        kcal: parseFloat(kcal.replace(',', '.')),
        carbs: parseFloat(carbs.replace(',', '.')),
        proteins: proteins ? parseFloat(proteins.replace(',', '.')) : undefined,
        lipids: lipids ? parseFloat(lipids.replace(',', '.')) : undefined,
      });
      setName(''); setKcal(''); setProteins(''); setCarbs(''); setLipids('');
      await load(search);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteFood(id);
      await load(search);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  if (loading) return <LoadingView label="Chargement des aliments..." />;
  if (error) return <ErrorView message={error} onRetry={() => load(search)} />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(search); }} tintColor={colors.primary} />}
    >
      <Card style={{ marginBottom: spacing.lg }}>
        <SectionTitle icon="🍎">Nouvel aliment</SectionTitle>
        <Input placeholder="Nom" value={name} onChangeText={setName} />
        <View style={styles.macroRow}>
          <Input style={styles.macroInput} placeholder="kcal/100g" keyboardType="numeric" value={kcal} onChangeText={setKcal} />
          <Input style={styles.macroInput} placeholder="Prot (g)" keyboardType="numeric" value={proteins} onChangeText={setProteins} />
        </View>
        <View style={styles.macroRow}>
          <Input style={styles.macroInput} placeholder="Gluc (g)" keyboardType="numeric" value={carbs} onChangeText={setCarbs} />
          <Input style={styles.macroInput} placeholder="Lip (g)" keyboardType="numeric" value={lipids} onChangeText={setLipids} />
        </View>
        <Button title="Ajouter" onPress={handleCreate} loading={saving} disabled={!name.trim() || !kcal || !carbs} style={{ marginTop: spacing.md }} />
      </Card>

      <Input
        placeholder="Rechercher un aliment..."
        value={search}
        onChangeText={(t) => { setSearch(t); load(t); }}
        style={{ marginBottom: spacing.md }}
      />

      {foods.length === 0 ? (
        <EmptyState icon="🍎" title="Aucun aliment trouvé" />
      ) : (
        foods.map((food) => (
          <Card key={food.id} style={styles.foodRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.foodName}>{food.name}</Text>
              <Text style={styles.foodMacros}>
                🔥{food.kcal}kcal · 🥩{food.proteins ?? '-'} · 🍚{food.carbs} · 🥑{food.lipids ?? '-'} (/100g)
              </Text>
            </View>
            <Button title="✕" variant="ghost" onPress={() => handleDelete(food.id)} style={styles.deleteBtn} />
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  macroRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  macroInput: { flex: 1 },
  foodRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  foodName: { color: colors.text, fontWeight: '700' },
  foodMacros: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2, fontWeight: '600' },
  deleteBtn: { paddingVertical: 4, paddingHorizontal: spacing.sm },
});

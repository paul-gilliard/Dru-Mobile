import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { createFood, deleteFood, listFoods, updateFood, TTL } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { FoodDTO } from '../../api/types';
import { Button, Card, EmptyState, ErrorView, Input, LoadingView, SectionTitle } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { colors, fontSize, spacing } from '../../theme';
import { TAB_BAR_CLEARANCE } from '../../navigation/useTabBarStyle';
import { cacheGetSync, cachePeekSync } from '../../utils/apiCache';

export default function FoodBankScreen() {
  const cached = cacheGetSync<FoodDTO[]>('bank:foods', TTL.banks)
    ?? cachePeekSync<FoodDTO[]>('bank:foods')?.data
    ?? null;
  const [foods, setFoods] = useState<FoodDTO[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [kcal, setKcal] = useState('');
  const [proteins, setProteins] = useState('');
  const [carbs, setCarbs] = useState('');
  const [lipids, setLipids] = useState('');
  const [saturatedFats, setSaturatedFats] = useState('');
  const [simpleSugars, setSimpleSugars] = useState('');
  const [fiber, setFiber] = useState('');
  const [salt, setSalt] = useState('');
  const [saving, setSaving] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const hasDataRef = React.useRef(!!cached?.length);

  const load = useCallback(async (query?: string, force = false) => {
    if (!hasDataRef.current) setLoading(true);
    else if (force) setRefreshing(true);
    try {
      setError(null);
      const list = await listFoods(query);
      hasDataRef.current = true;
      setFoods(list);
    } catch (err) {
      if (!hasDataRef.current) setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(undefined, false); }, [load]));

  // Debounce recherche aliments
  useEffect(() => {
    const t = setTimeout(() => { void load(search || undefined); }, 280);
    return () => clearTimeout(t);
  }, [search, load]);

  const num = (v: string) => (v ? parseFloat(v.replace(',', '.')) : undefined);

  const handleCreate = async () => {
    if (!name.trim() || !kcal || !carbs) return;
    setSaving(true);
    try {
      await createFood({
        name: name.trim(),
        brand: brand.trim() || undefined,
        kcal: num(kcal),
        carbs: num(carbs),
        proteins: num(proteins),
        lipids: num(lipids),
        saturated_fats: num(saturatedFats),
        simple_sugars: num(simpleSugars),
        fiber: num(fiber),
        salt: num(salt),
      });
      setName(''); setBrand(''); setKcal(''); setProteins(''); setCarbs(''); setLipids('');
      setSaturatedFats(''); setSimpleSugars(''); setFiber(''); setSalt('');
      await load(search || undefined, true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteFood(id);
      await load(search || undefined, true);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  if (loading && !foods.length) return <LoadingView label="Chargement des aliments..." />;
  if (error && !foods.length) return <ErrorView message={error} onRetry={() => void load(search || undefined, true)} />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(search || undefined, true); }} tintColor={colors.primary} />}
    >
      <Card style={{ marginBottom: spacing.lg }}>
        <SectionTitle icon="nutrition">Nouvel aliment</SectionTitle>
        <Input placeholder="Nom" value={name} onChangeText={setName} />
        <Input placeholder="Marque (ex: Myprotein)" value={brand} onChangeText={setBrand} style={{ marginTop: spacing.sm }} />
        <View style={styles.macroRow}>
          <Input style={styles.macroInput} placeholder="kcal/100g" keyboardType="numeric" value={kcal} onChangeText={setKcal} />
          <Input style={styles.macroInput} placeholder="Prot (g)" keyboardType="numeric" value={proteins} onChangeText={setProteins} />
        </View>
        <View style={styles.macroRow}>
          <Input style={styles.macroInput} placeholder="Gluc (g)" keyboardType="numeric" value={carbs} onChangeText={setCarbs} />
          <Input style={styles.macroInput} placeholder="Lip (g)" keyboardType="numeric" value={lipids} onChangeText={setLipids} />
        </View>
        <Button
          title={advanced ? 'Moins de détails' : 'Plus de détails'}
          icon={advanced ? 'chevron-up' : 'chevron-down'}
          variant="ghost"
          onPress={() => setAdvanced((a) => !a)}
          style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}
        />
        {advanced && (
          <>
            <View style={styles.macroRow}>
              <Input style={styles.macroInput} placeholder="Saturés (g)" keyboardType="numeric" value={saturatedFats} onChangeText={setSaturatedFats} />
              <Input style={styles.macroInput} placeholder="Sucres (g)" keyboardType="numeric" value={simpleSugars} onChangeText={setSimpleSugars} />
            </View>
            <View style={styles.macroRow}>
              <Input style={styles.macroInput} placeholder="Fibres (g)" keyboardType="numeric" value={fiber} onChangeText={setFiber} />
              <Input style={styles.macroInput} placeholder="Sel (g)" keyboardType="numeric" value={salt} onChangeText={setSalt} />
            </View>
          </>
        )}
        <Button title="Ajouter" onPress={handleCreate} loading={saving} disabled={!name.trim() || !kcal || !carbs} style={{ marginTop: spacing.md }} />
      </Card>

      <Input
        placeholder="Rechercher un aliment..."
        value={search}
        onChangeText={setSearch}
        style={{ marginBottom: spacing.md }}
      />

      {foods.length === 0 ? (
        <EmptyState icon="nutrition" title="Aucun aliment trouvé" />
      ) : (
        foods.map((food) => (
          editingId === food.id ? (
            <EditFoodCard key={food.id} food={food} onCancel={() => setEditingId(null)} onSaved={() => { setEditingId(null); load(search); }} />
          ) : (
            <Card key={food.id} style={styles.foodRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.foodName}>{food.name}{food.brand ? ` · ${food.brand}` : ''}</Text>
                <View style={styles.foodMacrosRow}>
                  <Icon name="flame" size={11} color={colors.textMuted} />
                  <Text style={styles.foodMacros}>{food.kcal}kcal</Text>
                  <Icon name="protein" size={11} color={colors.textMuted} />
                  <Text style={styles.foodMacros}>{food.proteins ?? '-'}</Text>
                  <Icon name="carbs" size={11} color={colors.textMuted} />
                  <Text style={styles.foodMacros}>{food.carbs}</Text>
                  <Icon name="fats" size={11} color={colors.textMuted} />
                  <Text style={styles.foodMacros}>{food.lipids ?? '-'} (/100g)</Text>
                </View>
              </View>
              <Button title="" icon="edit" variant="ghost" onPress={() => setEditingId(food.id)} style={styles.deleteBtn} />
              <Button title="" icon="trash" variant="ghost" onPress={() => handleDelete(food.id)} style={styles.deleteBtn} />
            </Card>
          )
        ))
      )}
    </ScrollView>
  );
}

function EditFoodCard({ food, onCancel, onSaved }: { food: FoodDTO; onCancel: () => void; onSaved: () => void }) {
  const [name, setName] = useState(food.name);
  const [brand, setBrand] = useState(food.brand ?? '');
  const [kcal, setKcal] = useState(String(food.kcal));
  const [proteins, setProteins] = useState(food.proteins != null ? String(food.proteins) : '');
  const [carbs, setCarbs] = useState(String(food.carbs));
  const [lipids, setLipids] = useState(food.lipids != null ? String(food.lipids) : '');
  const [saving, setSaving] = useState(false);

  const num = (v: string) => (v ? parseFloat(v.replace(',', '.')) : undefined);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await updateFood(food.id, {
        name: name.trim(), brand: brand.trim() || undefined, kcal: num(kcal), carbs: num(carbs), proteins: num(proteins), lipids: num(lipids),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Input value={name} onChangeText={setName} placeholder="Nom" />
      <Input value={brand} onChangeText={setBrand} placeholder="Marque" style={{ marginTop: spacing.sm }} />
      <View style={styles.macroRow}>
        <Input style={styles.macroInput} placeholder="kcal/100g" keyboardType="numeric" value={kcal} onChangeText={setKcal} />
        <Input style={styles.macroInput} placeholder="Prot (g)" keyboardType="numeric" value={proteins} onChangeText={setProteins} />
      </View>
      <View style={styles.macroRow}>
        <Input style={styles.macroInput} placeholder="Gluc (g)" keyboardType="numeric" value={carbs} onChangeText={setCarbs} />
        <Input style={styles.macroInput} placeholder="Lip (g)" keyboardType="numeric" value={lipids} onChangeText={setLipids} />
      </View>
      <View style={styles.editActions}>
        <Button title="Annuler" variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
        <Button title="Enregistrer" onPress={handleSave} loading={saving} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl + TAB_BAR_CLEARANCE },
  macroRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  macroInput: { flex: 1 },
  foodRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  foodName: { color: colors.text, fontWeight: '700' },
  foodMacrosRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 3, marginTop: 3 },
  foodMacros: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600' },
  deleteBtn: { paddingVertical: 4, paddingHorizontal: spacing.sm },
  editActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});

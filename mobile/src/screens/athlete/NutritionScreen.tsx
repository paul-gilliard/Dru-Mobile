import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useAthleteScope } from '../../context/AthleteScopeContext';
import {
  addMealEntry, createMealPlan, deleteMealEntry, deleteMealPlan, getMealPlan, listFoods, listMealPlans,
} from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { FoodDTO, MealPlanDTO } from '../../api/types';
import { Badge, Button, Card, EmptyState, ErrorView, Input, LoadingView, SectionTitle } from '../../components/ui';
import { colors, fontSize, spacing } from '../../theme';

export default function NutritionScreen() {
  const { user } = useAuth();
  const { athleteId } = useAthleteScope();
  const isCoach = user?.role === 'coach';

  const [plans, setPlans] = useState<MealPlanDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPlanName, setNewPlanName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const list = await listMealPlans(athleteId);
      const detailed = await Promise.all(list.map((p) => getMealPlan(p.id)));
      setPlans(detailed);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [athleteId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleCreatePlan = async () => {
    if (!newPlanName.trim()) return;
    setCreating(true);
    try {
      await createMealPlan({ name: newPlanName.trim(), athlete_id: athleteId });
      setNewPlanName('');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePlan = async (planId: number) => {
    try {
      await deleteMealPlan(planId);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  if (loading) return <LoadingView label="Chargement du plan alimentaire..." />;
  if (error) return <ErrorView message={error} onRetry={load} />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      {isCoach && (
        <Card style={{ marginBottom: spacing.lg }}>
          <SectionTitle icon="🍽️">Nouveau plan alimentaire</SectionTitle>
          <View style={styles.row}>
            <Input style={{ flex: 1 }} placeholder="Nom du plan" value={newPlanName} onChangeText={setNewPlanName} />
            <Button title="Créer" onPress={handleCreatePlan} loading={creating} disabled={!newPlanName.trim()} style={styles.createBtn} />
          </View>
        </Card>
      )}

      {plans.length === 0 ? (
        <EmptyState icon="🍽️" title="Aucun plan alimentaire" subtitle={isCoach ? 'Crée un plan ci-dessus.' : "Ton coach n'a pas encore créé de plan."} />
      ) : (
        plans.map((plan) => (
          <MealPlanCard key={plan.id} plan={plan} isCoach={isCoach} onChanged={load} onDeletePlan={() => handleDeletePlan(plan.id)} />
        ))
      )}
    </ScrollView>
  );
}

function MealPlanCard({
  plan, isCoach, onChanged, onDeletePlan,
}: { plan: MealPlanDTO; isCoach: boolean; onChanged: () => void; onDeletePlan: () => void }) {
  const totals = plan.totals;
  const [addingToMeal, setAddingToMeal] = useState<number | null>(null);

  return (
    <Card style={{ marginBottom: spacing.lg }}>
      <View style={styles.cardHeader}>
        <SectionTitle style={{ marginBottom: 0, flex: 1 }} icon="🍽️">{plan.name}</SectionTitle>
        {isCoach && <Button title="Suppr." variant="danger" onPress={onDeletePlan} style={styles.smallBtn} />}
      </View>
      <View style={styles.kcalHero}>
        <Text style={styles.kcalValue}>{Math.round(totals.kcals)}</Text>
        <Text style={styles.kcalUnit}>kcal / jour</Text>
      </View>
      <View style={styles.totalsRow}>
        <TotalPill label="Protéines" value={Math.round(totals.proteins)} color={colors.secondary} unit="g" />
        <TotalPill label="Glucides" value={Math.round(totals.carbs)} color={colors.success} unit="g" />
        <TotalPill label="Lipides" value={Math.round(totals.lipids)} color={colors.gold} unit="g" />
      </View>

      {Array.from({ length: plan.meal_count }, (_, i) => i + 1).map((mealNumber) => {
        const meals = plan.meals_by_number?.[String(mealNumber)] ?? [];
        const label = plan.meal_labels[mealNumber - 1] || `Repas ${mealNumber}`;
        const time = plan.meal_times[mealNumber - 1];
        return (
          <View key={mealNumber} style={styles.mealBlock}>
            <Text style={styles.mealTitle}>{label}{time ? ` · ${time}` : ''}</Text>
            {meals.map((m) => (
              <View key={m.id} style={styles.foodRow}>
                <Text style={styles.foodName}>{m.food_name}</Text>
                <Text style={styles.foodQty}>{m.quantity}g · {Math.round(m.kcals)}kcal</Text>
                {isCoach && (
                  <Button title="✕" variant="ghost" onPress={async () => { await deleteMealEntry(m.id); onChanged(); }} style={styles.deleteFoodBtn} />
                )}
              </View>
            ))}
            {meals.length === 0 && <Text style={styles.emptyMeal}>Aucun aliment</Text>}
            {isCoach && (
              addingToMeal === mealNumber ? (
                <FoodPicker
                  onCancel={() => setAddingToMeal(null)}
                  onPick={async (food, quantity) => {
                    await addMealEntry(plan.id, { meal_number: mealNumber, food_id: food.id, quantity });
                    setAddingToMeal(null);
                    onChanged();
                  }}
                />
              ) : (
                <Button title="+ Ajouter un aliment" variant="secondary" onPress={() => setAddingToMeal(mealNumber)} style={{ marginTop: spacing.sm }} />
              )
            )}
          </View>
        );
      })}
    </Card>
  );
}

function FoodPicker({ onPick, onCancel }: { onPick: (food: FoodDTO, quantity: number) => void; onCancel: () => void }) {
  const [query, setQuery] = useState('');
  const [foods, setFoods] = useState<FoodDTO[]>([]);
  const [selected, setSelected] = useState<FoodDTO | null>(null);
  const [quantity, setQuantity] = useState('100');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listFoods(query).then(setFoods).catch(() => setFoods([]));
  }, [query]);

  const handleConfirm = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await onPick(selected, parseFloat(quantity.replace(',', '.')) || 100);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.picker}>
      <Input placeholder="Rechercher un aliment..." value={query} onChangeText={setQuery} />
      <View style={styles.suggestionRow}>
        {foods.slice(0, 8).map((f) => (
          <Pressable key={f.id} onPress={() => setSelected(f)}>
            <Badge label={f.name} color={selected?.id === f.id ? colors.primary : colors.textFaint} />
          </Pressable>
        ))}
      </View>
      {selected && (
        <View style={styles.row}>
          <Text style={styles.selectedFood}>{selected.name}</Text>
          <Input style={styles.qtyInput} keyboardType="numeric" value={quantity} onChangeText={setQuantity} />
          <Text style={styles.gLabel}>g</Text>
        </View>
      )}
      <View style={[styles.row, { marginTop: spacing.sm }]}>
        <Button title="Annuler" variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
        <Button title="Ajouter" onPress={handleConfirm} loading={saving} disabled={!selected} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

function TotalPill({ label, value, color, unit }: { label: string; value: number; color: string; unit?: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: `${color}1F`, borderColor: `${color}55` }]}>
      <Text style={[styles.pillValue, { color }]}>{value}{unit ?? ''}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  createBtn: { paddingHorizontal: spacing.lg },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  smallBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  kcalHero: { alignItems: 'center', marginBottom: spacing.md },
  kcalValue: { color: colors.text, fontSize: 40, fontWeight: '900' },
  kcalUnit: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  totalsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  pill: {
    flex: 1, borderWidth: 1, borderRadius: 14, paddingVertical: spacing.sm, alignItems: 'center',
  },
  pillValue: { fontWeight: '900', fontSize: fontSize.md },
  pillLabel: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '700', marginTop: 2 },
  mealBlock: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  mealTitle: { color: colors.text, fontWeight: '700', marginBottom: spacing.xs },
  foodRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  foodName: { color: colors.textMuted, flex: 1 },
  foodQty: { color: colors.textFaint, fontSize: fontSize.sm },
  emptyMeal: { color: colors.textFaint, fontSize: fontSize.xs, fontStyle: 'italic' },
  deleteFoodBtn: { paddingVertical: 0, paddingHorizontal: spacing.xs },
  picker: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  selectedFood: { color: colors.text, flex: 1 },
  qtyInput: { width: 60, paddingVertical: spacing.xs, textAlign: 'center' },
  gLabel: { color: colors.textMuted },
});

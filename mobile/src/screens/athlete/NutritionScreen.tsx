import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useAthleteScope } from '../../context/AthleteScopeContext';
import {
  activateMealPlan, addMealEntry, createMealPlan, deleteMealEntry, deleteMealPlan, duplicateMealPlan,
  listFoods, listMealPlans, renameMealPlan, setMealTime, TTL,
} from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { FoodDTO, MealPlanDTO } from '../../api/types';
import { Badge, Button, Card, EmptyState, ErrorView, Input, LoadingView, SectionTitle } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { colors, fontSize, spacing } from '../../theme';
import { TAB_BAR_CLEARANCE } from '../../navigation/useTabBarStyle';
import { cacheGetSync, cachePeekSync } from '../../utils/apiCache';

export default function NutritionScreen() {
  const { user } = useAuth();
  const { athleteId, readOnly } = useAthleteScope();
  const isCoach = user?.role === 'coach' || user?.role === 'admin';

  const cacheKey = `mealPlans:${athleteId}:1`;
  const cached = cacheGetSync<MealPlanDTO[]>(cacheKey, TTL.mealPlans)
    ?? cachePeekSync<MealPlanDTO[]>(cacheKey)?.data
    ?? null;
  const [plans, setPlans] = useState<MealPlanDTO[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPlanName, setNewPlanName] = useState('');
  const [creating, setCreating] = useState(false);
  const hasDataRef = React.useRef(!!cached?.length);

  const load = useCallback(async (force = false) => {
    if (!hasDataRef.current) setLoading(true);
    else if (force) setRefreshing(true);
    try {
      setError(null);
      const list = await listMealPlans(athleteId, { withMeals: true });
      hasDataRef.current = true;
      setPlans(list);
    } catch (err) {
      if (!hasDataRef.current) setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [athleteId]);

  useFocusEffect(useCallback(() => { void load(false); }, [load]));

  const handleCreatePlan = async () => {
    if (!newPlanName.trim()) return;
    setCreating(true);
    try {
      await createMealPlan({ name: newPlanName.trim(), athlete_id: athleteId });
      setNewPlanName('');
      await load(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePlan = async (planId: number) => {
    try {
      await deleteMealPlan(planId);
      await load(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  if (loading && !plans.length) return <LoadingView label="Chargement du plan alimentaire..." />;
  if (error && !plans.length) return <ErrorView message={error} onRetry={() => void load(true)} />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true); }} tintColor={colors.primary} />}
    >
      {isCoach && (
        <Card style={{ marginBottom: spacing.lg }}>
          <SectionTitle icon="nutrition">Nouveau plan alimentaire</SectionTitle>
          <View style={styles.row}>
            <Input style={{ flex: 1 }} placeholder="Nom du plan" value={newPlanName} onChangeText={setNewPlanName} />
            <Button title="Créer" onPress={handleCreatePlan} loading={creating} disabled={!newPlanName.trim()} style={styles.createBtn} />
          </View>
        </Card>
      )}

      {plans.length === 0 ? (
        <EmptyState icon="nutrition" title="Aucun plan alimentaire" subtitle={isCoach ? 'Crée un plan ci-dessus.' : "Ton coach n'a pas encore créé de plan."} />
      ) : (
        plans.map((plan) => (
          <MealPlanCard
            key={plan.id}
            plan={plan}
            isCoach={isCoach}
            readOnly={readOnly}
            onChanged={load}
            onDeletePlan={() => handleDeletePlan(plan.id)}
          />
        ))
      )}
    </ScrollView>
  );
}

function MealPlanCard({
  plan, isCoach, readOnly, onChanged, onDeletePlan,
}: { plan: MealPlanDTO; isCoach: boolean; readOnly: boolean; onChanged: () => void; onDeletePlan: () => void }) {
  const totals = plan.totals;
  const isActive = !!plan.is_active;
  const [addingToMeal, setAddingToMeal] = useState<number | null>(null);
  const [editingMealTime, setEditingMealTime] = useState<number | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(plan.name);
  const [busy, setBusy] = useState(false);
  const [activating, setActivating] = useState(false);

  const handleRename = async () => {
    if (!nameDraft.trim() || nameDraft.trim() === plan.name) { setRenaming(false); return; }
    setBusy(true);
    try {
      await renameMealPlan(plan.id, nameDraft.trim());
      onChanged();
    } finally {
      setBusy(false);
      setRenaming(false);
    }
  };

  const handleDuplicate = async () => {
    setBusy(true);
    try {
      await duplicateMealPlan(plan.id, { name: `${plan.name} (copie)` });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const handleActivate = async () => {
    if (isActive) return;
    setActivating(true);
    try {
      await activateMealPlan(plan.id);
      onChanged();
    } finally {
      setActivating(false);
    }
  };

  return (
    <Card style={[{ marginBottom: spacing.lg }, isActive && styles.activeCard]}>
      <View style={styles.cardHeader}>
        {renaming ? (
          <Input style={{ flex: 1 }} value={nameDraft} onChangeText={setNameDraft} autoFocus onSubmitEditing={handleRename} />
        ) : (
          <Pressable style={styles.planTitleRow} onPress={() => isCoach && setRenaming(true)} disabled={!isCoach}>
            <SectionTitle style={{ marginBottom: 0, flexShrink: 1 }} icon="nutrition">{plan.name}</SectionTitle>
            {isActive ? <Badge label="ACTIF" color={colors.success} /> : null}
            {isCoach ? <Icon name="edit" size={13} color={colors.textFaint} /> : null}
          </Pressable>
        )}
        {isCoach && !renaming && (
          <View style={styles.headerActions}>
            <Button title="Dupl." variant="secondary" onPress={handleDuplicate} loading={busy} style={styles.smallBtn} />
            <Button title="Suppr." variant="danger" onPress={onDeletePlan} style={styles.smallBtn} />
          </View>
        )}
        {renaming && <Button title="OK" onPress={handleRename} loading={busy} style={styles.smallBtn} />}
      </View>

      {(!readOnly || isCoach) && !isActive ? (
        <Button
          title="Définir comme actif"
          variant="secondary"
          onPress={handleActivate}
          loading={activating}
          style={{ marginBottom: spacing.md }}
        />
      ) : null}

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
            <View style={styles.mealTitleRow}>
              <Text style={styles.mealTitle}>{label}{time ? ` · ${time}` : ''}</Text>
              {isCoach && (
                <Pressable onPress={() => setEditingMealTime(editingMealTime === mealNumber ? null : mealNumber)} style={styles.editMealLinkRow}>
                  <Icon name="clock" size={12} color={colors.primary} />
                  <Text style={styles.editMealLink}>Modifier</Text>
                </Pressable>
              )}
            </View>
            {isCoach && editingMealTime === mealNumber && (
              <MealTimeEditor
                planId={plan.id}
                mealNumber={mealNumber}
                initialLabel={plan.meal_labels[mealNumber - 1] ?? ''}
                initialTime={plan.meal_times[mealNumber - 1] ?? ''}
                onDone={() => { setEditingMealTime(null); onChanged(); }}
              />
            )}
            {meals.map((m) => (
              <View key={m.id} style={styles.foodRow}>
                <Text style={styles.foodName}>{m.food_name}</Text>
                <Text style={styles.foodQty}>{m.quantity}g · {Math.round(m.kcals)}kcal</Text>
                {isCoach && (
                  <Pressable onPress={async () => { await deleteMealEntry(m.id); onChanged(); }} style={styles.deleteFoodBtn} hitSlop={6}>
                    <Icon name="close" size={15} color={colors.danger} />
                  </Pressable>
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

function MealTimeEditor({
  planId, mealNumber, initialLabel, initialTime, onDone,
}: { planId: number; mealNumber: number; initialLabel: string; initialTime: string; onDone: () => void }) {
  const [label, setLabel] = useState(initialLabel);
  const [time, setTime] = useState(initialTime);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setMealTime(planId, mealNumber, time.trim(), label.trim());
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.timeEditor}>
      <Input style={{ flex: 1 }} placeholder="Nom (ex: Intra workout)" value={label} onChangeText={setLabel} />
      <Input style={styles.timeInput} placeholder="08h30" value={time} onChangeText={setTime} />
      <Button title="OK" onPress={handleSave} loading={saving} style={styles.smallBtn} />
    </View>
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
  content: { padding: spacing.lg, paddingBottom: spacing.xxl + TAB_BAR_CLEARANCE },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  createBtn: { paddingHorizontal: spacing.lg },
  activeCard: { borderColor: colors.success, borderWidth: 1.5 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs, gap: spacing.xs },
  planTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headerActions: { flexDirection: 'row', gap: spacing.xs },
  smallBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  mealTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editMealLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  editMealLink: { color: colors.primary, fontSize: fontSize.xs, fontWeight: '700' },
  timeEditor: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center', marginBottom: spacing.sm },
  timeInput: { width: 80, paddingVertical: spacing.xs, textAlign: 'center' },
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

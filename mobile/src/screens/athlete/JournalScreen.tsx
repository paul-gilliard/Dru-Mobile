import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAthleteScope } from '../../context/AthleteScopeContext';
import { bulkImportJournal, getJournalFirstEntryDate, listJournal, listMealPlans, upsertJournal } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { JournalEntryDTO, MealPlanDTO } from '../../api/types';
import { Badge, Button, Card, EmptyState, ErrorView, Input, LoadingView, SectionTitle } from '../../components/ui';
import { Icon, IconName } from '../../components/Icon';
import { colors, fontSize, radius, spacing } from '../../theme';
import { TAB_BAR_CLEARANCE } from '../../navigation/useTabBarStyle';
import { formatDateFR, isoDaysAgo, shiftLocalISO, todayISO } from '../../utils/format';
import {
  catchupStartDate,
  connectHealthConnect,
  getHealthConnectionState,
  getHealthPermissionStatus,
  getHealthSnapshotForRange,
  getTodayHealthSnapshot,
  HEALTH_CATCHUP_MAX_DAYS,
  HealthConnectionState,
  HealthPermissionStatus,
  isHealthConnectSupported,
  openHealthSettings,
  syncHealthDay,
} from '../../utils/healthConnect';

const FIELD_DEFS: { key: keyof JournalEntryDTO; label: string; unit?: string; icon: IconName }[] = [
  { key: 'weight', label: 'Poids', unit: 'kg', icon: 'scale' },
  { key: 'sleep_hours', label: 'Sommeil', unit: 'h', icon: 'moon' },
  { key: 'steps', label: 'Pas', icon: 'footsteps' },
  { key: 'water_ml', label: 'Eau', unit: 'ml', icon: 'water' },
  { key: 'kcals', label: 'Calories', unit: 'kcal', icon: 'flame' },
  { key: 'protein', label: 'Protéines', unit: 'g', icon: 'protein' },
  { key: 'carbs', label: 'Glucides', unit: 'g', icon: 'carbs' },
  { key: 'fats', label: 'Lipides', unit: 'g', icon: 'fats' },
  { key: 'energy', label: 'Énergie', unit: '/10', icon: 'bolt' },
  { key: 'stress', label: 'Stress', unit: '/10', icon: 'gauge' },
  { key: 'hunger', label: 'Faim', unit: '/10', icon: 'restaurant' },
];

const TEXT_FIELD_DEFS: { key: keyof JournalEntryDTO; label: string; icon: IconName; placeholder: string }[] = [
  { key: 'food_quality', label: 'Qualité aliments', icon: 'star', placeholder: 'ex: Très bonne' },
  { key: 'digestion', label: 'Digestion', icon: 'leaf', placeholder: 'ex: Facile' },
];

const CYCLE_PHASES = ['SPM', 'phase menstruelle', 'en paix'];

export default function JournalScreen() {
  const { athleteId, readOnly } = useAthleteScope();

  const [entries, setEntries] = useState<JournalEntryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [form, setForm] = useState<Record<string, string>>({});
  const [cyclePhase, setCyclePhase] = useState('');
  const [saving, setSaving] = useState(false);
  const [dayLoading, setDayLoading] = useState(false);
  const [refreshingHealthDay, setRefreshingHealthDay] = useState(false);

  const [healthState, setHealthState] = useState<HealthConnectionState>('unsupported');
  const [healthPerms, setHealthPerms] = useState<HealthPermissionStatus | null>(null);
  const [connectingHealth, setConnectingHealth] = useState(false);
  const [catchingUp, setCatchingUp] = useState(false);
  const [activePlan, setActivePlan] = useState<MealPlanDTO | null>(null);
  const [dietBusy, setDietBusy] = useState(false);

  const fillForm = (entry: JournalEntryDTO | undefined) => {
    const initial: Record<string, string> = {};
    [...FIELD_DEFS, ...TEXT_FIELD_DEFS].forEach(({ key }) => {
      const val = entry?.[key];
      if (val !== null && val !== undefined) initial[key as string] = String(val);
    });
    setForm(initial);
    setCyclePhase(entry?.menstrual_cycle ?? '');
  };

  const selectedDateRef = useRef(selectedDate);
  useEffect(() => { selectedDateRef.current = selectedDate; }, [selectedDate]);
  const entriesRef = useRef(entries);
  useEffect(() => { entriesRef.current = entries; }, [entries]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await listJournal(athleteId, isoDaysAgo(30), todayISO());
      setEntries(data);
      // Dérive le jour sélectionné depuis le range (évite un 2e fetch)
      const day = selectedDateRef.current;
      fillForm(data.find((e) => e.entry_date === day));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setDayLoading(false);
    }
  }, [athleteId]);

  const loadSelectedDay = useCallback(async (date: string) => {
    const start = isoDaysAgo(30);
    const end = todayISO();
    const cached = entriesRef.current;
    if (cached.length > 0 && date >= start && date <= end) {
      fillForm(cached.find((e) => e.entry_date === date));
      return;
    }
    setDayLoading(true);
    try {
      const data = await listJournal(athleteId, date, date);
      fillForm(data.find((e) => e.entry_date === date));
      setEntries((prev) => {
        const others = prev.filter((e) => e.entry_date !== date);
        return data[0] ? [...others, data[0]].sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1)) : others;
      });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setDayLoading(false);
    }
  }, [athleteId]);

  const loadIntegrations = useCallback(async () => {
    if (isHealthConnectSupported()) {
      try {
        const state = await getHealthConnectionState();
        setHealthState(state);
        if (state === 'connected') {
          setHealthPerms(await getHealthPermissionStatus());
        }
      } catch {
        setHealthState('not-connected');
      }
    }
    if (!readOnly) {
      try {
        const plans = await listMealPlans(athleteId);
        setActivePlan(plans.find((p) => p.is_active) ?? null);
      } catch {
        setActivePlan(null);
      }
    }
  }, [athleteId, readOnly]);

  useFocusEffect(useCallback(() => {
    setDayLoading(true);
    void load();
    void loadIntegrations();
  }, [load, loadIntegrations]));

  const scrollRef = useRef<ScrollView>(null);

  const goToDay = (date: string) => {
    setSelectedDate(date);
    loadSelectedDay(date);
  };

  const handleEditHistoryDay = (date: string) => {
    goToDay(date);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleConnectHealth = async () => {
    setConnectingHealth(true);
    try {
      const result = await connectHealthConnect();
      if (result.permissions) setHealthPerms(result.permissions);
      if (!result.ok) {
        Alert.alert('Connexion impossible', result.reason ?? 'Erreur inconnue.');
        return;
      }
      setHealthState('connected');
      const snapshot = await getTodayHealthSnapshot();
      if (snapshot && Object.keys(snapshot).length > 0) {
        await bulkImportJournal({ athlete_id: athleteId, entries: [{ entry_date: todayISO(), ...snapshot }] });
        await load();
        await loadSelectedDay(selectedDate);
      }
      Alert.alert(
        'Health Connect connecté',
        result.reason
          ?? `Données du jour importées si disponibles. Le rattrapage couvre au max ${HEALTH_CATCHUP_MAX_DAYS} jours. Le poids n'est jamais synchronisé.`,
      );
    } catch (err) {
      Alert.alert('Erreur', apiErrorMessage(err));
    } finally {
      setConnectingHealth(false);
    }
  };

  const handleCatchup = async () => {
    try {
      const firstDate = await getJournalFirstEntryDate(athleteId);
      const start = catchupStartDate(firstDate);
      Alert.alert(
        'Rattraper 1 mois',
        `Importer les données Health Connect depuis le ${formatDateFR(start)} (max ${HEALTH_CATCHUP_MAX_DAYS} jours) ? Seuls les champs encore vides seront complétés. Le poids n'est jamais modifié.`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Importer',
            onPress: async () => {
              setCatchingUp(true);
              try {
                const snapshot = await getHealthSnapshotForRange(start, todayISO());
                const entries = Object.entries(snapshot).map(([entry_date, day]) => ({ entry_date, ...day }));
                if (entries.length === 0) {
                  Alert.alert(
                    'Rien à importer',
                    "Aucune donnée SleepSession / Nutrition dans Health Connect sur ce mois. Vérifie les permissions et la sync MFP → Health Connect.",
                  );
                  return;
                }
                const result = await bulkImportJournal({ athlete_id: athleteId, entries });
                Alert.alert(
                  'Rattrapage terminé',
                  `${result.imported_days} jour(s) complété(s) (${result.imported_fields} champ(s)) depuis le ${formatDateFR(start)}.`,
                );
                await load();
                await loadSelectedDay(selectedDate);
              } catch (err) {
                Alert.alert('Erreur', apiErrorMessage(err));
              } finally {
                setCatchingUp(false);
              }
            },
          },
        ],
      );
    } catch (err) {
      Alert.alert('Erreur', apiErrorMessage(err));
    }
  };

  const handleDietRespected = () => {
    if (!activePlan) return;
    const t = activePlan.totals;
    const yesterday = isoDaysAgo(1);
    Alert.alert(
      'Diète respectée hier ?',
      `Appliquer « ${activePlan.name} » à hier (${formatDateFR(yesterday)}) : ${Math.round(t.kcals)} kcal · ${Math.round(t.proteins)}g protéines · ${Math.round(t.carbs)}g glucides · ${Math.round(t.lipids)}g lipides. Seuls les champs encore vides seront complétés.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setDietBusy(true);
            try {
              const result = await bulkImportJournal({
                athlete_id: athleteId,
                entries: [{
                  entry_date: yesterday,
                  kcals: Math.round(t.kcals),
                  protein: Math.round(t.proteins),
                  carbs: Math.round(t.carbs),
                  fats: Math.round(t.lipids),
                }],
              });
              Alert.alert(
                result.imported_fields > 0 ? 'Diète appliquée' : 'Déjà renseigné',
                result.imported_fields > 0
                  ? `Les macros d'hier ont été complétées depuis « ${activePlan.name} ».`
                  : "Ta diète d'hier était déjà entièrement renseignée, rien à faire.",
              );
              await load();
              await loadSelectedDay(selectedDate);
            } catch (err) {
              Alert.alert('Erreur', apiErrorMessage(err));
            } finally {
              setDietBusy(false);
            }
          },
        },
      ],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Un champ vidé volontairement est envoyé comme `null` (pas omis) pour que
      // le serveur l'efface réellement, plutôt que de laisser l'ancienne valeur.
      const payload: Record<string, unknown> = { athlete_id: athleteId, entry_date: selectedDate };
      FIELD_DEFS.forEach(({ key }) => {
        const raw = form[key as string];
        payload[key as string] = (raw === undefined || raw === '') ? null : Number(raw.replace(',', '.'));
      });
      TEXT_FIELD_DEFS.forEach(({ key }) => {
        const raw = form[key as string];
        payload[key as string] = raw ? raw : null;
      });
      payload.menstrual_cycle = cyclePhase || null;
      await upsertJournal(payload);
      await load();
      await loadSelectedDay(selectedDate);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshHealthDay = async () => {
    setRefreshingHealthDay(true);
    try {
      const report = await syncHealthDay(selectedDate);
      setHealthPerms(report.permissions);
      const day = report.snapshot;
      const fieldsFound = Object.keys(day).filter((k) => (day as Record<string, unknown>)[k] != null);
      if (fieldsFound.length === 0) {
        const detail = report.hints.length > 0
          ? `\n\n${report.hints.join('\n\n')}`
          : '';
        Alert.alert(
          'Aucune donnée',
          `Rien trouvé dans Health Connect pour le ${formatDateFR(selectedDate)}.${detail}`,
          [
            { text: 'OK' },
            { text: 'Ouvrir Health Connect', onPress: () => openHealthSettings() },
          ],
        );
        return;
      }
      setForm((f) => {
        const next = { ...f };
        (Object.entries(day) as [string, number | undefined][]).forEach(([key, val]) => {
          if (val != null) next[key] = String(val);
        });
        return next;
      });
      const extra = report.hints.length > 0 ? `\n\nNote : ${report.hints[0]}` : '';
      Alert.alert(
        'Données actualisées',
        `${fieldsFound.length} champ(s) mis à jour (${fieldsFound.join(', ')}). Vérifie puis appuie sur « Enregistrer ».${extra}`,
      );
    } catch (err) {
      Alert.alert('Erreur', apiErrorMessage(err));
    } finally {
      setRefreshingHealthDay(false);
    }
  };

  if (loading && !entries.length) return <LoadingView label="Chargement du journal..." />;
  if (error && !entries.length) return <ErrorView message={error} onRetry={load} />;

  const history = entries.filter((e) => e.entry_date !== selectedDate);
  const streak = computeStreak(entries);
  const yesterdayEntry = entries.find((e) => e.entry_date === isoDaysAgo(1));
  const yesterdayDietFilled = !!yesterdayEntry
    && yesterdayEntry.kcals != null && yesterdayEntry.protein != null
    && yesterdayEntry.carbs != null && yesterdayEntry.fats != null;
  const showDietButton = !readOnly && !!activePlan && !yesterdayDietFilled;
  const isToday = selectedDate === todayISO();
  const dayTitle = isToday ? "Aujourd'hui" : formatDateFR(selectedDate);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      {streak > 0 && (
        <View style={styles.streakBanner}>
          <Icon name="flame" size={20} color={colors.gold} />
          <Text style={styles.streakText}>{streak} jour{streak > 1 ? 's' : ''} de suite — continue comme ça !</Text>
        </View>
      )}

      {!readOnly && (
        <Card>
          <View style={styles.dayNavRow}>
            <Pressable onPress={() => goToDay(shiftLocalISO(selectedDate, -1))} style={styles.dayNavBtn} hitSlop={8}>
              <Icon name="chevron-left" size={18} color={colors.text} />
            </Pressable>
            <View style={styles.dayNavCenter}>
              <SectionTitle icon="journal" style={{ marginBottom: 0 }}>{dayTitle}</SectionTitle>
              <Text style={styles.dayNavIso}>{selectedDate}</Text>
            </View>
            <Pressable
              onPress={() => !isToday && goToDay(shiftLocalISO(selectedDate, 1))}
              disabled={isToday}
              style={[styles.dayNavBtn, isToday && { opacity: 0.3 }]}
              hitSlop={8}
            >
              <Icon name="chevron-right" size={18} color={colors.text} />
            </Pressable>
          </View>
          {isHealthConnectSupported() && healthState === 'connected' && (
            <Button
              title="Actualiser depuis Google Health"
              icon="refresh"
              onPress={handleRefreshHealthDay}
              loading={refreshingHealthDay || dayLoading}
              variant="ghost"
              style={{ marginBottom: spacing.md }}
            />
          )}
          <View style={styles.grid}>
            {FIELD_DEFS.map(({ key, label, unit, icon }) => (
              <View key={key as string} style={styles.gridItem}>
                <View style={styles.fieldLabelRow}>
                  <Icon name={icon} size={12} color={colors.textMuted} />
                  <Text style={styles.fieldLabel}>{label}{unit ? ` (${unit})` : ''}</Text>
                </View>
                <Input
                  keyboardType="numeric"
                  value={form[key as string] ?? ''}
                  onChangeText={(t) => setForm((f) => ({ ...f, [key as string]: t }))}
                  placeholder="-"
                />
              </View>
            ))}
          </View>
          <View style={styles.textGrid}>
            {TEXT_FIELD_DEFS.map(({ key, label, icon, placeholder }) => (
              <View key={key as string} style={styles.textGridItem}>
                <View style={styles.fieldLabelRow}>
                  <Icon name={icon} size={12} color={colors.textMuted} />
                  <Text style={styles.fieldLabel}>{label}</Text>
                </View>
                <Input
                  value={form[key as string] ?? ''}
                  onChangeText={(t) => setForm((f) => ({ ...f, [key as string]: t }))}
                  placeholder={placeholder}
                />
              </View>
            ))}
          </View>
          <View style={[styles.fieldLabelRow, { marginTop: spacing.sm, marginBottom: spacing.xs }]}>
            <Icon name="cycle" size={12} color={colors.textMuted} />
            <Text style={styles.fieldLabel}>Cycle menstruel</Text>
          </View>
          <View style={styles.phaseRow}>
            {CYCLE_PHASES.map((phase) => (
              <Pressable key={phase} onPress={() => setCyclePhase(cyclePhase === phase ? '' : phase)}>
                <Badge label={phase} color={cyclePhase === phase ? colors.secondary : colors.textFaint} />
              </Pressable>
            ))}
          </View>
          <Button title="Enregistrer" onPress={handleSave} loading={saving} style={{ marginTop: spacing.lg }} />
          {showDietButton && (
            <Button
              title="J'ai respecté ma diète hier"
              icon="check-circle"
              onPress={handleDietRespected}
              loading={dietBusy}
              variant="secondary"
              style={{ marginTop: spacing.sm }}
            />
          )}
        </Card>
      )}

      {!readOnly && isHealthConnectSupported() && (
        <Card style={{ marginTop: spacing.lg }}>
          <SectionTitle icon="link">Synchronisation santé</SectionTitle>
          {healthState === 'connected' ? (
            <>
              <View style={styles.healthStatusRow}>
                <Icon name="check-circle" size={14} color={colors.success} />
                <Text style={styles.healthStatusText}>Health Connect connecté</Text>
              </View>
              {healthPerms && (
                <Text style={styles.permLine}>
                  Pas {healthPerms.steps ? '✓' : '✗'} · Sommeil {healthPerms.sleep ? '✓' : '✗'} · Nutrition {healthPerms.nutrition ? '✓' : '✗'}
                </Text>
              )}
              {healthPerms && (!healthPerms.sleep || !healthPerms.nutrition) && (
                <Button
                  title="Corriger les permissions"
                  icon="settings"
                  onPress={async () => {
                    const result = await connectHealthConnect();
                    if (result.permissions) setHealthPerms(result.permissions);
                    openHealthSettings();
                  }}
                  variant="ghost"
                  style={{ marginTop: spacing.xs }}
                />
              )}
              <Button
                title="Rattraper 1 mois"
                icon="history"
                onPress={handleCatchup}
                loading={catchingUp}
                variant="secondary"
                style={{ marginTop: spacing.sm }}
              />
            </>
          ) : (
            <Button
              title="Connecter Health Connect"
              icon="link"
              onPress={handleConnectHealth}
              loading={connectingHealth}
              variant="secondary"
            />
          )}
          <Text style={styles.healthHint}>
            Pas + sommeil + macros via Health Connect. Poids : jamais auto (saisie manuelle).{'\n'}
            Macros : MyFitnessPal → Apps &amp; Devices → Health Connect (pas d’API MFP directe).{'\n'}
            Sommeil : doit être écrit dans Health Connect par Fit / ta montre (l’écran Fit seul ne suffit pas).
          </Text>
        </Card>
      )}

      <SectionTitle style={{ marginTop: spacing.xl }} icon="calendar">Historique</SectionTitle>
      {history.length === 0 ? (
        <EmptyState icon="journal" title="Aucune entrée précédente" />
      ) : (
        history.map((entry) => (
          <Pressable
            key={entry.id}
            onPress={() => handleEditHistoryDay(entry.entry_date)}
            disabled={readOnly}
            style={({ pressed }) => [pressed && !readOnly && { opacity: 0.7 }]}
          >
            <Card style={{ marginBottom: spacing.md }}>
              <View style={styles.historyHeaderRow}>
                <Text style={styles.historyDate}>{formatDateFR(entry.entry_date)}</Text>
                {!readOnly && <Icon name="edit" size={14} color={colors.textFaint} />}
              </View>
              <View style={styles.historyRow}>
                {entry.weight != null && (
                  <View style={styles.historyStatRow}><Icon name="scale" size={12} color={colors.textMuted} /><Text style={styles.historyStat}>{entry.weight}kg</Text></View>
                )}
                {entry.sleep_hours != null && (
                  <View style={styles.historyStatRow}><Icon name="moon" size={12} color={colors.textMuted} /><Text style={styles.historyStat}>{entry.sleep_hours}h</Text></View>
                )}
                {entry.steps != null && (
                  <View style={styles.historyStatRow}><Icon name="footsteps" size={12} color={colors.textMuted} /><Text style={styles.historyStat}>{entry.steps}</Text></View>
                )}
                {entry.kcals != null && (
                  <View style={styles.historyStatRow}><Icon name="flame" size={12} color={colors.textMuted} /><Text style={styles.historyStat}>{entry.kcals}kcal</Text></View>
                )}
              </View>
            </Card>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

function computeStreak(entries: JournalEntryDTO[]): number {
  const dates = new Set(entries.map((e) => e.entry_date));
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const iso = cursor.toISOString().slice(0, 10);
    if (!dates.has(iso)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl + TAB_BAR_CLEARANCE },
  streakBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.goldSoft,
    borderRadius: 16, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.gold,
  },
  streakText: { color: colors.gold, fontWeight: '800', flex: 1, fontSize: fontSize.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  gridItem: { width: '31%' },
  textGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  textGridItem: { width: '47%' },
  phaseRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.xs },
  fieldLabel: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600' },
  historyHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  historyDate: { color: colors.text, fontWeight: '800', textTransform: 'capitalize' },
  historyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  historyStatRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  historyStat: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '600' },
  healthStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  healthStatusText: { color: colors.success, fontSize: fontSize.sm, fontWeight: '700' },
  permLine: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: spacing.xs, fontWeight: '600' },
  healthHint: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: spacing.sm, lineHeight: 16 },
  dayNavRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  dayNavBtn: {
    width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: colors.border,
  },
  dayNavCenter: { flex: 1, alignItems: 'center' },
  dayNavIso: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: 2 },
});

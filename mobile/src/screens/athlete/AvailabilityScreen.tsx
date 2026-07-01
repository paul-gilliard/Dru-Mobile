import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { listAvailability, setAvailability } from '../../api/resources';
import { apiErrorMessage } from '../../api/client';
import { AvailabilityDTO } from '../../api/types';
import { Card, ErrorView, LoadingView, SectionTitle } from '../../components/ui';
import { colors, fontSize, radius, spacing } from '../../theme';
import { formatDateFR, isoDaysFromNow, todayISO } from '../../utils/format';

const TIMESLOT_LABELS: Record<string, string> = { morning: 'Matin', afternoon: 'Après-midi', day: 'Journée' };

export default function AvailabilityScreen() {
  const { user } = useAuth();
  const isCoach = user?.role === 'coach';
  const [slots, setSlots] = useState<AvailabilityDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await listAvailability(todayISO(), isoDaysFromNow(13));
      setSlots(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async (slot: AvailabilityDTO) => {
    if (!isCoach) return;
    try {
      await setAvailability({ date: slot.date, location: slot.location, timeslot: slot.timeslot, available: !slot.available });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  if (loading) return <LoadingView label="Chargement des disponibilités..." />;
  if (error) return <ErrorView message={error} onRetry={load} />;

  const byDate = new Map<string, AvailabilityDTO[]>();
  for (const s of slots) {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date)!.push(s);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
    >
      <Text style={styles.hint}>
        {isCoach ? 'Touche un créneau pour basculer sa disponibilité.' : 'Créneaux définis par ton coach.'}
      </Text>
      {Array.from(byDate.entries()).map(([date, daySlots]) => (
        <Card key={date} style={{ marginBottom: spacing.md }}>
          <SectionTitle>{formatDateFR(date)}</SectionTitle>
          <View style={styles.slotsRow}>
            {daySlots.map((slot) => (
              <View
                key={slot.id}
                onTouchEnd={() => toggle(slot)}
                style={[
                  styles.slot,
                  { backgroundColor: slot.available ? `${colors.success}26` : `${colors.danger}1A`, borderColor: slot.available ? colors.success : colors.border },
                ]}
              >
                <Text style={[styles.slotText, { color: slot.available ? colors.success : colors.textFaint }]}>
                  {TIMESLOT_LABELS[slot.timeslot] ?? slot.timeslot}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  hint: { color: colors.textMuted, marginBottom: spacing.md, fontSize: fontSize.sm },
  slotsRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  slot: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1 },
  slotText: { fontWeight: '600', fontSize: fontSize.sm },
});

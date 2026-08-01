import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { AthleteScopeProvider } from '../../context/AthleteScopeContext';
import { colors, fontSize, gradients, radius, spacing } from '../../theme';
import { CoachStackParamList } from '../../navigation/types';
import ProgramScreen from '../athlete/ProgramScreen';
import JournalScreen from '../athlete/JournalScreen';
import PerformanceScreen from '../athlete/PerformanceScreen';
import NutritionScreen from '../athlete/NutritionScreen';
import ObjectivesScreen from '../athlete/ObjectivesScreen';
import StatsScreen from '../athlete/StatsScreen';

type Route = RouteProp<CoachStackParamList, 'AthleteDetail'>;

const TABS = [
  { key: 'program', label: 'Programme', icon: '🏋️' },
  { key: 'journal', label: 'Journal', icon: '📓' },
  { key: 'performance', label: 'Perf.', icon: '📈' },
  { key: 'stats', label: 'Stats', icon: '📊' },
  { key: 'nutrition', label: 'Nutrition', icon: '🍽️' },
  { key: 'objectives', label: 'Objectifs', icon: '🎯' },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function AthleteDetailScreen() {
  const { params } = useRoute<Route>();
  const [active, setActive] = useState<TabKey>('program');
  const athleteId = Number(params.athleteId);

  return (
    <AthleteScopeProvider athleteId={athleteId} athleteName={params.athleteName} readOnly>
      <View style={styles.screen}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsBar} contentContainerStyle={styles.tabsContent}>
          {TABS.map((tab) => {
            const isActive = active === tab.key;
            return (
              <Pressable key={tab.key} onPress={() => setActive(tab.key)}>
                {isActive ? (
                  <LinearGradient colors={gradients.primary} style={styles.tabChip}>
                    <Text style={styles.tabLabelActive}>{tab.icon} {tab.label}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.tabChipInactive}>
                    <Text style={styles.tabLabel}>{tab.icon} {tab.label}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ flex: 1 }}>
          {active === 'program' && <ProgramScreen />}
          {active === 'journal' && <JournalScreen />}
          {active === 'performance' && <PerformanceScreen />}
          {active === 'stats' && <StatsScreen />}
          {active === 'nutrition' && <NutritionScreen />}
          {active === 'objectives' && <ObjectivesScreen />}
        </View>
      </View>
    </AthleteScopeProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  tabsBar: { borderBottomWidth: 1, borderBottomColor: colors.border, flexGrow: 0, backgroundColor: colors.backgroundAlt },
  tabsContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs },
  tabChip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill },
  tabChipInactive: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surface },
  tabLabel: { color: colors.textMuted, fontWeight: '700', fontSize: fontSize.xs },
  tabLabelActive: { color: '#fff', fontWeight: '800', fontSize: fontSize.xs },
});

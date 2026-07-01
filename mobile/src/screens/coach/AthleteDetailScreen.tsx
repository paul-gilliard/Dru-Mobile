import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { AthleteScopeProvider } from '../../context/AthleteScopeContext';
import { colors, fontSize, radius, spacing } from '../../theme';
import { CoachStackParamList } from '../../navigation/types';
import ProgramScreen from '../athlete/ProgramScreen';
import JournalScreen from '../athlete/JournalScreen';
import PerformanceScreen from '../athlete/PerformanceScreen';
import NutritionScreen from '../athlete/NutritionScreen';
import ObjectivesScreen from '../athlete/ObjectivesScreen';
import StatsScreen from '../athlete/StatsScreen';

type Route = RouteProp<CoachStackParamList, 'AthleteDetail'>;

const TABS = [
  { key: 'program', label: 'Programme' },
  { key: 'journal', label: 'Journal' },
  { key: 'performance', label: 'Perf.' },
  { key: 'stats', label: 'Stats' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'objectives', label: 'Objectifs' },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function AthleteDetailScreen() {
  const { params } = useRoute<Route>();
  const [active, setActive] = useState<TabKey>('program');

  return (
    <AthleteScopeProvider athleteId={params.athleteId} athleteName={params.athleteName} readOnly>
      <View style={styles.screen}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsBar} contentContainerStyle={styles.tabsContent}>
          {TABS.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActive(tab.key)}
              style={[styles.tabChip, active === tab.key && styles.tabChipActive]}
            >
              <Text style={[styles.tabLabel, active === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
            </Pressable>
          ))}
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
  tabsBar: { borderBottomWidth: 1, borderBottomColor: colors.border, flexGrow: 0 },
  tabsContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  tabChip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surface },
  tabChipActive: { backgroundColor: colors.primary },
  tabLabel: { color: colors.textMuted, fontWeight: '600', fontSize: fontSize.sm },
  tabLabelActive: { color: '#fff' },
});

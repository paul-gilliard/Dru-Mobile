import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { AthleteScopeProvider } from '../../context/AthleteScopeContext';
import { colors, fontSize, gradients, radius, spacing } from '../../theme';
import { CoachStackParamList } from '../../navigation/types';
import { Icon, IconName } from '../../components/Icon';
import ProgramScreen from '../athlete/ProgramScreen';
import JournalScreen from '../athlete/JournalScreen';
import PerformanceScreen from '../athlete/PerformanceScreen';
import NutritionScreen from '../athlete/NutritionScreen';
import ObjectivesScreen from '../athlete/ObjectivesScreen';
import StatsScreen from '../athlete/StatsScreen';

type Route = RouteProp<CoachStackParamList, 'AthleteDetail'>;

const TABS = [
  { key: 'program', label: 'Programme', icon: 'program' as IconName },
  { key: 'journal', label: 'Journal', icon: 'journal' as IconName },
  { key: 'performance', label: 'Perf.', icon: 'trend-up' as IconName },
  { key: 'stats', label: 'Stats', icon: 'stats' as IconName },
  { key: 'nutrition', label: 'Nutrition', icon: 'nutrition' as IconName },
  { key: 'objectives', label: 'Objectifs', icon: 'target' as IconName },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function AthleteDetailScreen() {
  const { params } = useRoute<Route>();
  const [active, setActive] = useState<TabKey>('program');
  const [mounted, setMounted] = useState<Record<TabKey, boolean>>({
    program: true,
    journal: false,
    performance: false,
    stats: false,
    nutrition: false,
    objectives: false,
  });
  const athleteId = Number(params.athleteId);

  const selectTab = (key: TabKey) => {
    setActive(key);
    setMounted((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  };

  const panes = useMemo(() => ([
    { key: 'program' as const, node: <ProgramScreen /> },
    { key: 'journal' as const, node: <JournalScreen /> },
    { key: 'performance' as const, node: <PerformanceScreen /> },
    { key: 'stats' as const, node: <StatsScreen /> },
    { key: 'nutrition' as const, node: <NutritionScreen /> },
    { key: 'objectives' as const, node: <ObjectivesScreen /> },
  ]), []);

  return (
    <AthleteScopeProvider athleteId={athleteId} athleteName={params.athleteName} readOnly>
      <View style={styles.screen}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsBar} contentContainerStyle={styles.tabsContent}>
          {TABS.map((tab) => {
            const isActive = active === tab.key;
            return (
              <Pressable key={tab.key} onPress={() => selectTab(tab.key)}>
                {isActive ? (
                  <LinearGradient colors={gradients.primary} style={styles.tabChip}>
                    <View style={styles.tabChipRow}>
                      <Icon name={tab.icon} size={14} color="#fff" />
                      <Text style={styles.tabLabelActive}>{tab.label}</Text>
                    </View>
                  </LinearGradient>
                ) : (
                  <View style={styles.tabChipInactive}>
                    <View style={styles.tabChipRow}>
                      <Icon name={tab.icon} size={14} color={colors.textMuted} />
                      <Text style={styles.tabLabel}>{tab.label}</Text>
                    </View>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ flex: 1 }}>
          {panes.map((pane) => {
            if (!mounted[pane.key]) return null;
            return (
              <View
                key={pane.key}
                style={[styles.pane, active === pane.key ? styles.paneActive : styles.paneHidden]}
                pointerEvents={active === pane.key ? 'auto' : 'none'}
              >
                {pane.node}
              </View>
            );
          })}
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
  tabChipRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tabChipInactive: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surface },
  tabLabel: { color: colors.textMuted, fontWeight: '700', fontSize: fontSize.xs },
  tabLabelActive: { color: '#fff', fontWeight: '800', fontSize: fontSize.xs },
  pane: { ...StyleSheet.absoluteFill },
  paneActive: { opacity: 1, zIndex: 1 },
  paneHidden: { opacity: 0, zIndex: 0 },
});

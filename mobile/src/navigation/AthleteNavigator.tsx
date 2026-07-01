import React from 'react';
import { Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '../theme';
import { useAuth } from '../context/AuthContext';
import { AthleteScopeProvider } from '../context/AthleteScopeContext';
import { AthleteStackParamList } from './types';
import HomeScreen from '../screens/athlete/HomeScreen';
import ProgramScreen from '../screens/athlete/ProgramScreen';
import SessionDetailScreen from '../screens/athlete/SessionDetailScreen';
import JournalScreen from '../screens/athlete/JournalScreen';
import NutritionScreen from '../screens/athlete/NutritionScreen';
import MoreScreen from '../screens/athlete/MoreScreen';

const Stack = createNativeStackNavigator<AthleteStackParamList>();
const Tab = createBottomTabNavigator();

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.text,
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.background },
};

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Accueil' }} />
      <Stack.Screen name="SessionDetail" component={SessionDetailScreen} options={{ title: 'Séance' }} />
      <Stack.Screen name="Program" component={ProgramScreen} options={{ title: 'Programme' }} />
      <Stack.Screen name="Journal" component={JournalScreen} options={{ title: 'Journal' }} />
    </Stack.Navigator>
  );
}

function ProgramStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="Program" component={ProgramScreen} options={{ title: 'Programme' }} />
      <Stack.Screen name="SessionDetail" component={SessionDetailScreen} options={{ title: 'Séance' }} />
    </Stack.Navigator>
  );
}

function JournalStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="Journal" component={JournalScreen} options={{ title: 'Journal' }} />
    </Stack.Navigator>
  );
}

function NutritionStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="Nutrition" component={NutritionScreen} options={{ title: 'Nutrition' }} />
    </Stack.Navigator>
  );
}

function MoreStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="More" component={MoreScreen} options={{ title: 'Plus' }} />
    </Stack.Navigator>
  );
}

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

export default function AthleteNavigator() {
  const { user } = useAuth();

  return (
    <AthleteScopeProvider athleteId={user?.id ?? 0} athleteName={user?.display_name ?? ''} readOnly={false}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textFaint,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 66, paddingTop: 6, paddingBottom: 10 },
          tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
        }}
      >
        <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: 'Accueil', tabBarIcon: () => <TabIcon emoji="🏠" /> }} />
        <Tab.Screen name="ProgramTab" component={ProgramStack} options={{ title: 'Programme', tabBarIcon: () => <TabIcon emoji="🏋️" /> }} />
        <Tab.Screen name="JournalTab" component={JournalStack} options={{ title: 'Journal', tabBarIcon: () => <TabIcon emoji="📓" /> }} />
        <Tab.Screen name="NutritionTab" component={NutritionStack} options={{ title: 'Nutrition', tabBarIcon: () => <TabIcon emoji="🍽️" /> }} />
        <Tab.Screen name="MoreTab" component={MoreStack} options={{ title: 'Plus', tabBarIcon: () => <TabIcon emoji="☰" /> }} />
      </Tab.Navigator>
    </AthleteScopeProvider>
  );
}

import React from 'react';
import { Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '../theme';
import { CoachStackParamList } from './types';
import CoachDashboardScreen from '../screens/coach/CoachDashboardScreen';
import AthleteDetailScreen from '../screens/coach/AthleteDetailScreen';
import CreateAthleteScreen from '../screens/coach/CreateAthleteScreen';
import ExerciseBankScreen from '../screens/coach/ExerciseBankScreen';
import FoodBankScreen from '../screens/coach/FoodBankScreen';
import CoachMoreScreen from '../screens/coach/CoachMoreScreen';
import UsersScreen from '../screens/coach/UsersScreen';
import WeeklyBilanScreen from '../screens/coach/WeeklyBilanScreen';
import SessionDetailScreen from '../screens/athlete/SessionDetailScreen';
import AvailabilityScreen from '../screens/athlete/AvailabilityScreen';

const Stack = createNativeStackNavigator<CoachStackParamList>();
const Tab = createBottomTabNavigator();

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.text,
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.background },
};

function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="Dashboard" component={CoachDashboardScreen} options={{ title: 'Mes athlètes' }} />
      <Stack.Screen
        name="AthleteDetail"
        component={AthleteDetailScreen}
        options={({ route }) => ({ title: route.params.athleteName })}
      />
      <Stack.Screen name="SessionDetail" component={SessionDetailScreen} options={{ title: 'Séance' }} />
      <Stack.Screen name="CreateAthlete" component={CreateAthleteScreen} options={{ title: 'Nouvel athlète' }} />
    </Stack.Navigator>
  );
}

function ExerciseBankStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="Dashboard" component={ExerciseBankScreen} options={{ title: 'Banque d\'exercices' }} />
    </Stack.Navigator>
  );
}

function FoodBankStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="Dashboard" component={FoodBankScreen} options={{ title: 'Banque d\'aliments' }} />
    </Stack.Navigator>
  );
}

function AvailabilityStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="Dashboard" component={AvailabilityScreen} options={{ title: 'Disponibilités' }} />
    </Stack.Navigator>
  );
}

function MoreStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="Dashboard" component={CoachMoreScreen} options={{ title: 'Plus' }} />
      <Stack.Screen name="Users" component={UsersScreen} options={{ title: 'Utilisateurs' }} />
      <Stack.Screen name="WeeklyBilan" component={WeeklyBilanScreen} options={{ title: 'Bilan Hebdo' }} />
    </Stack.Navigator>
  );
}

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

export default function CoachNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 66, paddingTop: 6, paddingBottom: 10 },
        tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
      }}
    >
      <Tab.Screen name="DashboardTab" component={DashboardStack} options={{ title: 'Athlètes', tabBarIcon: () => <TabIcon emoji="👥" /> }} />
      <Tab.Screen name="ExercisesTab" component={ExerciseBankStack} options={{ title: 'Exercices', tabBarIcon: () => <TabIcon emoji="🏋️" /> }} />
      <Tab.Screen name="FoodsTab" component={FoodBankStack} options={{ title: 'Aliments', tabBarIcon: () => <TabIcon emoji="🍎" /> }} />
      <Tab.Screen name="AvailabilityTab" component={AvailabilityStack} options={{ title: 'Dispo', tabBarIcon: () => <TabIcon emoji="🗓️" /> }} />
      <Tab.Screen name="MoreTab" component={MoreStack} options={{ title: 'Plus', tabBarIcon: () => <TabIcon emoji="☰" /> }} />
    </Tab.Navigator>
  );
}

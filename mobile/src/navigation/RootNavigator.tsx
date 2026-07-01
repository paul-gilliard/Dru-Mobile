import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoadingView } from '../components/ui';
import { colors } from '../theme';
import LoginScreen from '../screens/auth/LoginScreen';
import AthleteNavigator from './AthleteNavigator';
import CoachNavigator from './CoachNavigator';

const Stack = createNativeStackNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

export default function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingView label="Chargement..." />;

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : user.role === 'coach' ? (
          <Stack.Screen name="CoachApp" component={CoachNavigator} />
        ) : (
          <Stack.Screen name="AthleteApp" component={AthleteNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../context/AuthContext';
import { Button, Input } from '../../components/ui';
import { colors, fontSize, radius, spacing } from '../../theme';

export default function LoginScreen() {
  const { login, isAuthenticating, error, clearError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async () => {
    if (!username || !password) return;
    try {
      await login(username.trim(), password);
    } catch {
      // l'erreur est déjà exposée via le contexte d'auth
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>D</Text>
        </View>
        <Text style={styles.title}>Dru</Text>
        <Text style={styles.subtitle}>Coaching sportif & nutrition</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Identifiant</Text>
        <Input
          value={username}
          onChangeText={(t) => { setUsername(t); clearError(); }}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="coach ou athlete"
        />

        <Text style={[styles.label, { marginTop: spacing.lg }]}>Mot de passe</Text>
        <Input
          value={password}
          onChangeText={(t) => { setPassword(t); clearError(); }}
          secureTextEntry
          placeholder="••••••••"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title="Se connecter"
          onPress={handleSubmit}
          loading={isAuthenticating}
          disabled={!username || !password}
          style={{ marginTop: spacing.xl }}
        />

        <Text style={styles.hint}>
          Démo : coach / coach123 · athlete / athlete123
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing.xl },
  header: { alignItems: 'center', marginBottom: spacing.xxl },
  logoCircle: {
    width: 72, height: 72, borderRadius: radius.lg, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  logoText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  title: { color: colors.text, fontSize: 32, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: fontSize.md, marginTop: spacing.xs },
  form: {},
  label: { color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.xs, fontWeight: '600' },
  error: { color: colors.danger, marginTop: spacing.md, textAlign: 'center' },
  hint: { color: colors.textFaint, fontSize: fontSize.xs, textAlign: 'center', marginTop: spacing.lg },
});

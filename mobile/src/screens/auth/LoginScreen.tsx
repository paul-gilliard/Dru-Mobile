import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { Button, Input } from '../../components/ui';
import { colors, fontSize, gradients, radius, shadow, spacing } from '../../theme';

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
    <LinearGradient colors={gradients.hero} style={styles.gradientRoot}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <StatusBar style="light" />
        <View style={styles.header}>
          <LinearGradient colors={gradients.primary} style={[styles.logoCircle, shadow.glow]}>
            <Text style={styles.logoText}>D</Text>
          </LinearGradient>
          <Text style={styles.title}>DRU</Text>
          <Text style={styles.subtitle}>NO PAIN. NO GAIN. NO EXCUSES.</Text>
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
            title="C'est parti 🔥"
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientRoot: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  header: { alignItems: 'center', marginBottom: spacing.xxl },
  logoCircle: {
    width: 84, height: 84, borderRadius: radius.xl,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
  },
  logoText: { color: '#fff', fontSize: 38, fontWeight: '900' },
  title: { color: colors.text, fontSize: 42, fontWeight: '900', letterSpacing: 2 },
  subtitle: {
    color: colors.primary, fontSize: fontSize.xs, marginTop: spacing.sm, fontWeight: '800', letterSpacing: 1.5,
  },
  form: {},
  label: {
    color: colors.textMuted, fontSize: fontSize.xs, marginBottom: spacing.xs, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  error: { color: colors.danger, marginTop: spacing.md, textAlign: 'center', fontWeight: '600' },
  hint: { color: colors.textFaint, fontSize: fontSize.xs, textAlign: 'center', marginTop: spacing.lg },
});

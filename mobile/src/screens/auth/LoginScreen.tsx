import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { Button, Input } from '../../components/ui';
import { colors, fontFamily, fontSize, gradients, radius, shadow, spacing } from '../../theme';

export default function LoginScreen() {
  const { login, register, isAuthenticating, error, clearError } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async () => {
    if (!username || !password) return;
    try {
      if (mode === 'login') {
        await login(username.trim(), password);
      } else {
        await register({
          username: username.trim(),
          password,
          display_name: displayName.trim() || undefined,
        });
      }
    } catch {
      // erreur via contexte
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
          <LinearGradient colors={gradients.primary} style={[styles.logoCircle, shadow.glow, { shadowColor: colors.primary }]}>
            <Text style={[styles.logoText, { color: colors.textOnAccent }]}>D</Text>
          </LinearGradient>
          <Text style={styles.title}>DRU</Text>
          <Text style={[styles.subtitle, { color: colors.primary }]}>NO PAIN. NO GAIN. NO EXCUSES.</Text>
        </View>

        <View style={styles.modeRow}>
          <Pressable onPress={() => { setMode('login'); clearError(); }} style={[styles.modeBtn, mode === 'login' && styles.modeActive]}>
            <Text style={[styles.modeText, mode === 'login' && styles.modeTextActive]}>Connexion</Text>
          </Pressable>
          <Pressable onPress={() => { setMode('register'); clearError(); }} style={[styles.modeBtn, mode === 'register' && styles.modeActive]}>
            <Text style={[styles.modeText, mode === 'register' && styles.modeTextActive]}>Créer un compte</Text>
          </Pressable>
        </View>

        <View style={styles.form}>
          {mode === 'register' && (
            <>
              <Text style={styles.label}>Nom affiché</Text>
              <Input
                value={displayName}
                onChangeText={(t) => { setDisplayName(t); clearError(); }}
                placeholder="Ton prénom"
              />
            </>
          )}

          <Text style={[styles.label, mode === 'register' && { marginTop: spacing.lg }]}>
            {mode === 'login' ? 'Email ou identifiant' : 'Email'}
          </Text>
          <Input
            value={username}
            onChangeText={(t) => { setUsername(t); clearError(); }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder={mode === 'login' ? 'ex: julie@mail.com' : 'ex: julie@mail.com'}
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
            title={mode === 'login' ? "C'est parti" : "S'inscrire"}
            onPress={handleSubmit}
            loading={isAuthenticating}
            disabled={!username || !password}
            style={{ marginTop: spacing.xl }}
          />

          <Text style={styles.hint}>
            {mode === 'login'
              ? 'Connecte-toi avec ton email (ou ton ancien identifiant) et ton mot de passe.'
              : 'L’email doit être unique. Un coach t’invitera ensuite.'}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientRoot: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  logoCircle: {
    width: 84, height: 84, borderRadius: radius.xl,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
  },
  logoText: { fontSize: 38, fontFamily: fontFamily.black },
  title: { color: colors.text, fontSize: 44, fontFamily: fontFamily.black, letterSpacing: 1 },
  subtitle: {
    fontSize: fontSize.xs, marginTop: spacing.sm, fontFamily: fontFamily.extrabold, letterSpacing: 1.5,
  },
  modeRow: {
    flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md,
    padding: 4, marginBottom: spacing.lg,
  },
  modeBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.sm },
  modeActive: { backgroundColor: colors.surfaceHi },
  modeText: { color: colors.textFaint, fontWeight: '700', fontSize: fontSize.sm },
  modeTextActive: { color: colors.text },
  form: {},
  label: {
    color: colors.textMuted, fontSize: fontSize.xs, marginBottom: spacing.xs, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  error: { color: colors.danger, marginTop: spacing.md, textAlign: 'center', fontWeight: '600' },
  hint: { color: colors.textFaint, fontSize: fontSize.xs, textAlign: 'center', marginTop: spacing.lg, lineHeight: 16 },
});

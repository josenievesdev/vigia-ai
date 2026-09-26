import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, Button, Card, Icon, KeyboardAwareScroll, Notice, TextField } from '@/components/ui';
import { isBackendConfigured } from '@/lib/supabase';
import { toAccountError } from '@/services/account/api';
import { isValidNationalId, normalizeNationalId } from '@/services/account/identity';
import { useAuthStore } from '@/store/useAuthStore';
import { Radius, Spacing, useTheme } from '@/theme';

import { enterDemo, signIn } from './session';

/** Ingreso con cédula y contraseña. La cuenta la crea el instalador. */
export function LoginScreen() {
  const c = useTheme();
  const status = useAuthStore((s) => s.status);
  const notice = useAuthStore((s) => s.notice);
  const [nationalId, setNationalId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'signIn' | 'demo' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const configured = isBackendConfigured();

  if (status === 'loading') {
    // En el teléfono lo cubre la pantalla de inicio; en la web se ve este indicador.
    return (
      <View style={[styles.loading, { backgroundColor: c.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  const submit = () => {
    const id = normalizeNationalId(nationalId);
    if (!isValidNationalId(id)) {
      setError('Escribe tu número de cédula (entre 6 y 10 dígitos).');
      return;
    }
    if (!password) {
      setError('Escribe tu contraseña.');
      return;
    }
    setError(null);
    setBusy('signIn');
    signIn(id, password)
      .catch((e: unknown) => setError(toAccountError(e).message))
      .finally(() => setBusy(null));
  };

  const demo = () => {
    setBusy('demo');
    enterDemo().catch((e: unknown) => {
      setError(toAccountError(e).message);
      setBusy(null);
    });
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]}>
      <KeyboardAwareScroll contentContainerStyle={styles.content}>
        <View style={styles.brand}>
          <View style={[styles.logo, { backgroundColor: c.primarySoft }]}>
            <Icon name="barn" size={40} color={c.primary} />
          </View>
          <AppText variant="title">VigíaAI</AppText>
          <AppText muted style={styles.centerText}>
            Monitoreo y automatización de granjas
          </AppText>
        </View>

        <Card style={styles.card}>
          <AppText variant="heading">Ingresar</AppText>
          {notice ? <Notice tone="warning" text={notice} /> : null}
          {!configured ? (
            <Notice tone="info" text="Servidor no configurado (.env): por ahora solo está disponible la demo." />
          ) : null}
          <TextField
            label="Cédula"
            value={nationalId}
            onChangeText={setNationalId}
            placeholder="Número de cédula"
            keyboardType="number-pad"
            autoComplete="username"
            textContentType="username"
            maxLength={13}
            editable={configured}
          />
          <TextField
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            editable={configured}
          />
          {error ? <Notice tone="critical" text={error} /> : null}
          <Button label="Entrar" onPress={submit} loading={busy === 'signIn'} disabled={!configured || busy === 'demo'} />
          <AppText variant="caption" muted style={styles.centerText}>
            La primera vez, tu contraseña es tu cédula. ¿La olvidaste? Pídele a tu instalador que la restablezca.
          </AppText>
        </Card>

        <Button
          label="Ver demo sin cuenta"
          icon="play-circle-outline"
          variant="secondary"
          onPress={demo}
          loading={busy === 'demo'}
          disabled={busy === 'signIn'}
        />
      </KeyboardAwareScroll>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.lg,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  brand: { alignItems: 'center', gap: Spacing.xs },
  logo: {
    width: 72,
    height: 72,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  centerText: { textAlign: 'center' },
  card: { gap: Spacing.md },
});

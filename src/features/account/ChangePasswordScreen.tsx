import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText, Button, Card, Checkbox, Notice, Screen, TextField } from '@/components/ui';
import { toAccountError } from '@/services/account/api';
import { MIN_PASSWORD_LENGTH, passwordProblem } from '@/services/account/identity';
import { useAuthStore } from '@/store/useAuthStore';
import { Spacing, useTheme } from '@/theme';

import { CONSENT_LABEL } from './DataConsentScreen';
import { completePasswordChange, signOut } from './session';

interface ChangePasswordScreenProps {
  /**
   * `setup`: primer ingreso, obligatorio (la contraseña inicial es la cédula, que no es secreta).
   * Al guardar, la ruta deja de estar permitida y la navegación lleva sola al inicio.
   * `change`: cambio voluntario desde Más → Mi cuenta.
   */
  mode: 'setup' | 'change';
}

export function ChangePasswordScreen({ mode }: ChangePasswordScreenProps) {
  const c = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  if (!profile) return null;
  const setup = mode === 'setup';
  const firstName = profile.fullName.split(' ')[0];
  // En el primer ingreso también se pide la autorización de datos (Ley 1581), en el mismo paso.
  const askConsent = setup && profile.role !== 'admin' && profile.policyAccepted === false;

  const submit = () => {
    const problem = passwordProblem(password, confirm, profile.nationalId);
    if (problem) {
      setError(problem);
      return;
    }
    if (askConsent && !consent) {
      setError('Para continuar, acepta la autorización de tratamiento de datos.');
      return;
    }
    setError(null);
    setSaving(true);
    completePasswordChange(password, askConsent)
      .then(() => {
        setDone(true);
        setPassword('');
        setConfirm('');
      })
      .catch((e: unknown) => setError(toAccountError(e).message))
      .finally(() => setSaving(false));
  };

  if (done && !setup) {
    return (
      <Screen topInset={false}>
        <Notice tone="normal" text="Contraseña actualizada. Úsala la próxima vez que entres." />
        <Button label="Volver" icon="arrow-left" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen
      // El primer ingreso no tiene barra de navegación: la pantalla respeta el área segura de arriba.
      topInset={setup}
      title={setup ? 'Crea tu contraseña' : undefined}
      subtitle={
        setup
          ? `Hola, ${firstName}. Por seguridad, cambia la contraseña inicial (tu cédula) antes de continuar.`
          : 'Elige una contraseña nueva.'
      }>
      <Card style={styles.card}>
        <TextField
          label="Contraseña nueva"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <TextField
          label="Repite la contraseña"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <AppText variant="caption" muted>
          Mínimo {MIN_PASSWORD_LENGTH} caracteres y distinta de tu cédula. Guárdala: tu instalador no la conoce.
        </AppText>
        {askConsent ? (
          <Checkbox checked={consent} onChange={setConsent} label={CONSENT_LABEL}>
            <AppText
              variant="caption"
              color={c.primary}
              accessibilityRole="link"
              onPress={() => router.push('/data-policy')}
              style={styles.policyLink}>
              Leer la política de datos
            </AppText>
          </Checkbox>
        ) : null}
        {error ? <Notice tone="critical" text={error} /> : null}
        <Button label={setup ? 'Guardar y entrar' : 'Guardar contraseña'} onPress={submit} loading={saving} />
      </Card>
      {setup ? <Button label="Cerrar sesión" variant="ghost" icon="logout" onPress={() => void signOut()} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md },
  policyLink: { marginLeft: 24 + Spacing.sm, paddingVertical: Spacing.xs },
});

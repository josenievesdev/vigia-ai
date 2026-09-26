import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText, Button, Card, Checkbox, Notice, Screen } from '@/components/ui';
import { toAccountError } from '@/services/account/api';
import { DATA_POLICY } from '@/services/account/dataPolicy';
import { useAuthStore } from '@/store/useAuthStore';
import { Spacing } from '@/theme';

import { acceptPolicyAndContinue, signOut } from './session';

export const CONSENT_LABEL = 'Autorizo el tratamiento de mis datos personales según la política de datos de VigíaAI.';

/**
 * Autorización previa, expresa e informada (Ley 1581 de 2012) para quien ya tenía cuenta y aún no
 * la dio. Queda registrada con la versión de la política y la fecha.
 */
export function DataConsentScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstName = profile?.fullName.split(' ')[0] ?? '';

  const submit = () => {
    setError(null);
    setSaving(true);
    acceptPolicyAndContinue()
      .catch((e: unknown) => setError(toAccountError(e).message))
      .finally(() => setSaving(false));
  };

  return (
    <Screen
      title="Autorización de datos"
      subtitle={`Hola, ${firstName}. Antes de continuar necesitamos tu autorización para tratar tus datos, como lo pide la Ley 1581 de 2012.`}>
      <Card style={styles.card}>
        <AppText>{DATA_POLICY.summary}</AppText>
        <Button
          label="Leer la política completa"
          icon="file-document-outline"
          variant="secondary"
          onPress={() => router.push('/data-policy')}
        />
      </Card>
      <Checkbox checked={accepted} onChange={setAccepted} label={CONSENT_LABEL} />
      {error ? <Notice tone="critical" text={error} /> : null}
      <Button label="Aceptar y continuar" onPress={submit} disabled={!accepted} loading={saving} />
      <Button label="Cerrar sesión" variant="ghost" icon="logout" onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md },
});

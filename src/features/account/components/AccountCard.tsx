import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card, Notice } from '@/components/ui';
import { subscriptionLabel } from '@/services/account/subscription';
import { ROLE_LABELS } from '@/services/account/types';
import { useAuthStore } from '@/store/useAuthStore';
import { Radius, Spacing, useTheme } from '@/theme';
import { formatNationalId } from '@/utils/format';

import { leaveDemo, signOut, stopViewingClient } from '../session';
import { SUBSCRIPTION_TONES } from './subscriptionTone';

/** "Mi cuenta" en Más: quién está conectado, su suscripción y cerrar sesión. */
export function AccountCard() {
  const c = useTheme();
  const status = useAuthStore((s) => s.status);
  const profile = useAuthStore((s) => s.profile);
  const subscription = useAuthStore((s) => s.subscription);
  const viewing = useAuthStore((s) => s.viewing);
  const offline = useAuthStore((s) => s.offline);

  if (status === 'demo') {
    return (
      <Card style={styles.card}>
        <AppText variant="heading">Modo demo sin cuenta</AppText>
        <AppText variant="caption" muted>
          Granja de ejemplo. Los cambios se guardan solo en este teléfono.
        </AppText>
        <Button label="Iniciar sesión" icon="login" variant="secondary" onPress={leaveDemo} />
      </Card>
    );
  }
  if (!profile) return null;

  const initials = profile.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: c.primarySoft }]}>
          <AppText variant="label" color={c.primary}>
            {initials}
          </AppText>
        </View>
        <View style={styles.flex}>
          <AppText variant="label">{profile.fullName}</AppText>
          <AppText variant="caption" muted>
            {ROLE_LABELS[profile.role]} · C.C. {formatNationalId(profile.nationalId)}
          </AppText>
        </View>
      </View>
      {profile.role === 'client' && subscription ? (
        <Badge label={subscriptionLabel(subscription)} tone={SUBSCRIPTION_TONES[subscription.status]} dot />
      ) : null}
      {offline ? <Notice tone="warning" text="Sin conexión: se muestran los últimos datos guardados en el teléfono." /> : null}
      {viewing ? (
        <>
          <Notice tone="info" text={`Estás viendo la granja de ${viewing.ownerName} (${viewing.farmName}).`} />
          <Button label="Volver a la granja demo" variant="secondary" icon="arrow-left" onPress={() => void stopViewingClient()} />
        </>
      ) : null}
      <View style={styles.actions}>
        <Button label="Cambiar contraseña" icon="lock-reset" variant="secondary" onPress={() => router.push('/change-password')} />
        <Button label="Cerrar sesión" icon="logout" variant="ghost" onPress={() => void signOut()} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 44, height: 44, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
  actions: { gap: Spacing.sm },
});

import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Icon, Notice, Screen } from '@/components/ui';
import { getSupabase } from '@/lib/supabase';
import { installerContact, toAccountError } from '@/services/account/api';
import { formatDate } from '@/services/account/subscription';
import { useAuthStore } from '@/store/useAuthStore';
import { Radius, Spacing, useTheme } from '@/theme';

import { refreshAccount, signOut } from './session';

/**
 * Suscripción vencida. El bloqueo real lo hace la base de datos (sin pago no entrega los datos
 * de la granja); esta pantalla explica qué pasó y a quién llamar.
 */
export function BlockedScreen() {
  const c = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const [contact, setContact] = useState<{ fullName: string; phone: string | null } | null>(null);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    installerContact(getSupabase())
      .then(setContact)
      .catch(() => setContact(null));
  }, []);

  const recheck = () => {
    setChecking(true);
    setMessage(null);
    refreshAccount()
      .then(() => setMessage('Todavía no aparece el pago. Si ya pagaste, pídele a tu instalador que lo registre.'))
      .catch((e: unknown) => setMessage(toAccountError(e).message))
      .finally(() => setChecking(false));
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={[styles.icon, { backgroundColor: c.warningSoft }]}>
          <Icon name="lock-clock" size={40} color={c.warning} />
        </View>
        <AppText variant="title" style={styles.center}>
          Suscripción vencida
        </AppText>
        <AppText muted style={styles.center}>
          {profile?.paidUntil
            ? `Tu suscripción venció el ${formatDate(profile.paidUntil)}.`
            : 'Tu cuenta no tiene un pago registrado.'}{' '}
          Tus datos están guardados; vuelven a verse cuando se registre el pago.
        </AppText>
      </View>

      <Card style={styles.card}>
        <AppText variant="heading">Comunícate con tu instalador</AppText>
        {contact ? (
          <>
            <AppText>{contact.fullName}</AppText>
            {contact.phone ? (
              <Button
                label={`Llamar al ${contact.phone}`}
                icon="phone-outline"
                variant="secondary"
                onPress={() => void Linking.openURL(`tel:${contact.phone}`)}
              />
            ) : null}
          </>
        ) : (
          <AppText variant="caption" muted>
            Es quien instaló VigíaAI en tu granja.
          </AppText>
        )}
      </Card>

      {message ? <Notice tone="info" text={message} /> : null}
      <Button label="Ya pagué: revisar de nuevo" icon="refresh" onPress={recheck} loading={checking} />
      <Button label="Cerrar sesión" variant="ghost" icon="logout" onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xl },
  icon: { width: 80, height: 80, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  card: { gap: Spacing.sm },
});

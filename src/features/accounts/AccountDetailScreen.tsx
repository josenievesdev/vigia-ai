import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card, Notice, Screen, SectionHeader } from '@/components/ui';
import { viewClientFarm } from '@/features/account/session';
import { SUBSCRIPTION_TONES } from '@/features/account/components/subscriptionTone';
import { getSupabase } from '@/lib/supabase';
import { deleteAccount, fetchAccount, resetPassword, setPaidUntil, toAccountError } from '@/services/account/api';
import {
  blockDate,
  extendOneMonth,
  formatDate,
  type SubscriptionState,
  subscriptionLabel,
  subscriptionState,
} from '@/services/account/subscription';
import { type AccountSummary, ROLE_LABELS } from '@/services/account/types';
import { useAuthStore } from '@/store/useAuthStore';
import { Spacing } from '@/theme';
import { formatNationalId } from '@/utils/format';

type Account = AccountSummary & { subscription: SubscriptionState };
type Confirm = 'reset' | 'block' | 'delete';
type Message = { tone: 'normal' | 'critical'; text: string };

const CONFIRM_TEXT: Record<Confirm, string> = {
  reset: 'La contraseña volverá a ser la cédula y deberá cambiarla al entrar.',
  block: 'El cliente dejará de ver su granja hasta que registres un pago.',
  delete: 'Se borrarán la cuenta, su granja y sus galpones. No se puede deshacer.',
};

/** Detalle de una cuenta: datos, granja y acciones (restablecer, pagos, eliminar). */
export function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useAuthStore((s) => s.profile);
  const [account, setAccount] = useState<Account | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  const load = useCallback(() => {
    let active = true;
    fetchAccount(getSupabase(), id)
      .then((a) => {
        if (!active) return;
        setLoadError(a ? null : 'No se encontró la cuenta.');
        setAccount(a ? { ...a, subscription: subscriptionState(a.paidUntil, Date.now()) } : null);
      })
      .catch((e: unknown) => {
        if (active) setLoadError(toAccountError(e).message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  useFocusEffect(load);

  if (!account) {
    return (
      <Screen topInset={false}>
        {loadError ? <Notice tone="critical" text={loadError} /> : <ActivityIndicator />}
      </Screen>
    );
  }

  const isAdmin = me?.role === 'admin';
  const isClient = account.role === 'client';
  const farm = account.farms[0];

  const run = (key: string, action: () => Promise<unknown>, success: string, after?: () => void) => {
    setBusy(key);
    setConfirm(null);
    setMessage(null);
    action()
      .then(() => {
        setMessage({ tone: 'normal', text: success });
        if (after) after();
        else load();
      })
      .catch((e: unknown) => setMessage({ tone: 'critical', text: toAccountError(e).message }))
      .finally(() => setBusy(null));
  };

  const extend = () => {
    const next = extendOneMonth(account.paidUntil, Date.now());
    run('extend', () => setPaidUntil(getSupabase(), account.id, next), `Pago registrado: al día hasta el ${formatDate(next)}.`);
  };

  const confirmed = (kind: Confirm) => {
    if (kind === 'reset') {
      run('reset', () => resetPassword(getSupabase(), account.id), 'Listo: la contraseña volvió a ser la cédula.');
    } else if (kind === 'block') {
      run('block', () => setPaidUntil(getSupabase(), account.id, blockDate(Date.now())), 'Cuenta bloqueada por falta de pago.');
    } else {
      run('delete', () => deleteAccount(getSupabase(), account.id), 'Cuenta eliminada.', () => router.back());
    }
  };

  const openFarm = () =>
    run('view', () => viewClientFarm(account.id, account.fullName), 'Granja abierta.', () => router.navigate('/'));

  return (
    <Screen topInset={false}>
      <Stack.Screen options={{ title: account.fullName }} />

      <Card style={styles.section}>
        <SectionHeader title={ROLE_LABELS[account.role]} />
        <Field label="Cédula (usuario)" value={formatNationalId(account.nationalId)} />
        <Field label="Celular" value={account.phone ?? '—'} />
        <Field label="Correo" value={account.email ?? '—'} />
        <Field label="Municipio" value={account.municipality ?? '—'} />
        <Field label="Contraseña" value={account.mustChangePassword ? 'Aún es la cédula (no ha entrado)' : 'Propia'} />
      </Card>

      {isClient ? (
        <Card style={styles.section}>
          <SectionHeader title="Suscripción" />
          <Badge label={subscriptionLabel(account.subscription)} tone={SUBSCRIPTION_TONES[account.subscription.status]} dot />
          {isAdmin ? (
            <View style={styles.actions}>
              <Button label="Registrar pago (+1 mes)" icon="cash-plus" onPress={extend} loading={busy === 'extend'} />
              <Button label="Bloquear ahora" icon="lock-outline" variant="secondary" onPress={() => setConfirm('block')} />
            </View>
          ) : (
            <AppText variant="caption" muted>
              Los pagos los registra el administrador.
            </AppText>
          )}
        </Card>
      ) : null}

      {isClient && farm ? (
        <Card style={styles.section}>
          <SectionHeader title="Granja" />
          <AppText variant="label">{farm.name}</AppText>
          <AppText variant="caption" muted>
            {farm.placeName}
            {farm.region ? `, ${farm.region}` : ''}
          </AppText>
          <Button label="Ver granja en la app" icon="barn" variant="secondary" onPress={openFarm} loading={busy === 'view'} />
        </Card>
      ) : null}

      {message ? <Notice tone={message.tone} text={message.text} /> : null}

      {confirm ? (
        <Card style={styles.section}>
          <Notice tone="warning" text={CONFIRM_TEXT[confirm]} />
          <Button
            label={confirm === 'reset' ? 'Sí, restablecer' : confirm === 'block' ? 'Sí, bloquear' : 'Sí, eliminar'}
            variant={confirm === 'reset' ? 'primary' : 'danger'}
            onPress={() => confirmed(confirm)}
          />
          <Button label="Cancelar" variant="ghost" onPress={() => setConfirm(null)} />
        </Card>
      ) : (
        <View style={styles.actions}>
          <Button
            label="Restablecer contraseña"
            icon="lock-reset"
            variant="secondary"
            onPress={() => setConfirm('reset')}
            loading={busy === 'reset'}
          />
          {isAdmin && account.id !== me?.id ? (
            <Button label="Eliminar cuenta" icon="delete-outline" variant="danger" onPress={() => setConfirm('delete')} loading={busy === 'delete'} />
          ) : null}
        </View>
      )}
    </Screen>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <AppText style={styles.value}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  actions: { gap: Spacing.sm },
  field: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md },
  value: { flexShrink: 1, textAlign: 'right' },
});

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card, EmptyState, Icon, Notice, Screen, Segmented } from '@/components/ui';
import { SUBSCRIPTION_TONES } from '@/features/account/components/subscriptionTone';
import { getSupabase } from '@/lib/supabase';
import { listAccounts, toAccountError } from '@/services/account/api';
import { type SubscriptionState, subscriptionState } from '@/services/account/subscription';
import type { AccountSummary } from '@/services/account/types';
import { useAuthStore } from '@/store/useAuthStore';
import { Spacing, useTheme } from '@/theme';
import { formatNationalId } from '@/utils/format';

type Tab = 'client' | 'installer';
type Row = AccountSummary & { subscription: SubscriptionState };

const SHORT_LABEL: Record<SubscriptionState['status'], (s: SubscriptionState) => string> = {
  active: () => 'Al día',
  expiring: (s) => (s.daysLeft === 0 ? 'Vence hoy' : `Vence en ${s.daysLeft} d`),
  expired: () => 'Vencida',
};

/** Clientes (e instaladores, para el administrador). RLS decide qué filas llegan. */
export function AccountsScreen() {
  const c = useTheme();
  const role = useAuthStore((s) => s.profile?.role);
  const [tab, setTab] = useState<Tab>('client');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Se recarga al volver de crear o editar una cuenta.
  const load = useCallback(() => {
    let active = true;
    listAccounts(getSupabase(), tab)
      .then((list) => {
        if (!active) return;
        setError(null);
        setRows(list.map((a) => ({ ...a, subscription: subscriptionState(a.paidUntil, Date.now()) })));
      })
      .catch((e: unknown) => {
        if (active) setError(toAccountError(e).message);
      });
    return () => {
      active = false;
    };
  }, [tab]);
  useFocusEffect(load);

  const changeTab = (next: Tab) => {
    setRows(null);
    setTab(next);
  };

  return (
    <Screen
      topInset={false}
      subtitle={
        role === 'admin'
          ? 'Todas las cuentas. Registra pagos y bloqueos desde el detalle de cada cliente.'
          : 'Los clientes que tú instalaste.'
      }>
      {role === 'admin' ? (
        <Segmented<Tab>
          value={tab}
          onChange={changeTab}
          options={[
            { value: 'client', label: 'Clientes' },
            { value: 'installer', label: 'Instaladores' },
          ]}
        />
      ) : null}

      <Button
        label={tab === 'client' ? 'Nuevo cliente' : 'Nuevo instalador'}
        icon="account-plus-outline"
        onPress={() => router.push({ pathname: '/accounts/new', params: { role: tab } })}
      />

      {error ? <Notice tone="critical" text={error} /> : null}

      {rows === null && !error ? <ActivityIndicator /> : null}
      {rows?.length === 0 ? (
        <EmptyState
          icon="account-group-outline"
          title={tab === 'client' ? 'Todavía no hay clientes' : 'Todavía no hay instaladores'}
          message="Crea la primera cuenta con el botón de arriba."
        />
      ) : null}

      {rows?.length ? (
        <Card style={styles.list}>
          {rows.map((a, i) => {
            const farm = a.farms[0];
            return (
              <Pressable
                key={a.id}
                onPress={() => router.push({ pathname: '/accounts/[id]', params: { id: a.id } })}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
                  pressed && { opacity: 0.7 },
                ]}>
                <View style={styles.body}>
                  <AppText variant="label">{a.fullName}</AppText>
                  <AppText variant="caption" muted>
                    C.C. {formatNationalId(a.nationalId)}
                    {farm ? ` · ${farm.name} (${farm.placeName})` : ''}
                  </AppText>
                  {a.mustChangePassword ? (
                    <AppText variant="caption" color={c.warning}>
                      Aún no ha entrado: su contraseña es la cédula
                    </AppText>
                  ) : null}
                </View>
                {tab === 'client' ? (
                  <Badge label={SHORT_LABEL[a.subscription.status](a.subscription)} tone={SUBSCRIPTION_TONES[a.subscription.status]} />
                ) : null}
                <Icon name="chevron-right" size={22} color={c.textMuted} />
              </Pressable>
            );
          })}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  body: { flex: 1, gap: 2 },
});

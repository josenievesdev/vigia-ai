import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card, Icon, Notice, Screen } from '@/components/ui';
import { removeZone, switchZone } from '@/features/account/session';
import { toAccountError } from '@/services/account/api';
import { bogotaMidnight } from '@/services/account/subscription';
import { useAuthStore } from '@/store/useAuthStore';
import { useFarmStore } from '@/store/useFarmStore';
import { Spacing, useTheme } from '@/theme';
import { formatCount } from '@/utils/format';

const WEEK_MS = 7 * 86_400_000;

/**
 * Galpones de la granja abierta. La app muestra uno a la vez (simulación, producción y
 * configuración son de cada galpón); aquí se elige cuál ver y se agregan o quitan galpones.
 */
export function ZonesScreen() {
  const c = useTheme();
  const farm = useAuthStore((s) => s.farm);
  const role = useAuthStore((s) => s.profile?.role);
  const now = useFarmStore((s) => s.now);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!farm) {
    return (
      <Screen topInset={false}>
        <Notice tone="info" text="La granja demo tiene un solo galpón. En una granja real puedes tener varios." />
      </Screen>
    );
  }

  const staff = role === 'admin' || role === 'installer';
  const active = farm.zones.find((z) => z.id === farm.activeZoneId);

  const select = (zoneId: string) => {
    if (zoneId === farm.activeZoneId) {
      router.back();
      return;
    }
    setBusy(zoneId);
    setError(null);
    switchZone(zoneId)
      .then(() => router.back())
      .catch((e: unknown) => setError(toAccountError(e).message))
      .finally(() => setBusy(null));
  };

  const remove = () => {
    setBusy('delete');
    setError(null);
    removeZone(farm.activeZoneId)
      .then(() => setConfirmDelete(false))
      .catch((e: unknown) => setError(toAccountError(e).message))
      .finally(() => setBusy(null));
  };

  return (
    <Screen
      topInset={false}
      subtitle="La app muestra un galpón a la vez. Registros, configuración y simulación son de cada galpón.">
      <Card style={styles.list}>
        {farm.zones.map((z, i) => {
          const isActive = z.id === farm.activeZoneId;
          const weeks = now !== null ? Math.round((now - bogotaMidnight(z.hatchDate)) / WEEK_MS) : null;
          return (
            <Pressable
              key={z.id}
              onPress={() => select(z.id)}
              disabled={busy !== null}
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive }}
              style={({ pressed }) => [
                styles.row,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
                pressed && { opacity: 0.7 },
              ]}>
              <Icon name={isActive ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={isActive ? c.primary : c.textMuted} />
              <View style={styles.body}>
                <AppText variant="label">{z.name}</AppText>
                <AppText variant="caption" muted>
                  {formatCount(z.population)} aves{weeks !== null ? ` · ${weeks} semanas` : ''}
                </AppText>
              </View>
              {busy === z.id ? <ActivityIndicator /> : isActive ? <Badge label="En pantalla" tone="normal" /> : null}
            </Pressable>
          );
        })}
      </Card>

      <Button label="Agregar galpón" icon="plus" onPress={() => router.push('/zones/new')} disabled={busy !== null} />
      {error ? <Notice tone="critical" text={error} /> : null}

      {staff && farm.zones.length > 1 && active ? (
        confirmDelete ? (
          <Card style={styles.section}>
            <Notice
              tone="warning"
              text={`Se borrarán "${active.name}" y todos sus registros de producción. No se puede deshacer.`}
            />
            <Button label="Sí, eliminar galpón" variant="danger" onPress={remove} loading={busy === 'delete'} />
            <Button label="Cancelar" variant="ghost" onPress={() => setConfirmDelete(false)} />
          </Card>
        ) : (
          <Button
            label={`Eliminar "${active.name}"`}
            icon="delete-outline"
            variant="danger"
            onPress={() => setConfirmDelete(true)}
            disabled={busy !== null}
          />
        )
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  body: { flex: 1, gap: 2 },
  section: { gap: Spacing.sm },
});

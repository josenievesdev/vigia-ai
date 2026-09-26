import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, EmptyState, Screen, Segmented } from '@/components/ui';
import { useFarmStore } from '@/store/useFarmStore';
import { Spacing } from '@/theme';

import { AlertCard } from './components/AlertCard';

type Tab = 'active' | 'resolved';

export function AlertsScreen() {
  const [tab, setTab] = useState<Tab>('active');
  const active = useFarmStore((s) => s.alerts);
  const resolved = useFarmStore((s) => s.resolvedAlerts);
  const now = useFarmStore((s) => s.now) ?? 0;
  const list = tab === 'active' ? active : resolved;

  return (
    <Screen title="Alertas" subtitle="Condiciones detectadas por el motor de reglas">
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'active', label: `Activas (${active.length})` },
          { value: 'resolved', label: `Historial (${resolved.length})` },
        ]}
      />
      {list.length ? (
        <View style={styles.list}>
          {list.map((a) => (
            <AlertCard key={a.id} alert={a} now={now} />
          ))}
        </View>
      ) : (
        <Card>
          <EmptyState
            icon={tab === 'active' ? 'shield-check-outline' : 'history'}
            title={tab === 'active' ? 'Sin alertas activas' : 'Sin alertas resueltas'}
            message={
              tab === 'active'
                ? 'La granja opera dentro de los rangos configurados. Prueba un escenario en la pestaña Demo.'
                : 'Las alertas resueltas aparecerán aquí.'
            }
          />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.md },
});

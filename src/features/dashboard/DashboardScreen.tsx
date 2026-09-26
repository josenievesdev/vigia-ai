import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText, Badge, Card, EmptyState, Screen, SectionHeader } from '@/components/ui';
import { AccountBanner } from '@/features/account/components/AccountBanner';
import { AlertCard } from '@/features/alerts/components/AlertCard';
import { formatLocation } from '@/domain/location';
import { DecisionItem } from '@/features/automation/components/DecisionItem';
import { OutsideCard } from '@/features/environment/OutsideCard';
import { ProductionCard } from '@/features/production/components/ProductionCard';
import { useFarmClock } from '@/hooks/use-farm-clock';
import { useFarmStore } from '@/store/useFarmStore';
import { useActuators, useHealth, usePrimaryZone } from '@/store/selectors';
import { Spacing } from '@/theme';
import { formatClock, formatCount } from '@/utils/format';

import { DemoBanner } from './components/DemoBanner';
import { EnvironmentGrid } from './components/EnvironmentGrid';
import { HealthBanner } from './components/HealthBanner';
import { SuppliesCard } from './components/SuppliesCard';
import { SystemsCard } from './components/SystemsCard';

export function DashboardScreen() {
  const farm = useFarmStore((s) => s.farm);
  const profile = useFarmStore((s) => s.profile);
  const sourceKind = useFarmStore((s) => s.sourceKind);
  const alerts = useFarmStore((s) => s.alerts);
  const decisions = useFarmStore((s) => s.decisions);
  // Aves vivas hoy (descuenta la mortalidad del día); antes del primer dato, las configuradas.
  const liveHens = useFarmStore((s) => s.production?.today?.hens);
  const zone = usePrimaryZone();
  const actuators = useActuators(zone?.id);
  const health = useHealth();
  const { now, light, isLightPeriod } = useFarmClock();

  if (!farm || !profile || !zone || now === null) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator />
          <AppText muted>Conectando con la granja…</AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      title={farm.name}
      subtitle={`${formatLocation(farm.location)} · ${zone.name} · ${formatCount(liveHens ?? zone.population)} ${profile.populationNoun}`}
      headerRight={
        <Badge
          label={sourceKind === 'simulation' ? 'Simulación' : 'En vivo'}
          tone={sourceKind === 'simulation' ? 'info' : 'normal'}
          dot
        />
      }>
      <AccountBanner />
      <DemoBanner />
      <HealthBanner health={health} alertCount={alerts.length} clock={formatClock(now)} />
      <OutsideCard />

      <View style={styles.section}>
        <SectionHeader title="Ambiente" />
        <EnvironmentGrid
          zoneId={zone.id}
          profile={profile}
          isLightPeriod={isLightPeriod}
          artificialLight={Boolean(light?.artificialWanted)}
        />
      </View>

      <ProductionCard />
      <SuppliesCard zoneId={zone.id} profile={profile} actuators={actuators} />
      <SystemsCard actuators={actuators} />

      <View style={styles.section}>
        <SectionHeader
          title={`Alertas activas (${alerts.length})`}
          actionLabel={alerts.length ? 'Ver todas' : undefined}
          href="/alerts"
        />
        {alerts.length ? (
          alerts.slice(0, 3).map((a) => <AlertCard key={a.id} alert={a} now={now} compact />)
        ) : (
          <Card>
            <EmptyState icon="shield-check-outline" title="Sin alertas activas" />
          </Card>
        )}
      </View>

      <Card style={styles.section}>
        <SectionHeader title="Últimas decisiones" actionLabel="Historial" href="/automation" />
        {decisions.length ? (
          decisions.slice(0, 3).map((d) => <DecisionItem key={d.id} decision={d} now={now} />)
        ) : (
          <AppText variant="caption" muted>
            Aún no hay decisiones registradas.
          </AppText>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: Spacing.md, paddingTop: 120 },
  section: { gap: Spacing.md },
});

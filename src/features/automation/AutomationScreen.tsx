import { StyleSheet, View } from 'react-native';

import { AppText, Card, SectionHeader, Screen } from '@/components/ui';
import { defaultRules } from '@/engine/rules';
import { getFarmRuntime } from '@/services/runtime';
import { useFarmStore } from '@/store/useFarmStore';
import { useActuators, usePrimaryZone } from '@/store/selectors';
import { Spacing, useTheme } from '@/theme';

import { ActuatorControl } from './components/ActuatorControl';
import { DecisionItem } from './components/DecisionItem';

export function AutomationScreen() {
  const c = useTheme();
  const zone = usePrimaryZone();
  const actuators = useActuators(zone?.id);
  const decisions = useFarmStore((s) => s.decisions);
  const now = useFarmStore((s) => s.now) ?? 0;

  return (
    <Screen title="Automatización" subtitle={zone ? `Equipos de ${zone.name}` : undefined}>
      <Card style={styles.section}>
        <SectionHeader title="Equipos" />
        {actuators.map((a, i) => (
          <View key={a.id} style={i > 0 && [styles.divider, { borderTopColor: c.border }]}>
            <ActuatorControl
              actuator={a}
              onToggle={(active) => void getFarmRuntime().setManual(a.id, active)}
              onAuto={() => getFarmRuntime().setAuto(a.id)}
            />
          </View>
        ))}
      </Card>

      <Card style={styles.section}>
        <SectionHeader title="Reglas activas" />
        {defaultRules.map((r) => (
          <View key={r.id} style={styles.rule}>
            <AppText variant="label">{r.name}</AppText>
            <AppText variant="caption" muted>
              {r.description}
            </AppText>
          </View>
        ))}
      </Card>

      <Card style={styles.section}>
        <SectionHeader title="Registro de decisiones" />
        {decisions.length ? (
          decisions.map((d) => <DecisionItem key={d.id} decision={d} now={now} />)
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
  section: { gap: Spacing.sm },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  rule: { gap: 2, paddingVertical: Spacing.xs },
});

import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppText, Card, Icon, type IconName, SectionHeader, Screen, Segmented } from '@/components/ui';
import { getFarmRuntime } from '@/services/runtime';
import { SCENARIOS, type ScenarioId } from '@/services/simulation/scenarios';
import { useFarmStore } from '@/store/useFarmStore';
import { Radius, Spacing, useTheme } from '@/theme';

const SCENARIO_ICONS: Record<ScenarioId, IconName> = {
  heatWave: 'weather-sunny-alert',
  waterOutage: 'water-off',
  feedShortage: 'grain',
  lowActivity: 'bird',
  sensorFailure: 'access-point-network-off',
};

const SPEEDS = [
  { value: 1, label: 'Real' },
  { value: 60, label: '1 min/s' },
  { value: 300, label: '5 min/s' },
];

/** Modo demo: dispara escenarios sobre la simulación para presentar la plataforma. */
export function DemoScreen() {
  const c = useTheme();
  const simulation = useFarmStore((s) => s.simulation);
  const runtime = getFarmRuntime();

  if (!simulation) {
    return (
      <Screen title="Modo demo">
        <Card>
          <AppText muted>El modo demo solo está disponible con la fuente simulada.</AppText>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="Modo demo" subtitle="Simula eventos para ver la respuesta automática del sistema">
      <Card style={styles.section}>
        <SectionHeader title="Velocidad de simulación" />
        <Segmented value={simulation.timeScale} onChange={(v) => runtime.setTimeScale(v)} options={SPEEDS} />
      </Card>

      <Card style={styles.section}>
        <SectionHeader title="Escenarios" />
        {SCENARIOS.map((s, i) => {
          const enabled = simulation.scenarios.includes(s.id);
          return (
            <View key={s.id} style={[styles.row, i > 0 && [styles.divider, { borderTopColor: c.border }]]}>
              <View style={[styles.icon, { backgroundColor: enabled ? c.warningSoft : c.surfaceMuted }]}>
                <Icon name={SCENARIO_ICONS[s.id]} size={22} color={enabled ? c.warning : c.textMuted} />
              </View>
              <View style={styles.body}>
                <AppText variant="label">{s.label}</AppText>
                <AppText variant="caption" muted>
                  {s.description}
                </AppText>
              </View>
              <Switch
                value={enabled}
                onValueChange={(v) => runtime.setScenario(s.id, v)}
                trackColor={{ true: c.warning, false: c.border }}
                accessibilityLabel={s.label}
              />
            </View>
          );
        })}
      </Card>

      {simulation.scenarios.length ? (
        <Pressable
          onPress={() => runtime.clearScenarios()}
          accessibilityRole="button"
          style={[styles.reset, { borderColor: c.border, backgroundColor: c.surface }]}>
          <Icon name="restore" size={18} color={c.text} />
          <AppText variant="label">Volver a condiciones normales</AppText>
        </Pressable>
      ) : null}

      <AppText variant="caption" muted style={styles.note}>
        Los escenarios alteran el modelo físico simulado (clima, suministro, comportamiento). Las lecturas,
        decisiones y alertas que ves son la respuesta real del motor de reglas.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  icon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  reset: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  note: { textAlign: 'center', paddingHorizontal: Spacing.lg },
});

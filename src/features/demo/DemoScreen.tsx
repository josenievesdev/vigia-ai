import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppText, Card, Icon, type IconName, SectionHeader, Screen, Segmented } from '@/components/ui';
import { formatLocation } from '@/domain/location';
import { getFarmRuntime, setSimulationMode } from '@/services/runtime';
import type { SimulationClock } from '@/services/simulation/SimulatedSource';
import { WEATHER_ATTRIBUTION } from '@/services/weather/types';
import { SCENARIOS, type ScenarioId } from '@/services/simulation/scenarios';
import { useFarmStore } from '@/store/useFarmStore';
import { Radius, Spacing, useTheme } from '@/theme';
import { formatClock } from '@/utils/format';

const SCENARIO_ICONS: Record<ScenarioId, IconName> = {
  heatWave: 'weather-sunny-alert',
  waterOutage: 'water-off',
  feedShortage: 'grain',
  lowActivity: 'bird',
  sensorFailure: 'access-point-network-off',
};

const SPEEDS = [
  { value: 60, label: '1 min/s' },
  { value: 300, label: '5 min/s' },
  { value: 900, label: '15 min/s' },
];

const MODES: { value: SimulationClock; label: string }[] = [
  { value: 'live', label: 'En vivo' },
  { value: 'accelerated', label: 'Acelerado' },
];

/** Modo demo: dispara escenarios sobre la simulación para presentar la plataforma. */
export function DemoScreen() {
  const c = useTheme();
  const simulation = useFarmStore((s) => s.simulation);
  const environment = useFarmStore((s) => s.environment);
  const [switching, setSwitching] = useState(false);

  const changeMode = (mode: SimulationClock) => {
    if (switching || mode === simulation?.mode) return;
    setSwitching(true);
    setSimulationMode(mode)
      .catch((error) => console.warn('[VigíaAI] No se pudo cambiar el modo', error))
      .finally(() => setSwitching(false));
  };

  if (!simulation || switching) {
    return (
      <Screen topInset={false}>
        <Card style={styles.loading}>
          <ActivityIndicator />
          <AppText muted>Preparando la simulación y el clima…</AppText>
        </Card>
      </Screen>
    );
  }

  const live = simulation.mode === 'live';
  const updatedAt = environment?.weatherUpdatedAt;

  return (
    <Screen topInset={false} subtitle="Simula eventos para ver la respuesta automática del sistema">
      <Card style={styles.section}>
        <SectionHeader title="Modo de simulación" />
        <Segmented value={simulation.mode} onChange={changeMode} options={MODES} />
        <AppText variant="caption" muted>
          {live
            ? 'Hora real y clima real de la granja: la simulación avanza al ritmo del mundo.'
            : 'El tiempo avanza rápido para presentar un día completo en minutos (usa el pronóstico real).'}{' '}
          Cambiar de modo reinicia la simulación.
        </AppText>
        {environment ? (
          <View style={[styles.weatherRow, { backgroundColor: c.surfaceMuted }]}>
            <Icon name={environment.realWeather ? 'cloud-check-outline' : 'cloud-off-outline'} size={18} color={c.textMuted} />
            <AppText variant="caption" muted style={styles.flex}>
              {environment.realWeather
                ? `Clima real de ${formatLocation(environment.location)}${updatedAt ? ` · actualizado a las ${formatClock(updatedAt)}` : ''}`
                : 'Sin conexión al servicio de clima: se usa un clima de respaldo.'}
            </AppText>
          </View>
        ) : null}
        {environment?.realWeather ? (
          <AppText variant="caption" muted>
            {WEATHER_ATTRIBUTION}
          </AppText>
        ) : null}
      </Card>

      {!live ? (
        <Card style={styles.section}>
          <SectionHeader title="Velocidad" />
          <Segmented value={simulation.timeScale} onChange={(v) => getFarmRuntime().setTimeScale(v)} options={SPEEDS} />
        </Card>
      ) : null}

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
                onValueChange={(v) => getFarmRuntime().setScenario(s.id, v)}
                trackColor={{ true: c.warning, false: c.border }}
                accessibilityLabel={s.label}
              />
            </View>
          );
        })}
      </Card>

      {simulation.scenarios.length ? (
        <Pressable
          onPress={() => getFarmRuntime().clearScenarios()}
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
  loading: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl },
  flex: { flex: 1 },
  weatherRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.sm },
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

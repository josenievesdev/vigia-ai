import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { MetricTile, SENSOR_ICONS } from '@/components/ui';
import { SENSOR_KINDS } from '@/domain/catalog';
import type { SpeciesProfile } from '@/domain/profiles';
import type { SensorKind } from '@/domain/types';
import { useSensorHistory } from '@/hooks/use-history';
import { useReading } from '@/store/selectors';
import { Spacing } from '@/theme';
import { formatValue } from '@/utils/format';

import { readingTone } from '../readingTone';

const KINDS: SensorKind[] = ['temperature', 'humidity', 'light', 'animalActivity'];

/** Ventana de la minigráfica de cada tarjeta. */
const TREND_WINDOW_MS = 3 * 3600_000;

interface EnvironmentGridProps {
  zoneId: string;
  profile: SpeciesProfile;
  isLightPeriod: boolean;
  /** true si la luz actual viene de las lámparas (no del sol). */
  artificialLight: boolean;
}

export function EnvironmentGrid({ zoneId, profile, isLightPeriod, artificialLight }: EnvironmentGridProps) {
  const temperature = useReading(zoneId, 'temperature').value;
  return (
    <View style={styles.grid}>
      {KINDS.map((kind) => (
        <SensorTile
          key={kind}
          zoneId={zoneId}
          kind={kind}
          profile={profile}
          isLightPeriod={isLightPeriod}
          artificialLight={artificialLight}
          temperature={temperature}
        />
      ))}
    </View>
  );
}

interface HintContext {
  profile: SpeciesProfile;
  isLightPeriod: boolean;
  artificialLight: boolean;
  value: number | undefined;
  temperature: number | undefined;
}

function hintFor(kind: SensorKind, ctx: HintContext): string {
  const { profile, isLightPeriod } = ctx;
  switch (kind) {
    case 'temperature':
      return `Óptimo ${profile.comfort.temperature.min}–${profile.comfort.temperature.max} °C`;
    case 'humidity': {
      const humid = ctx.value !== undefined && ctx.value >= profile.alerts.highHumidity.warning;
      const cool = ctx.temperature !== undefined && ctx.temperature < profile.alerts.highHumidityMinTemperature;
      if (humid && cool) return 'Alta, sin calor: sin riesgo agudo';
      return `Óptimo ${profile.comfort.humidity.min}–${profile.comfort.humidity.max} %`;
    }
    case 'light':
      if (!isLightPeriod) return 'Noche';
      return ctx.artificialLight ? 'Luz artificial' : 'Luz natural';
    case 'animalActivity':
      return isLightPeriod ? 'Movimiento de las aves' : 'Aves en reposo';
    default:
      return '';
  }
}

function SensorTile({
  zoneId,
  kind,
  profile,
  isLightPeriod,
  artificialLight,
  temperature,
}: {
  zoneId: string;
  kind: SensorKind;
  profile: SpeciesProfile;
  isLightPeriod: boolean;
  artificialLight: boolean;
  temperature: number | undefined;
}) {
  const reading = useReading(zoneId, kind);
  const trend = useSensorHistory(zoneId, kind, TREND_WINDOW_MS).points;
  const { value, online } = reading;
  const info = SENSOR_KINDS[kind];
  const tone = readingTone(kind, reading, profile, { isLightPeriod, temperature });

  return (
    <MetricTile
      icon={SENSOR_ICONS[kind]}
      label={info.label}
      value={online ? formatValue(kind, value) : '—'}
      unit={info.unit}
      tone={tone}
      hint={online ? hintFor(kind, { profile, isLightPeriod, artificialLight, value, temperature }) : 'Sensor desconectado'}
      trend={trend}
      onPress={() => router.push({ pathname: '/sensor/[kind]', params: { kind } })}
    />
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
});

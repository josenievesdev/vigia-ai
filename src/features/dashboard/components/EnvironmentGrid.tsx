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
  isPhotoperiod: boolean;
}

export function EnvironmentGrid({ zoneId, profile, isPhotoperiod }: EnvironmentGridProps) {
  return (
    <View style={styles.grid}>
      {KINDS.map((kind) => (
        <SensorTile key={kind} zoneId={zoneId} kind={kind} profile={profile} isPhotoperiod={isPhotoperiod} />
      ))}
    </View>
  );
}

function hintFor(kind: SensorKind, profile: SpeciesProfile, isPhotoperiod: boolean): string {
  switch (kind) {
    case 'temperature':
      return `Óptimo ${profile.comfort.temperature.min}–${profile.comfort.temperature.max} °C`;
    case 'humidity':
      return `Óptimo ${profile.comfort.humidity.min}–${profile.comfort.humidity.max} %`;
    case 'light':
      return isPhotoperiod ? 'Fotoperiodo activo' : 'Periodo de descanso';
    case 'animalActivity':
      return isPhotoperiod ? 'Movimiento de las aves' : 'Aves en reposo';
    default:
      return '';
  }
}

function SensorTile({
  zoneId,
  kind,
  profile,
  isPhotoperiod,
}: {
  zoneId: string;
  kind: SensorKind;
  profile: SpeciesProfile;
  isPhotoperiod: boolean;
}) {
  const reading = useReading(zoneId, kind);
  const trend = useSensorHistory(zoneId, kind, TREND_WINDOW_MS).points;
  const { value, online } = reading;
  const info = SENSOR_KINDS[kind];
  const tone = readingTone(kind, reading, profile, { isPhotoperiod });

  return (
    <MetricTile
      icon={SENSOR_ICONS[kind]}
      label={info.label}
      value={online ? formatValue(kind, value) : '—'}
      unit={info.unit}
      tone={tone}
      hint={online ? hintFor(kind, profile, isPhotoperiod) : 'Sensor desconectado'}
      trend={trend}
      onPress={() => router.push({ pathname: '/sensor/[kind]', params: { kind } })}
    />
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
});

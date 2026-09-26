import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Card, LevelGauge, SectionHeader, SENSOR_ICONS } from '@/components/ui';
import type { SpeciesProfile } from '@/domain/profiles';
import { type ActuatorView, useReading } from '@/store/selectors';
import { Spacing, useTheme } from '@/theme';

import { readingTone } from '../readingTone';

interface SuppliesCardProps {
  zoneId: string;
  profile: SpeciesProfile;
  actuators: ActuatorView[];
}

/** Niveles de agua y alimento con indicación de reposición en curso. */
export function SuppliesCard({ zoneId, profile, actuators }: SuppliesCardProps) {
  const c = useTheme();
  const water = useReading(zoneId, 'waterLevel');
  const feed = useReading(zoneId, 'feedLevel');
  const pumpOn = actuators.find((a) => a.kind === 'waterPump')?.active;
  const feederOn = actuators.find((a) => a.kind === 'feeder')?.active;

  return (
    <Card style={styles.card}>
      <SectionHeader title="Suministros" />
      <LevelGauge
        icon={SENSOR_ICONS.waterLevel}
        label="Agua"
        value={water.value}
        color={c.water}
        tone={readingTone('waterLevel', water, profile)}
        marker={profile.alerts.lowWater.warning}
        status={pumpOn ? 'Bomba activa' : undefined}
        onPress={() => router.push({ pathname: '/sensor/[kind]', params: { kind: 'waterLevel' } })}
      />
      <LevelGauge
        icon={SENSOR_ICONS.feedLevel}
        label="Alimento"
        value={feed.value}
        color={c.feed}
        tone={readingTone('feedLevel', feed, profile)}
        marker={profile.alerts.lowFeed.warning}
        status={feederOn ? 'Alimentador activo' : undefined}
        onPress={() => router.push({ pathname: '/sensor/[kind]', params: { kind: 'feedLevel' } })}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.lg },
});

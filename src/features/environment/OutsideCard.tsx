import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Card, Icon, weatherIcon } from '@/components/ui';
import { formatLocation } from '@/domain/location';
import { describeWeather } from '@/services/weather/weatherCodes';
import { WEATHER_ATTRIBUTION } from '@/services/weather/types';
import { useFarmStore } from '@/store/useFarmStore';
import { Radius, Spacing, useTheme } from '@/theme';
import { formatClock } from '@/utils/format';

/** Clima exterior real de la granja (Open-Meteo) y salida/puesta del sol. */
export function OutsideCard() {
  const c = useTheme();
  const env = useFarmStore((s) => s.environment);
  const now = useFarmStore((s) => s.now);
  if (!env || now === null) return null;

  const { outside, light, location } = env;
  const isDay = light.sunElevation > 0;
  const source = env.realWeather
    ? env.weatherStatus === 'stale'
      ? { label: 'Real (desactualizado)', tone: 'warning' as const }
      : { label: 'Clima real', tone: 'info' as const }
    : { label: 'Clima simulado', tone: 'neutral' as const };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <AppText variant="label" muted style={styles.flex}>
          Exterior · {formatLocation(location)}
        </AppText>
        <Badge label={source.label} tone={source.tone} dot />
      </View>

      <View style={styles.main}>
        <View style={[styles.icon, { backgroundColor: isDay ? c.warningSoft : c.infoSoft }]}>
          <Icon name={weatherIcon(outside.weatherCode, isDay)} size={30} color={isDay ? c.warning : c.info} />
        </View>
        <View style={styles.flex}>
          <View style={styles.tempRow}>
            <AppText variant="metric">{Math.round(outside.temperature)}</AppText>
            <AppText variant="label" muted>
              °C
            </AppText>
            <AppText variant="body" style={styles.description}>
              {describeWeather(outside.weatherCode)}
            </AppText>
          </View>
          <AppText variant="caption" muted>
            Sensación {Math.round(outside.apparentTemperature)} °C · Humedad {Math.round(outside.humidity)} %
            {outside.precipitation > 0 ? ` · ${outside.precipitation.toFixed(1)} mm` : ''}
          </AppText>
        </View>
      </View>

      {light.sun ? (
        <View style={[styles.sunRow, { backgroundColor: c.surfaceMuted }]}>
          <Icon name="weather-sunset-up" size={16} color={c.textMuted} />
          <AppText variant="caption" muted>
            Amanece {formatClock(light.sun.sunrise)}
          </AppText>
          <Icon name="weather-sunset-down" size={16} color={c.textMuted} />
          <AppText variant="caption" muted>
            Anochece {formatClock(light.sun.sunset)}
          </AppText>
          <AppText variant="caption" style={styles.next}>
            {isDay ? 'De día' : 'De noche'}
          </AppText>
        </View>
      ) : null}

      <AppText variant="caption" muted>
        {env.realWeather ? WEATHER_ATTRIBUTION : 'Sin datos reales en este momento: se usa un clima de respaldo.'}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  main: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  icon: { width: 52, height: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  tempRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' },
  description: { marginLeft: Spacing.sm },
  sunRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.sm,
  },
  next: { marginLeft: 'auto', fontWeight: '600' },
});

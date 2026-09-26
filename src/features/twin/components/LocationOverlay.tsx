import { StyleSheet, View } from 'react-native';

import { AppText, Icon, weatherIcon } from '@/components/ui';
import { formatLocation } from '@/domain/location';
import { nextSunEvent } from '@/features/environment/sunEvent';
import { describeWeather } from '@/services/weather/weatherCodes';
import { useFarmStore } from '@/store/useFarmStore';
import { Radius, Spacing, useTheme } from '@/theme';
import { formatClock } from '@/utils/format';

/** Recuadro sobre el 3D: dónde está la granja, qué tiempo hace y cuándo sale o se pone el sol. */
export function LocationOverlay() {
  const c = useTheme();
  const env = useFarmStore((s) => s.environment);
  const now = useFarmStore((s) => s.now);
  if (!env || now === null) return null;

  const { outside, light } = env;
  const isDay = light.sunElevation > 0;
  const event = nextSunEvent(light, now);

  return (
    <View style={[styles.card, { backgroundColor: c.surface }]}>
      <AppText variant="label">{formatLocation(env.location)}</AppText>
      <View style={styles.row}>
        <Icon name={weatherIcon(outside.weatherCode, isDay)} size={14} color={c.textMuted} />
        <AppText variant="caption">
          {Math.round(outside.temperature)} °C · {describeWeather(outside.weatherCode)}
        </AppText>
      </View>
      <AppText variant="caption" muted>
        {formatClock(now)}
        {event ? ` · ${event.label} ${formatClock(event.time)}` : ''}
      </AppText>
      <AppText variant="caption" muted style={styles.source}>
        {env.realWeather ? 'Clima real · Open-Meteo' : 'Clima simulado'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    pointerEvents: 'none',
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.sm,
    opacity: 0.94,
    gap: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  source: { fontSize: 10, lineHeight: 13 },
});

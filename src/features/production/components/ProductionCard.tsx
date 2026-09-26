import { StyleSheet, View } from 'react-native';

import { AppText, Card, Icon, SectionHeader } from '@/components/ui';
import { useFarmStore } from '@/store/useFarmStore';
import { Radius, Spacing, useTheme } from '@/theme';
import { formatCount, formatPercent } from '@/utils/format';

/** Resumen de producción del día para el inicio. */
export function ProductionCard() {
  const c = useTheme();
  const production = useFarmStore((s) => s.production);
  const today = production?.today;
  if (!today) return null;
  const last = production.days[production.days.length - 1];
  const progress = today.expectedEggs > 0 ? today.eggsSoFar / today.expectedEggs : 0;

  return (
    <Card style={styles.card}>
      <SectionHeader title="Producción de hoy" actionLabel="Ver más" href="/production" />
      <View style={styles.row}>
        <Icon name="egg-outline" size={26} color={c.primary} />
        <AppText variant="metric">{formatCount(today.eggsSoFar)}</AppText>
        <AppText variant="label" muted style={styles.flex}>
          de ~{formatCount(today.expectedEggs)} huevos
        </AppText>
      </View>
      <View style={[styles.track, { backgroundColor: c.surfaceMuted }]}>
        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: c.primary }]} />
      </View>
      <AppText variant="caption" muted>
        {formatCount(today.hens)} gallinas{last ? ` · postura ayer ${formatPercent(last.layingRate, 1)}` : ''}
        {today.mortalitySoFar > 0 ? ` · ${today.mortalitySoFar} bajas hoy` : ''}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  flex: { flex: 1 },
  track: { height: 6, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
});

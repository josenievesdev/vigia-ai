import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { SensorKind } from '@/domain/types';
import type { SeriesStats } from '@/services/history/analytics';
import { Radius, Spacing, useTheme } from '@/theme';
import { formatReading } from '@/utils/format';

interface StatsRowProps {
  kind: SensorKind;
  stats: SeriesStats | null;
  rangeLabel: string | null;
}

/** Fila de indicadores del periodo: mínimo, promedio, máximo y tiempo en rango. */
export function StatsRow({ kind, stats, rangeLabel }: StatsRowProps) {
  const items: { label: string; value: string }[] = [
    { label: 'Mínimo', value: formatReading(kind, stats?.min) },
    { label: 'Promedio', value: formatReading(kind, stats?.avg) },
    { label: 'Máximo', value: formatReading(kind, stats?.max) },
  ];
  if (rangeLabel) {
    items.push({
      label: rangeLabel,
      value: stats?.inRangePct == null ? '—' : `${Math.round(stats.inRangePct)}%`,
    });
  }
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <StatTile key={item.label} label={item.label} value={item.value} />
      ))}
    </View>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  const c = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: c.surface, borderColor: c.border }]}>
      <AppText variant="caption" muted numberOfLines={1}>
        {label}
      </AppText>
      <AppText variant="heading">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 100,
    padding: Spacing.md,
    gap: 2,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});

import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { SensorKind } from '@/domain/types';
import type { HourlyRow } from '@/services/history/analytics';
import { Spacing, useTheme } from '@/theme';
import { formatTimeShort, formatValue } from '@/utils/format';

/** Vista de tabla equivalente a la gráfica (accesible y útil para revisar valores). */
export function HourlyTable({ kind, rows, now }: { kind: SensorKind; rows: HourlyRow[]; now: number }) {
  const c = useTheme();
  const header = ['Hora', 'Mín', 'Prom', 'Máx'];
  return (
    <View>
      <View style={[styles.row, { borderBottomColor: c.border }]}>
        {header.map((h) => (
          <AppText key={h} variant="caption" muted style={[styles.cell, h === 'Hora' && styles.first]}>
            {h}
          </AppText>
        ))}
      </View>
      {rows.map((r) => (
        <View key={r.hour} style={[styles.row, { borderBottomColor: c.border }]}>
          <AppText variant="label" style={[styles.cell, styles.first, styles.num]}>
            {formatTimeShort(r.hour, now)}
          </AppText>
          {[r.min, r.avg, r.max].map((v, i) => (
            <AppText key={i} variant="body" style={[styles.cell, styles.num]}>
              {formatValue(kind, v)}
            </AppText>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: Spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cell: { flex: 1, textAlign: 'right' },
  first: { textAlign: 'left' },
  num: { fontVariant: ['tabular-nums'] },
});

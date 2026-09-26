import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { ProductionDay } from '@/domain/production/types';
import { Spacing, useTheme } from '@/theme';
import { formatCount, formatWeekday } from '@/utils/format';

const COLUMNS = ['Día', 'Huevos', 'Postura', 'Muertes', 'Conv.'];

/** Últimos días en tabla (equivalente accesible de las gráficas). */
export function ProductionTable({ days }: { days: ProductionDay[] }) {
  const c = useTheme();
  return (
    <View>
      <View style={[styles.row, { borderBottomColor: c.border }]}>
        {COLUMNS.map((h, i) => (
          <AppText key={h} variant="caption" muted style={[styles.cell, i === 0 && styles.first]}>
            {h}
          </AppText>
        ))}
      </View>
      {[...days].reverse().map((d) => (
        <View key={d.day} style={[styles.row, { borderBottomColor: c.border }]}>
          <AppText variant="label" style={[styles.cell, styles.first]}>
            {formatWeekday(d.day)}
          </AppText>
          <AppText variant="body" style={[styles.cell, styles.num]}>
            {formatCount(d.eggs)}
          </AppText>
          <AppText variant="body" style={[styles.cell, styles.num]}>
            {(d.layingRate * 100).toFixed(1)} %
          </AppText>
          <AppText variant="body" style={[styles.cell, styles.num]}>
            {d.mortality}
          </AppText>
          <AppText variant="body" style={[styles.cell, styles.num]}>
            {d.feedConversion.toFixed(2)}
          </AppText>
        </View>
      ))}
      <AppText variant="caption" muted style={styles.note}>
        Conv. = kg de alimento por kg de huevo (menor es mejor).
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: Spacing.xs + 2, borderBottomWidth: StyleSheet.hairlineWidth },
  cell: { flex: 1, textAlign: 'right' },
  first: { flex: 1.3, textAlign: 'left' },
  num: { fontVariant: ['tabular-nums'] },
  note: { marginTop: Spacing.sm },
});

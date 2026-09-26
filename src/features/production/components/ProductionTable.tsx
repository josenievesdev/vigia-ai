import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { type DayComparison, dateNoon } from '@/domain/production/records';
import { Spacing, useTheme } from '@/theme';
import { formatCount, formatWeekday } from '@/utils/format';

const COLUMNS = ['Día', 'Registrado', 'Estimado', 'Dif.', 'Muertes'];

/**
 * Últimos días: lo registrado frente a lo estimado (equivalente accesible de las gráficas).
 * Tocar un día abre su registro para anotarlo o corregirlo.
 */
export function ProductionTable({ rows }: { rows: DayComparison[] }) {
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
      {[...rows].reverse().map((r) => (
        <Pressable
          key={r.date}
          onPress={() => router.push({ pathname: '/record', params: { date: r.date } })}
          accessibilityRole="button"
          accessibilityLabel={`${formatWeekday(dateNoon(r.date))}: ${r.record ? `${r.record.eggsCollected} huevos registrados` : 'sin registro'}, ${Math.round(r.estimatedEggs)} estimados. Tocar para ${r.record ? 'corregir' : 'registrar'}.`}
          style={({ pressed }) => [styles.row, { borderBottomColor: c.border }, pressed && { opacity: 0.6 }]}>
          <AppText variant="label" style={[styles.cell, styles.first]}>
            {formatWeekday(dateNoon(r.date))}
          </AppText>
          <AppText variant="body" style={[styles.cell, styles.num]} color={r.record ? c.text : c.textMuted}>
            {r.record ? `${formatCount(r.record.eggsCollected)}${r.record.pending ? '*' : ''}` : '—'}
          </AppText>
          <AppText variant="body" muted style={[styles.cell, styles.num]}>
            {formatCount(r.estimatedEggs)}
          </AppText>
          <AppText variant="body" style={[styles.cell, styles.num]}>
            {r.deviation === null ? '—' : `${r.deviation >= 0 ? '+' : '−'}${Math.abs(r.deviation * 100).toFixed(0)} %`}
          </AppText>
          <AppText variant="body" style={[styles.cell, styles.num]}>
            {r.record ? r.record.deaths : '—'}
          </AppText>
        </Pressable>
      ))}
      <AppText variant="caption" muted style={styles.note}>
        Dif. = registrado frente a estimado. * pendiente de enviar (sin señal). Toca un día para registrarlo o corregirlo.
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

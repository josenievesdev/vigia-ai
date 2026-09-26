import { Pressable, StyleSheet, View } from 'react-native';

import { Sparkline } from '@/components/charts/Sparkline';
import type { SeriesPoint } from '@/services/history/HistoryRepository';
import { Radius, Spacing, type Tone, toneColors, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

interface MetricTileProps {
  icon: IconName;
  label: string;
  value: string;
  unit?: string;
  tone?: Tone;
  /** Texto secundario (rango óptimo, estado del sensor…). */
  hint?: string;
  /** Tendencia reciente para la minigráfica. */
  trend?: SeriesPoint[];
  onPress?: () => void;
}

export function MetricTile({ icon, label, value, unit, tone = 'normal', hint, trend, onPress }: MetricTileProps) {
  const c = useTheme();
  const { fg, bg } = toneColors(c, tone);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}${hint ? `. ${hint}` : ''}`}
      accessibilityHint={onPress ? 'Abre el historial' : undefined}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.75 : 1 },
      ]}>
      <View style={styles.top}>
        <View style={[styles.iconWrap, { backgroundColor: bg }]}>
          <Icon name={icon} size={18} color={fg} />
        </View>
        <AppText variant="label" muted numberOfLines={1} style={styles.label}>
          {label}
        </AppText>
        {onPress ? <Icon name="chevron-right" size={18} color={c.textMuted} /> : null}
      </View>
      <View style={styles.valueRow}>
        <AppText variant="metric" color={tone === 'offline' ? c.offline : undefined}>
          {value}
        </AppText>
        {unit ? (
          <AppText variant="label" muted>
            {unit}
          </AppText>
        ) : null}
      </View>
      {trend ? <Sparkline points={trend} /> : null}
      {hint ? (
        <AppText variant="caption" color={tone === 'normal' ? c.textMuted : fg} numberOfLines={1}>
          {hint}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconWrap: { width: 30, height: 30, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
});

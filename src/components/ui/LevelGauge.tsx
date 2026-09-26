import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing, type Tone, toneColors, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

interface LevelGaugeProps {
  icon: IconName;
  label: string;
  /** 0–100, o undefined si no hay dato. */
  value: number | undefined;
  /** Color de la barra en estado normal. */
  color: string;
  tone?: Tone;
  /** Posición (0–100) de la marca de nivel mínimo. */
  marker?: number;
  /** Texto de estado, p. ej. "Bomba activa". */
  status?: string;
  onPress?: () => void;
}

export function LevelGauge({ icon, label, value, color, tone = 'normal', marker, status, onPress }: LevelGaugeProps) {
  const c = useTheme();
  const { fg } = toneColors(c, tone);
  const barColor = tone === 'normal' ? color : fg;
  const pct = value === undefined ? 0 : Math.max(0, Math.min(100, value));

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityHint={onPress ? 'Abre el historial' : undefined}
      style={({ pressed }) => [styles.root, { opacity: pressed ? 0.75 : 1 }]}>
      <View style={styles.header}>
        <Icon name={icon} size={18} color={barColor} />
        <AppText variant="label" style={styles.label}>
          {label}
        </AppText>
        {status ? (
          <AppText variant="caption" color={c.primary}>
            {status}
          </AppText>
        ) : null}
        <AppText variant="heading" style={styles.value}>
          {value === undefined ? '—' : `${Math.round(pct)}%`}
        </AppText>
        {onPress ? <Icon name="chevron-right" size={18} color={c.textMuted} /> : null}
      </View>
      <View
        style={[styles.track, { backgroundColor: c.surfaceMuted }]}
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: barColor }]} />
        {marker !== undefined ? (
          <View style={[styles.marker, { left: `${marker}%`, backgroundColor: c.textMuted }]} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  label: { flex: 1 },
  value: { minWidth: 44, textAlign: 'right' },
  track: { height: 10, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
  marker: { position: 'absolute', top: 0, bottom: 0, width: 2, opacity: 0.6 },
});

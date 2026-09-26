import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

interface StepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  /** Decimales a mostrar. */
  precision?: number;
  /** Formato del valor mostrado (p. ej. separador de miles); por defecto, `precision` decimales. */
  format?: (value: number) => string;
  hint?: string;
}

/** Selector numérico con botones − / + (más fiable en el campo que escribir números). */
export function Stepper({
  label,
  value,
  onChange,
  step = 1,
  min = -Infinity,
  max = Infinity,
  unit,
  precision = 0,
  format,
  hint,
}: StepperProps) {
  const c = useTheme();
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Number(v.toFixed(Math.max(precision, 2))))));
  const shown = `${format ? format(value) : value.toFixed(precision)}${unit ? ` ${unit}` : ''}`;

  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <AppText variant="label">{label}</AppText>
        {hint ? (
          <AppText variant="caption" muted>
            {hint}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.control, { borderColor: c.border }]}>
        <Pressable
          onPress={() => set(value - step)}
          disabled={value <= min}
          accessibilityRole="button"
          accessibilityLabel={`Disminuir ${label}`}
          hitSlop={6}
          style={[styles.button, { opacity: value <= min ? 0.35 : 1 }]}>
          <Icon name="minus" size={18} color={c.text} />
        </Pressable>
        <AppText variant="label" style={styles.value} accessibilityLabel={`${label}: ${shown}`}>
          {shown}
        </AppText>
        <Pressable
          onPress={() => set(value + step)}
          disabled={value >= max}
          accessibilityRole="button"
          accessibilityLabel={`Aumentar ${label}`}
          hitSlop={6}
          style={[styles.button, { opacity: value >= max ? 0.35 : 1 }]}>
          <Icon name="plus" size={18} color={c.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs + 2 },
  text: { flex: 1, gap: 1 },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
  },
  button: { paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs + 2 },
  value: { minWidth: 64, textAlign: 'center', fontVariant: ['tabular-nums'] },
});

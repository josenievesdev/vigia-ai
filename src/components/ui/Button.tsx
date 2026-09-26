import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { Radius, Spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
}

/** Botón estándar. `loading` muestra un indicador y bloquea toques repetidos. */
export function Button({ label, onPress, variant = 'primary', icon, loading, disabled }: ButtonProps) {
  const c = useTheme();
  const inactive = disabled || loading;
  const palette = {
    primary: { bg: c.primary, fg: c.textInverse, border: c.primary },
    secondary: { bg: c.surface, fg: c.primary, border: c.border },
    danger: { bg: c.criticalSoft, fg: c.critical, border: c.criticalSoft },
    ghost: { bg: 'transparent', fg: c.primary, border: 'transparent' },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.root,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} color={palette.fg} /> : null}
          <AppText variant="label" color={palette.fg}>
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 46,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Texto de la casilla; puede incluir un enlace (por ejemplo, "leer la política"). */
  label: string;
  children?: ReactNode;
}

/** Casilla de verificación con texto (toda la fila responde al toque). */
export function Checkbox({ checked, onChange, label, children }: CheckboxProps) {
  const c = useTheme();
  return (
    <View style={styles.root}>
      <Pressable
        onPress={() => onChange(!checked)}
        accessibilityRole="checkbox"
        // aria-checked (y no accessibilityState): así lo anuncian también los lectores de pantalla en la web.
        aria-checked={checked}
        accessibilityLabel={label}
        hitSlop={6}
        style={styles.row}>
        <Icon
          name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'}
          size={24}
          color={checked ? c.primary : c.textMuted}
        />
        <AppText style={styles.label}>{label}</AppText>
      </Pressable>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  label: { flex: 1 },
});

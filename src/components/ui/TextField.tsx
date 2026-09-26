import { useRef } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { Radius, Spacing, useTheme } from '@/theme';

import { AppText } from './AppText';
import { useKeyboardFocus } from './KeyboardAwareScroll';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
}

/** Campo de texto con etiqueta. Al enfocarse queda a la vista, encima del teclado. */
export function TextField({ label, onFocus, onBlur, ...input }: TextFieldProps) {
  const c = useTheme();
  const keyboard = useKeyboardFocus();
  const ref = useRef<TextInput>(null);
  return (
    <View style={styles.root}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        ref={ref}
        placeholderTextColor={c.textMuted}
        accessibilityLabel={label}
        style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
        {...input}
        onFocus={(e) => {
          keyboard?.focus(ref.current);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          keyboard?.blur(ref.current);
          onBlur?.(e);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.xs },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
  },
});

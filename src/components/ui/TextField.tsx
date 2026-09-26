import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { Radius, Spacing, useTheme } from '@/theme';

import { AppText } from './AppText';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
}

export function TextField({ label, ...input }: TextFieldProps) {
  const c = useTheme();
  return (
    <View style={styles.root}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        placeholderTextColor={c.textMuted}
        accessibilityLabel={label}
        style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.surfaceMuted }]}
        {...input}
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

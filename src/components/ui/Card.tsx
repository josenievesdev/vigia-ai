import { StyleSheet, View, type ViewProps } from 'react-native';

import { Radius, Spacing, useTheme } from '@/theme';

export function Card({ style, ...rest }: ViewProps) {
  const c = useTheme();
  return (
    <View
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
  },
});

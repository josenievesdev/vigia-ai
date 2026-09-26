import { StyleSheet, Text, type TextProps } from 'react-native';

import { useTheme } from '@/theme';

type Variant = 'title' | 'heading' | 'body' | 'label' | 'caption' | 'metric';

export interface AppTextProps extends TextProps {
  variant?: Variant;
  muted?: boolean;
  color?: string;
}

export function AppText({ variant = 'body', muted, color, style, ...rest }: AppTextProps) {
  const c = useTheme();
  return (
    <Text
      style={[styles[variant], { color: color ?? (muted ? c.textMuted : c.text) }, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700' },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  metric: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
});

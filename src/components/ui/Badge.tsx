import { StyleSheet, View } from 'react-native';

import { Radius, Spacing, type Tone, toneColors, useTheme } from '@/theme';

import { AppText } from './AppText';

interface BadgeProps {
  label: string;
  tone?: Tone;
  /** Muestra un punto de color antes del texto. */
  dot?: boolean;
}

export function Badge({ label, tone = 'neutral', dot }: BadgeProps) {
  const { fg, bg } = toneColors(useTheme(), tone);
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {dot ? <View style={[styles.dot, { backgroundColor: fg }]} /> : null}
      <AppText variant="caption" color={fg}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
});

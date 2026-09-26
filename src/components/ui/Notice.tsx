import { StyleSheet, View } from 'react-native';

import { Radius, Spacing, toneColors, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type NoticeTone = 'info' | 'normal' | 'warning' | 'critical';

const ICONS: Record<NoticeTone, IconName> = {
  info: 'information-outline',
  normal: 'check-circle-outline',
  warning: 'alert-outline',
  critical: 'alert-circle-outline',
};

/** Mensaje breve con color e ícono (el color nunca va solo: el ícono y el texto lo explican). */
export function Notice({ tone = 'info', text }: { tone?: NoticeTone; text: string }) {
  const { fg, bg } = toneColors(useTheme(), tone);
  return (
    <View style={[styles.root, { backgroundColor: bg }]} accessibilityRole={tone === 'critical' ? 'alert' : undefined}>
      <Icon name={ICONS[tone]} size={18} color={fg} />
      <AppText variant="caption" color={fg} style={styles.text}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, padding: Spacing.sm + 2, borderRadius: Radius.md },
  text: { flex: 1 },
});

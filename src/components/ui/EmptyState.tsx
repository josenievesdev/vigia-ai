import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing, useTheme } from '@/theme';

import { AppText } from './AppText';

interface EmptyStateProps {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  message?: string;
}

export function EmptyState({ icon, title, message }: EmptyStateProps) {
  const c = useTheme();
  return (
    <View style={styles.root}>
      <MaterialCommunityIcons name={icon} size={36} color={c.textMuted} />
      <AppText variant="label">{title}</AppText>
      {message ? (
        <AppText variant="caption" muted style={styles.center}>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xl },
  center: { textAlign: 'center' },
});

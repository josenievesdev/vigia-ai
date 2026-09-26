import { Link, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  href?: Href;
}

export function SectionHeader({ title, actionLabel, href }: SectionHeaderProps) {
  const c = useTheme();
  return (
    <View style={styles.row}>
      <AppText variant="heading">{title}</AppText>
      {actionLabel && href ? (
        <Link href={href}>
          <AppText variant="label" color={c.primary}>
            {actionLabel}
          </AppText>
        </Link>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

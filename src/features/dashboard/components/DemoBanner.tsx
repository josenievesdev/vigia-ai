import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { SCENARIOS } from '@/services/simulation/scenarios';
import { useFarmStore } from '@/store/useFarmStore';
import { Radius, Spacing, useTheme } from '@/theme';

/** Aviso visible cuando hay escenarios de demostración activos. */
export function DemoBanner() {
  const c = useTheme();
  const scenarios = useFarmStore((s) => s.simulation?.scenarios);
  if (!scenarios?.length) return null;

  const names = SCENARIOS.filter((s) => scenarios.includes(s.id))
    .map((s) => s.label)
    .join(', ');

  return (
    <Pressable
      onPress={() => router.push('/demo')}
      style={[styles.root, { backgroundColor: c.infoSoft }]}
      accessibilityRole="link">
      <Icon name="flask-outline" size={20} color={c.info} />
      <View style={styles.body}>
        <AppText variant="label" color={c.info}>
          Modo demo activo
        </AppText>
        <AppText variant="caption" color={c.text} numberOfLines={2}>
          {names}
        </AppText>
      </View>
      <Icon name="chevron-right" size={20} color={c.info} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  body: { flex: 1 },
});

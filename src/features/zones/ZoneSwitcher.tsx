import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { useAuthStore } from '@/store/useAuthStore';
import { Radius, Spacing, useTheme } from '@/theme';

/** Qué galpón se está viendo y acceso para cambiarlo (solo si la granja tiene varios). */
export function ZoneSwitcher() {
  const c = useTheme();
  const farm = useAuthStore((s) => s.farm);
  if (!farm || farm.zones.length < 2) return null;
  const index = farm.zones.findIndex((z) => z.id === farm.activeZoneId);
  const active = farm.zones[index];

  return (
    <Pressable
      onPress={() => router.push('/zones')}
      accessibilityRole="button"
      accessibilityHint="Elegir otro galpón"
      style={({ pressed }) => [styles.root, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
      <Icon name="warehouse" size={20} color={c.primary} />
      <View style={styles.body}>
        <AppText variant="label">{active?.name}</AppText>
        <AppText variant="caption" muted>
          Galpón {index + 1} de {farm.zones.length}
        </AppText>
      </View>
      <AppText variant="label" color={c.primary}>
        Cambiar
      </AppText>
      <Icon name="chevron-right" size={20} color={c.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  body: { flex: 1 },
});

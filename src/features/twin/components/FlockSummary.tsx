import { StyleSheet, View } from 'react-native';

import { AppText, Card, Icon, type IconName } from '@/components/ui';
import type { FlockAction } from '@/domain/behavior/types';
import { Radius, Spacing, useTheme } from '@/theme';

const ACTIONS: Record<FlockAction, { label: string; icon: IconName; stress?: boolean }> = {
  roost: { label: 'Durmiendo en la percha', icon: 'sleep' },
  rest: { label: 'Reposando', icon: 'bed-outline' },
  forage: { label: 'Explorando y picoteando', icon: 'shoe-print' },
  eat: { label: 'Comiendo', icon: 'grain' },
  drink: { label: 'Bebiendo', icon: 'cup-water' },
  preen: { label: 'Acicalándose', icon: 'feather' },
  dustbathe: { label: 'Baño de tierra', icon: 'terrain' },
  pant: { label: 'Jadeando por calor', icon: 'thermometer-alert', stress: true },
  huddle: { label: 'Amontonadas por frío', icon: 'snowflake', stress: true },
  crowd: { label: 'Agitadas por falta de agua o alimento', icon: 'alert-outline', stress: true },
  lethargic: { label: 'Decaídas', icon: 'emoticon-sick-outline', stress: true },
};

/** Qué hace la bandada ahora mismo (el mismo comportamiento que se ve en el 3D). */
export function FlockSummary({ counts }: { counts: Record<FlockAction, number> | null }) {
  const c = useTheme();
  if (!counts) return null;
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const rows = (Object.keys(counts) as FlockAction[])
    .filter((action) => counts[action] > 0)
    .sort((a, b) => counts[b] - counts[a]);

  return (
    <Card style={styles.card}>
      <AppText variant="heading">Qué están haciendo las aves</AppText>
      {rows.map((action) => {
        const info = ACTIONS[action];
        const pct = Math.round((counts[action] / total) * 100);
        const color = info.stress ? c.warning : c.primary;
        return (
          <View key={action} style={styles.row} accessibilityLabel={`${info.label}: ${pct} %`}>
            <Icon name={info.icon} size={16} color={color} />
            <View style={styles.body}>
              <View style={styles.labelRow}>
                <AppText variant="caption" style={styles.flex}>
                  {info.label}
                  {info.stress ? ' · estrés' : ''}
                </AppText>
                <AppText variant="caption" muted>
                  {pct} %
                </AppText>
              </View>
              <View style={[styles.track, { backgroundColor: c.surfaceMuted }]}>
                <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
              </View>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  body: { flex: 1, gap: 3 },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  track: { height: 5, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
});

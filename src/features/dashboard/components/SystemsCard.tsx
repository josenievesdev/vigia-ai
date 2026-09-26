import { StyleSheet, View } from 'react-native';

import { ACTUATOR_ICONS, AppText, Badge, Card, Icon, SectionHeader } from '@/components/ui';
import type { ActuatorView } from '@/store/selectors';
import { Radius, Spacing, useTheme } from '@/theme';

/** Estado resumido de los sistemas automatizados. */
export function SystemsCard({ actuators }: { actuators: ActuatorView[] }) {
  const c = useTheme();
  return (
    <Card style={styles.card}>
      <SectionHeader title="Sistemas" actionLabel="Controlar" href="/automation" />
      <View style={styles.grid}>
        {actuators.map((a) => (
          <View key={a.id} style={[styles.item, { backgroundColor: c.surfaceMuted }]}>
            <Icon name={ACTUATOR_ICONS[a.kind]} size={22} color={a.active ? c.primary : c.textMuted} />
            <View style={styles.itemBody}>
              <AppText variant="label" numberOfLines={1}>
                {a.label}
              </AppText>
              <View style={styles.badges}>
                <Badge label={a.active ? 'Activo' : 'Apagado'} tone={a.active ? 'normal' : 'neutral'} dot />
                {a.mode === 'manual' ? <Badge label="Manual" tone="info" /> : null}
              </View>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  item: {
    flexGrow: 1,
    flexBasis: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  itemBody: { flex: 1, gap: 4 },
  badges: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
});

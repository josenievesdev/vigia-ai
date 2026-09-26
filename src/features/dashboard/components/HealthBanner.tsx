import { StyleSheet, View } from 'react-native';

import { AppText, Icon, type IconName } from '@/components/ui';
import type { HealthStatus } from '@/domain/types';
import { Radius, Spacing, toneColors, useTheme } from '@/theme';

const COPY: Record<HealthStatus, { label: string; icon: IconName; empty: string }> = {
  normal: { label: 'Normal', icon: 'check-circle', empty: 'Todos los sistemas operan dentro de rango.' },
  warning: { label: 'Atención', icon: 'alert', empty: '' },
  critical: { label: 'Crítico', icon: 'alert-octagon', empty: '' },
};

interface HealthBannerProps {
  health: HealthStatus;
  alertCount: number;
  clock: string;
}

export function HealthBanner({ health, alertCount, clock }: HealthBannerProps) {
  const c = useTheme();
  const { fg, bg } = toneColors(c, health);
  const copy = COPY[health];
  const detail =
    alertCount === 0 ? copy.empty : `${alertCount} ${alertCount === 1 ? 'alerta activa' : 'alertas activas'}`;

  return (
    <View
      style={[styles.root, { backgroundColor: bg, borderColor: fg }]}
      accessibilityRole="summary"
      accessibilityLabel={`Estado general: ${copy.label}. ${detail}`}>
      <Icon name={copy.icon} size={36} color={fg} />
      <View style={styles.body}>
        <AppText variant="caption" color={fg}>
          ESTADO GENERAL
        </AppText>
        <AppText variant="title" color={fg}>
          {copy.label}
        </AppText>
        <AppText variant="caption" color={c.text}>
          {detail}
        </AppText>
      </View>
      <View style={styles.clock}>
        <AppText variant="caption" muted>
          Hora granja
        </AppText>
        <AppText variant="heading" style={styles.tabular}>
          {clock}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  body: { flex: 1 },
  clock: { alignItems: 'flex-end' },
  tabular: { fontVariant: ['tabular-nums'] },
});

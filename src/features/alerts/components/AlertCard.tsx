import { StyleSheet, View } from 'react-native';

import { ALERT_ICONS, AppText, Badge, Icon } from '@/components/ui';
import type { Alert } from '@/domain/types';
import { Radius, Spacing, toneColors, useTheme } from '@/theme';
import { formatClock, formatRelative, formatTimeShort } from '@/utils/format';

const SEVERITY_LABEL = { info: 'Info', warning: 'Advertencia', critical: 'Crítica' } as const;

interface AlertCardProps {
  alert: Alert;
  now: number;
  compact?: boolean;
}

export function AlertCard({ alert, now, compact }: AlertCardProps) {
  const c = useTheme();
  const resolved = alert.status === 'resolved';
  const tone = resolved ? 'neutral' : alert.severity;
  const { fg, bg } = toneColors(c, tone);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.surface, borderColor: c.border, borderLeftColor: fg },
      ]}>
      <View style={[styles.icon, { backgroundColor: bg }]}>
        <Icon name={ALERT_ICONS[alert.type]} size={20} color={fg} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <AppText variant="label" style={styles.title} numberOfLines={1}>
            {alert.title}
          </AppText>
          <Badge label={resolved ? 'Resuelta' : SEVERITY_LABEL[alert.severity]} tone={tone} />
        </View>
        <AppText variant="caption" muted numberOfLines={compact ? 2 : undefined}>
          {alert.message}
        </AppText>
        <AppText variant="caption" muted>
          {resolved && alert.resolvedAt
            ? `${formatTimeShort(alert.createdAt, now)} – ${formatClock(alert.resolvedAt)}`
            : `Desde ${formatTimeShort(alert.createdAt, now)} · ${formatRelative(alert.createdAt, now)}`}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 4,
  },
  icon: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { flex: 1 },
});

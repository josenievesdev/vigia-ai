import { StyleSheet, View } from 'react-native';

import { AppText, Icon, type IconName } from '@/components/ui';
import type { Decision, DecisionSource } from '@/domain/types';
import { Radius, Spacing, useTheme } from '@/theme';
import { formatTimeShort } from '@/utils/format';

const SOURCE: Record<DecisionSource, { label: string; icon: IconName }> = {
  rule: { label: 'Motor de reglas', icon: 'robot-outline' },
  ai: { label: 'IA', icon: 'brain' },
  user: { label: 'Usuario', icon: 'account-outline' },
};

export function DecisionItem({ decision, now }: { decision: Decision; now: number }) {
  const c = useTheme();
  const source = SOURCE[decision.source];
  const isUser = decision.source === 'user';
  return (
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: isUser ? c.infoSoft : c.primarySoft }]}>
        <Icon name={source.icon} size={16} color={isUser ? c.info : c.primary} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <AppText variant="label" style={styles.title}>
            {decision.summary}
          </AppText>
          <AppText variant="caption" muted>
            {formatTimeShort(decision.timestamp, now)}
          </AppText>
        </View>
        <AppText variant="caption" muted>
          {source.label} · {decision.reason}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.md, paddingVertical: Spacing.sm },
  icon: { width: 30, height: 30, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', gap: Spacing.sm },
  title: { flex: 1 },
});

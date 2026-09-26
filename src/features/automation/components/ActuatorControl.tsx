import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { ACTUATOR_ICONS, AppText, Badge, Icon } from '@/components/ui';
import type { ActuatorView } from '@/store/selectors';
import { Radius, Spacing, useTheme } from '@/theme';

interface ActuatorControlProps {
  actuator: ActuatorView;
  onToggle: (active: boolean) => void;
  onAuto: () => void;
}

/** Fila de control: el switch pasa el equipo a manual; "Automático" lo devuelve al motor. */
export function ActuatorControl({ actuator, onToggle, onAuto }: ActuatorControlProps) {
  const c = useTheme();
  const manual = actuator.mode === 'manual';

  return (
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: actuator.active ? c.primarySoft : c.surfaceMuted }]}>
        <Icon name={ACTUATOR_ICONS[actuator.kind]} size={22} color={actuator.active ? c.primary : c.textMuted} />
      </View>
      <View style={styles.body}>
        <AppText variant="label">{actuator.label}</AppText>
        <View style={styles.badges}>
          <Badge label={manual ? 'Manual' : 'Automático'} tone={manual ? 'info' : 'normal'} />
          {manual ? (
            <Pressable onPress={onAuto} accessibilityRole="button" hitSlop={8}>
              <AppText variant="caption" color={c.primary}>
                Volver a automático
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </View>
      <Switch
        value={actuator.active}
        onValueChange={onToggle}
        trackColor={{ true: c.primary, false: c.border }}
        accessibilityLabel={`${actuator.label} ${actuator.active ? 'encendido' : 'apagado'}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  icon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 4 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});

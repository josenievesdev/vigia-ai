import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Badge, Card, Icon, type IconName } from '@/components/ui';
import { Radius, Spacing, toneColors, useTheme } from '@/theme';

import type { TwinElement, TwinElementId, TwinStatus } from '../twinState';

export const STATUS_LABEL: Record<TwinStatus, string> = {
  normal: 'Normal',
  warning: 'Advertencia',
  critical: 'Crítico',
  offline: 'Sin conexión',
  neutral: 'Sin datos',
};

const ELEMENT_ICONS: Record<TwinElementId, IconName> = {
  climate: 'thermometer',
  hens: 'bird',
  ventilation: 'fan',
  feeder: 'silo',
  water: 'cup-water',
  lighting: 'lightbulb-on-outline',
};

interface TwinPanelProps {
  elements: TwinElement[];
  selected: TwinElementId | null;
  onSelect: (id: TwinElementId | null) => void;
}

/** Lista de elementos del gemelo: el mismo estado del 3D, legible como texto. */
export function TwinPanel({ elements, selected, onSelect }: TwinPanelProps) {
  const current = elements.find((e) => e.id === selected);
  return (
    <View style={styles.root}>
      {current ? <ElementDetail element={current} onClose={() => onSelect(null)} /> : null}
      <Card style={styles.list}>
        {elements.map((e, i) => (
          <ElementRow key={e.id} element={e} selected={e.id === selected} first={i === 0} onPress={() => onSelect(e.id)} />
        ))}
      </Card>
    </View>
  );
}

function ElementRow({
  element,
  selected,
  first,
  onPress,
}: {
  element: TwinElement;
  selected: boolean;
  first: boolean;
  onPress: () => void;
}) {
  const c = useTheme();
  const { fg, bg } = toneColors(c, element.status);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${element.label}: ${element.value}. ${STATUS_LABEL[element.status]}`}
      style={({ pressed }) => [
        styles.row,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
        selected && { backgroundColor: c.infoSoft },
        pressed && { opacity: 0.7 },
      ]}>
      <View style={[styles.icon, { backgroundColor: bg }]}>
        <Icon name={ELEMENT_ICONS[element.id]} size={18} color={fg} />
      </View>
      <View style={styles.body}>
        <AppText variant="label">{element.label}</AppText>
        <AppText variant="caption" muted numberOfLines={1}>
          {element.value}
        </AppText>
      </View>
      <Badge label={STATUS_LABEL[element.status]} tone={element.status} dot />
    </Pressable>
  );
}

function ElementDetail({ element, onClose }: { element: TwinElement; onClose: () => void }) {
  const c = useTheme();
  return (
    <Card style={[styles.detail, { borderColor: c.info }]}>
      <View style={styles.detailHeader}>
        <Icon name={ELEMENT_ICONS[element.id]} size={22} color={c.text} />
        <AppText variant="heading" style={styles.flex}>
          {element.label}
        </AppText>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar detalle" hitSlop={10}>
          <Icon name="close" size={20} color={c.textMuted} />
        </Pressable>
      </View>
      <View style={styles.detailValue}>
        <AppText variant="body" style={styles.flex}>
          {element.value}
        </AppText>
        <Badge label={STATUS_LABEL[element.status]} tone={element.status} dot />
      </View>
      <AppText variant="caption" muted>
        {element.detail}
      </AppText>
      <Pressable
        onPress={() => router.push({ pathname: '/sensor/[kind]', params: { kind: element.sensorKind } })}
        accessibilityRole="link"
        style={({ pressed }) => [styles.historyButton, { backgroundColor: c.primarySoft, opacity: pressed ? 0.7 : 1 }]}>
        <Icon name="chart-line" size={18} color={c.primary} />
        <AppText variant="label" color={c.primary}>
          Ver historial
        </AppText>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.md },
  list: { padding: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2 },
  icon: { width: 34, height: 34, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 1 },
  detail: { gap: Spacing.sm, borderWidth: 1 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  detailValue: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
  },
});

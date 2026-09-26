import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { ThresholdBand } from '@/domain/status';
import { type ColorTokens, Spacing, useTheme } from '@/theme';

function swatch(c: ColorTokens, kind: ThresholdBand['kind']): { color: string; opacity: number } {
  if (kind === 'optimal') return { color: c.normal, opacity: 0.25 };
  if (kind === 'warning') return { color: c.warning, opacity: 0.35 };
  return { color: c.critical, opacity: 0.3 };
}

function rangeText(b: ThresholdBand): string {
  if (!Number.isFinite(b.from)) return `≤ ${b.to}`;
  if (!Number.isFinite(b.to)) return `≥ ${b.from}`;
  return `${b.from}–${b.to}`;
}

interface BandLegendProps {
  bands: ThresholdBand[];
  unit: string;
  /** Muestra la clave de las franjas de equipos. */
  showEquipment: boolean;
}

/** Leyenda: qué significa cada zona de color y la franja de equipos (nunca solo color). */
export function BandLegend({ bands, unit, showEquipment }: BandLegendProps) {
  const c = useTheme();
  const kinds = (['optimal', 'warning', 'critical'] as const).filter((k) => bands.some((b) => b.kind === k));
  const unitSuffix = unit.startsWith('/') ? unit : ` ${unit}`;

  return (
    <View style={styles.root}>
      {kinds.map((kind) => {
        const group = bands.filter((b) => b.kind === kind);
        const ranges = group.map(rangeText).join(' · ');
        const s = swatch(c, kind);
        return (
          <View key={kind} style={styles.item}>
            <View style={[styles.swatch, { backgroundColor: s.color, opacity: s.opacity }]} />
            <AppText variant="caption" muted>
              {group[0].label} {ranges}
              {unitSuffix}
            </AppText>
          </View>
        );
      })}
      {showEquipment ? (
        <View style={styles.item}>
          <View style={[styles.bar, { backgroundColor: c.primary }]} />
          <AppText variant="caption" muted>
            Equipo encendido
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.lg, rowGap: Spacing.xs },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  bar: { width: 14, height: 6, borderRadius: 2 },
});

import { useState } from 'react';
import { type GestureResponderEvent, type LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';

import { AppText } from '@/components/ui/AppText';
import { Radius, Spacing, useTheme } from '@/theme';

import { linearScale, niceDomain } from './scale';

export interface BarDatum {
  key: string | number;
  /** Etiqueta del eje X (p. ej. "25/09"). */
  label: string;
  value: number;
  /** Dato incompleto (p. ej. el día en curso): se dibuja más claro. */
  partial?: boolean;
}

interface BarChartProps {
  data: BarDatum[];
  formatValue: (value: number) => string;
  accessibilityLabel: string;
  plotHeight?: number;
  /** Cada cuántas barras se etiqueta el eje X. */
  labelEvery?: number;
}

const MARGIN = { left: 42, right: 8, top: 10 };
const X_AXIS_BAND = 20;
const MAX_BAR = 24;
const TOOLTIP_WIDTH = 140;
const CHART_FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' : undefined;

/** Barra con extremo superior redondeado y base recta (nace de la línea base). */
function barPath(x: number, y: number, w: number, base: number): string {
  const r = Math.min(4, w / 2, Math.max(0, base - y));
  return `M${x},${base}L${x},${y + r}Q${x},${y} ${x + r},${y}L${x + w - r},${y}Q${x + w},${y} ${x + w},${y + r}L${x + w},${base}Z`;
}

/** Barras de una sola serie (magnitud por día) con cursor táctil. */
export function BarChart({ data, formatValue, accessibilityLabel, plotHeight = 150, labelEvery = 7 }: BarChartProps) {
  const c = useTheme();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  const x0 = MARGIN.left;
  const x1 = Math.max(x0 + 1, width - MARGIN.right);
  const base = MARGIN.top + plotHeight;
  const max = Math.max(1, ...data.map((d) => d.value));
  const { domain, ticks } = niceDomain(0, max, 4);
  const y = linearScale(0, domain[1], base, MARGIN.top);
  const slot = data.length ? (x1 - x0) / data.length : 0;
  const barWidth = Math.max(2, Math.min(MAX_BAR, slot - 2));

  const pick = (e: GestureResponderEvent) => {
    const i = Math.floor(e.nativeEvent.locationX / Math.max(1, slot));
    setActive(Math.min(data.length - 1, Math.max(0, i)));
  };
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const selected = active !== null ? data[active] : null;

  return (
    <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      {width > 0 ? (
        <Svg width={width} height={base + X_AXIS_BAND}>
          {ticks.map((t) => (
            <Line key={`g${t}`} x1={x0} x2={x1} y1={y(t)} y2={y(t)} stroke={c.chartGrid} strokeWidth={1} />
          ))}
          {ticks.map((t) => (
            <SvgText key={`t${t}`} x={x0 - 6} y={y(t) + 3} fontSize={10} fontFamily={CHART_FONT} fill={c.textMuted} textAnchor="end">
              {formatValue(t)}
            </SvgText>
          ))}
          {data.map((d, i) => {
            const bx = x0 + i * slot + (slot - barWidth) / 2;
            const isActive = i === active;
            return (
              <Path
                key={d.key}
                d={barPath(bx, y(d.value), barWidth, base)}
                fill={isActive ? c.primary : c.chartLine}
                fillOpacity={d.partial ? 0.4 : 1}
              />
            );
          })}
          <Line x1={x0} x2={x1} y1={base} y2={base} stroke={c.chartAxis} strokeWidth={1} />
          {data.map((d, i) => {
            const last = i === data.length - 1;
            if (i % labelEvery !== 0 && !last) return null;
            const cx = x0 + i * slot + slot / 2;
            return (
              <SvgText
                key={`x${d.key}`}
                x={cx}
                y={base + 14}
                fontSize={10}
                fontFamily={CHART_FONT}
                fill={c.textMuted}
                textAnchor={last ? 'end' : 'middle'}>
                {d.partial ? 'hoy' : d.label}
              </SvgText>
            );
          })}
        </Svg>
      ) : (
        <View style={{ height: base + X_AXIS_BAND }} />
      )}

      <View
        style={[styles.touch, { left: x0, width: x1 - x0, height: base }]}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={pick}
        onResponderMove={pick}
        onResponderRelease={() => setActive(null)}
        onResponderTerminate={() => setActive(null)}
      />

      {selected && active !== null ? (
        <View
          style={[
            styles.tooltip,
            {
              left: Math.min(Math.max(0, x0 + active * slot - TOOLTIP_WIDTH / 2), Math.max(0, width - TOOLTIP_WIDTH)),
              backgroundColor: c.surface,
              borderColor: c.border,
            },
          ]}>
          <AppText variant="heading">{formatValue(selected.value)}</AppText>
          <AppText variant="caption" muted>
            {selected.partial ? 'Hoy (hasta ahora)' : selected.label}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  touch: { position: 'absolute', top: 0 },
  tooltip: {
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    width: TOOLTIP_WIDTH,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
});

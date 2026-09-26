import { useState } from 'react';
import { type GestureResponderEvent, type LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { AppText } from '@/components/ui/AppText';
import type { ThresholdBand } from '@/domain/status';
import { downsample, splitSegments } from '@/services/history/analytics';
import type { ActuatorInterval, ActuatorTrack, SeriesPoint } from '@/services/history/HistoryRepository';
import { type ColorTokens, Radius, Spacing, useTheme } from '@/theme';
import { formatClock } from '@/utils/format';

import { linearScale, niceDomain, timeTicks } from './scale';

interface TimeSeriesChartProps {
  points: SeriesPoint[];
  from: number;
  to: number;
  bands?: ThresholdBand[];
  /** Dominio fijo del eje Y (p. ej. 0–100 para niveles). Si no, se ajusta a los datos. */
  fixedDomain?: [number, number];
  formatValue: (value: number) => string;
  strips?: ActuatorTrack[];
  plotHeight?: number;
  accessibilityLabel: string;
}

const MARGIN = { left: 38, right: 10, top: 8 };
const X_AXIS_BAND = 22;
const STRIP_ROW = 30;
const TOOLTIP_WIDTH = 150;
/** En web el texto SVG usa serif por defecto; en nativo ya es la fuente del sistema. */
const CHART_FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' : undefined;

function bandFill(c: ColorTokens, kind: ThresholdBand['kind']): { color: string; opacity: number } {
  if (kind === 'optimal') return { color: c.normal, opacity: 0.08 };
  if (kind === 'warning') return { color: c.warning, opacity: 0.14 };
  return { color: c.critical, opacity: 0.12 };
}

function nearestPoint(points: SeriesPoint[], t: number): SeriesPoint | null {
  let best: SeriesPoint | null = null;
  for (const p of points) {
    if (!best || Math.abs(p.t - t) < Math.abs(best.t - t)) best = p;
  }
  return best;
}

function isActiveAt(intervals: ActuatorInterval[], t: number): boolean {
  return intervals.some((i) => i.start <= t && (i.end === null || i.end >= t));
}

/**
 * Serie temporal de una variable: bandas de umbral (explicadas en la leyenda), línea de 2 px,
 * franjas de encendido de equipos (causa → efecto) y cursor táctil con tooltip.
 */
export function TimeSeriesChart({
  points,
  from,
  to,
  bands = [],
  fixedDomain,
  formatValue,
  strips = [],
  plotHeight = 180,
  accessibilityLabel,
}: TimeSeriesChartProps) {
  const c = useTheme();
  const [width, setWidth] = useState(0);
  const [cursorT, setCursorT] = useState<number | null>(null);

  const totalHeight = MARGIN.top + plotHeight + X_AXIS_BAND + strips.length * STRIP_ROW;
  const x0 = MARGIN.left;
  const x1 = Math.max(x0 + 1, width - MARGIN.right);
  const yTop = MARGIN.top;
  const yBottom = MARGIN.top + plotHeight;

  const finite = points.filter((p) => Number.isFinite(p.v));

  // Dominio Y: fijo, o datos + rango óptimo (para que la referencia siempre se vea).
  let domain: [number, number];
  let yTicks: number[];
  if (fixedDomain) {
    domain = fixedDomain;
    yTicks = niceDomain(fixedDomain[0], fixedDomain[1]).ticks.filter((v) => v >= domain[0] && v <= domain[1]);
  } else {
    const optimal = bands.find((b) => b.kind === 'optimal');
    let lo = Math.min(...finite.map((p) => p.v), optimal?.from ?? Infinity);
    let hi = Math.max(...finite.map((p) => p.v), optimal?.to ?? -Infinity);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      lo = 0;
      hi = 1;
    }
    const pad = (hi - lo) * 0.08 || 1;
    ({ domain, ticks: yTicks } = niceDomain(lo - pad, hi + pad));
  }

  const x = linearScale(from, to, x0, x1);
  const y = linearScale(domain[0], domain[1], yBottom, yTop);
  const tickPrecision = yTicks.length > 1 && Math.abs(yTicks[1] - yTicks[0]) < 1 ? 1 : 0;

  const drawn = downsample(points, Math.max(2, Math.floor((x1 - x0) / 2)));
  const segments = splitSegments(drawn);
  const linePath = segments
    .filter((s) => s.length > 1)
    .map((s) => s.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(''))
    .join('');
  const lonePoints = segments.filter((s) => s.length === 1).map((s) => s[0]);
  const last = finite[finite.length - 1];
  const cursor = cursorT !== null ? nearestPoint(finite, cursorT) : null;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const moveCursor = (e: GestureResponderEvent) => {
    const ratio = Math.min(1, Math.max(0, e.nativeEvent.locationX / (x1 - x0)));
    setCursorT(from + ratio * (to - from));
  };

  return (
    <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      {width > 0 ? (
        <Svg width={width} height={totalHeight}>
          {bands.map((b, i) => {
            const top = y(Math.min(b.to, domain[1]));
            const bottom = y(Math.max(b.from, domain[0]));
            if (bottom - top <= 0) return null;
            const fill = bandFill(c, b.kind);
            return (
              <Rect
                key={`band-${i}`}
                x={x0}
                y={top}
                width={x1 - x0}
                height={bottom - top}
                fill={fill.color}
                fillOpacity={fill.opacity}
              />
            );
          })}

          {yTicks.map((v) => (
            <Line key={`grid-${v}`} x1={x0} x2={x1} y1={y(v)} y2={y(v)} stroke={c.chartGrid} strokeWidth={1} />
          ))}
          <Line x1={x0} x2={x1} y1={yBottom} y2={yBottom} stroke={c.chartAxis} strokeWidth={1} />
          {yTicks.map((v) => (
            <SvgText key={`ytick-${v}`} x={x0 - 6} y={y(v) + 3} fontSize={10} fontFamily={CHART_FONT} fill={c.textMuted} textAnchor="end">
              {v.toFixed(tickPrecision)}
            </SvgText>
          ))}
          {timeTicks(from, to).map((t) => {
            const px = x(t);
            const anchor = px - x0 < 18 ? 'start' : x1 - px < 18 ? 'end' : 'middle';
            return (
              <SvgText key={`xtick-${t}`} x={px} y={yBottom + 15} fontSize={10} fontFamily={CHART_FONT} fill={c.textMuted} textAnchor={anchor}>
                {formatClock(t)}
              </SvgText>
            );
          })}

          <Path d={linePath} stroke={c.chartLine} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {lonePoints.map((p) => (
            <Circle key={`lone-${p.t}`} cx={x(p.t)} cy={y(p.v)} r={2} fill={c.chartLine} />
          ))}
          {last && !cursor ? (
            <Circle cx={x(last.t)} cy={y(last.v)} r={4} fill={c.chartLine} stroke={c.surface} strokeWidth={2} />
          ) : null}

          {strips.map((strip, i) => {
            const rowTop = yBottom + X_AXIS_BAND + i * STRIP_ROW;
            return (
              <SvgText key={`strip-label-${strip.id}`} x={x0} y={rowTop + 10} fontSize={10} fontFamily={CHART_FONT} fill={c.textMuted}>
                {strip.label}
              </SvgText>
            );
          })}
          {strips.map((strip, i) => {
            const barTop = yBottom + X_AXIS_BAND + i * STRIP_ROW + 15;
            return (
              <Rect
                key={`strip-track-${strip.id}`}
                x={x0}
                y={barTop}
                width={x1 - x0}
                height={8}
                rx={4}
                fill={c.surfaceMuted}
              />
            );
          })}
          {strips.flatMap((strip, i) => {
            const barTop = yBottom + X_AXIS_BAND + i * STRIP_ROW + 15;
            return strip.intervals.map((interval) => {
              const sx = x(Math.max(interval.start, from));
              const ex = x(Math.min(interval.end ?? to, to));
              return (
                <Rect
                  key={`strip-${strip.id}-${interval.start}`}
                  x={sx}
                  y={barTop}
                  width={Math.max(2, ex - sx)}
                  height={8}
                  rx={2}
                  fill={c.primary}
                />
              );
            });
          })}

          {cursor ? (
            <>
              <Line x1={x(cursor.t)} x2={x(cursor.t)} y1={yTop} y2={totalHeight} stroke={c.textMuted} strokeWidth={1} />
              <Circle cx={x(cursor.t)} cy={y(cursor.v)} r={5} fill={c.chartLine} stroke={c.surface} strokeWidth={2} />
            </>
          ) : null}
        </Svg>
      ) : (
        <View style={{ height: totalHeight }} />
      )}

      {/* Capa táctil: arrastrar muestra el valor más cercano. */}
      <View
        style={[styles.touchLayer, { left: x0, width: x1 - x0, height: totalHeight }]}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={moveCursor}
        onResponderMove={moveCursor}
        onResponderRelease={() => setCursorT(null)}
        onResponderTerminate={() => setCursorT(null)}
      />

      {cursor ? (
        <View
          style={[
            styles.tooltip,
            {
              left: Math.min(Math.max(0, x(cursor.t) - TOOLTIP_WIDTH / 2), Math.max(0, width - TOOLTIP_WIDTH)),
              backgroundColor: c.surface,
              borderColor: c.border,
            },
          ]}>
          <AppText variant="heading">{formatValue(cursor.v)}</AppText>
          <AppText variant="caption" muted>
            {formatClock(cursor.t)}
          </AppText>
          {strips.map((strip) => (
            <AppText key={strip.id} variant="caption" muted>
              {strip.label}: {isActiveAt(strip.intervals, cursor.t) ? 'encendido' : 'apagado'}
            </AppText>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  touchLayer: { position: 'absolute', top: 0 },
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

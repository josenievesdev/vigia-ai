import { useState } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { downsample, splitSegments } from '@/services/history/analytics';
import type { SeriesPoint } from '@/services/history/HistoryRepository';
import { useTheme } from '@/theme';

import { linearScale } from './scale';

interface SparklineProps {
  points: SeriesPoint[];
  height?: number;
}

/** Tendencia compacta: línea de contexto en gris y el valor actual resaltado. */
export function Sparkline({ points, height = 28 }: SparklineProps) {
  const c = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const drawn = downsample(points, 24);
  const finite = drawn.filter((p) => Number.isFinite(p.v));
  const ready = width > 0 && finite.length > 1;

  let content = null;
  if (ready) {
    const values = finite.map((p) => p.v);
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    if (hi - lo < 1e-6) {
      lo -= 1;
      hi += 1;
    }
    const x = linearScale(finite[0].t, finite[finite.length - 1].t, 2, width - 5);
    const y = linearScale(lo, hi, height - 4, 4);
    const d = splitSegments(drawn)
      .filter((s) => s.length > 1)
      .map((s) => s.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(''))
      .join('');
    const last = finite[finite.length - 1];
    content = (
      <Svg width={width} height={height}>
        <Path d={d} stroke={c.chartMuted} strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={x(last.t)} cy={y(last.v)} r={3} fill={c.chartLine} stroke={c.surface} strokeWidth={1.5} />
      </Svg>
    );
  }

  return (
    <View onLayout={onLayout} style={{ height }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {content}
    </View>
  );
}

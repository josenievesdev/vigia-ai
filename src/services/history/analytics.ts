import type { Timestamp } from '@/domain/types';

import type { SeriesPoint } from './HistoryRepository';

/** Hueco máximo que se pondera entre dos puntos (evita que un corte largo domine el promedio). */
const MAX_WEIGHT_MS = 15 * 60_000;

export interface SeriesStats {
  min: number;
  max: number;
  /** Promedio ponderado por tiempo. */
  avg: number;
  last: number;
  /** % del tiempo dentro del rango indicado (si se pasa `range`). */
  inRangePct: number | null;
}

/** Pesos por tiempo: cada punto vale hasta el siguiente (el último, como el anterior). */
function timeWeights(points: SeriesPoint[]): number[] {
  return points.map((p, i) => {
    const next = points[i + 1];
    const prev = points[i - 1];
    const gap = next ? next.t - p.t : prev ? p.t - prev.t : 1;
    return Math.min(Math.max(gap, 0), MAX_WEIGHT_MS) || 1;
  });
}

export function computeStats(points: SeriesPoint[], range?: { min: number; max: number }): SeriesStats | null {
  const valid = points.filter((p) => Number.isFinite(p.v));
  if (!valid.length) return null;
  const weights = timeWeights(valid);
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let total = 0;
  let inRange = 0;
  valid.forEach((p, i) => {
    min = Math.min(min, p.v);
    max = Math.max(max, p.v);
    sum += p.v * weights[i];
    total += weights[i];
    if (range && p.v >= range.min && p.v <= range.max) inRange += weights[i];
  });
  return {
    min,
    max,
    avg: sum / total,
    last: valid[valid.length - 1].v,
    inRangePct: range ? (inRange / total) * 100 : null,
  };
}

export interface HourlyRow {
  hour: Timestamp;
  min: number;
  avg: number;
  max: number;
}

/** Resumen por hora (más reciente primero) para la vista de tabla. */
export function hourlySummary(points: SeriesPoint[]): HourlyRow[] {
  const groups = new Map<number, SeriesPoint[]>();
  for (const p of points) {
    if (!Number.isFinite(p.v)) continue;
    const d = new Date(p.t);
    d.setMinutes(0, 0, 0);
    const key = d.getTime();
    const group = groups.get(key);
    if (group) group.push(p);
    else groups.set(key, [p]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b - a)
    .flatMap(([hour, group]) => {
      const stats = computeStats(group);
      return stats ? [{ hour, min: stats.min, avg: stats.avg, max: stats.max }] : [];
    });
}

/** Separa la serie en tramos continuos (los NaN marcan cortes de datos). */
export function splitSegments(points: SeriesPoint[]): SeriesPoint[][] {
  const segments: SeriesPoint[][] = [];
  let current: SeriesPoint[] = [];
  for (const p of points) {
    if (Number.isFinite(p.v)) {
      current.push(p);
    } else if (current.length) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length) segments.push(current);
  return segments;
}

/** Reduce la serie a ~`maxPoints` promediando por tramos, conservando los cortes. */
export function downsample(points: SeriesPoint[], maxPoints: number): SeriesPoint[] {
  if (points.length <= maxPoints || maxPoints < 2) return points;
  const size = Math.ceil(points.length / maxPoints);
  const out: SeriesPoint[] = [];
  for (let i = 0; i < points.length; i += size) {
    const chunk = points.slice(i, i + size);
    const valid = chunk.filter((p) => Number.isFinite(p.v));
    if (valid.length) {
      const v = valid.reduce((acc, p) => acc + p.v, 0) / valid.length;
      out.push({ t: valid[valid.length - 1].t, v });
    }
    if (valid.length < chunk.length) out.push({ t: chunk[chunk.length - 1].t, v: NaN });
  }
  return out;
}

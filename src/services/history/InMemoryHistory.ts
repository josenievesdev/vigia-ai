import type { Timestamp } from '@/domain/types';
import type { TelemetryBatch } from '@/services/telemetry/TelemetrySource';

import type { ActuatorInterval, HistoryRepository, SeriesPoint } from './HistoryRepository';

export interface InMemoryHistoryOptions {
  /** Resolución: las lecturas dentro de un mismo intervalo se promedian en un punto. */
  bucketMs?: number;
  /** Cuánto historial se conserva (hora de la granja). */
  retentionMs?: number;
}

interface StoredPoint extends SeriesPoint {
  n: number;
  bucket: number;
}

/** Historial acotado en memoria: un punto por minuto y 26 h de retención por defecto. */
export class InMemoryHistory implements HistoryRepository {
  private readonly bucketMs: number;
  private readonly retentionMs: number;
  private readonly points = new Map<string, StoredPoint[]>();
  private readonly intervals = new Map<string, ActuatorInterval[]>();
  private readonly listeners = new Set<() => void>();
  private version = 0;

  constructor(options: InMemoryHistoryOptions = {}) {
    this.bucketMs = options.bucketMs ?? 60_000;
    this.retentionMs = options.retentionMs ?? 26 * 3600_000;
  }

  append(batch: TelemetryBatch): void {
    for (const r of batch.readings) this.addPoint(r.sensorId, r.timestamp, r.value);
    for (const s of batch.sensorStatus) {
      if (!s.online) this.addGap(s.sensorId, batch.timestamp);
    }
    for (const a of batch.actuators) this.trackActuator(a.actuatorId, a.active, a.changedAt);
    this.trim(batch.timestamp - this.retentionMs);
    this.version++;
    for (const listener of this.listeners) listener();
  }

  series(sensorId: string, from: Timestamp, to: Timestamp): SeriesPoint[] {
    const list = this.points.get(sensorId) ?? [];
    const result: SeriesPoint[] = [];
    for (const p of list) if (p.t >= from && p.t <= to) result.push({ t: p.t, v: p.v });
    return result;
  }

  actuatorIntervals(actuatorId: string, from: Timestamp, to: Timestamp): ActuatorInterval[] {
    return (this.intervals.get(actuatorId) ?? []).filter(
      (i) => i.start <= to && (i.end === null || i.end >= from),
    );
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = (): number => this.version;

  clear(): void {
    this.points.clear();
    this.intervals.clear();
    this.version++;
    for (const listener of this.listeners) listener();
  }

  // --- Internos ------------------------------------------------------------

  private listFor(sensorId: string): StoredPoint[] {
    let list = this.points.get(sensorId);
    if (!list) {
      list = [];
      this.points.set(sensorId, list);
    }
    return list;
  }

  private addPoint(sensorId: string, t: Timestamp, v: number): void {
    const list = this.listFor(sensorId);
    const bucket = Math.floor(t / this.bucketMs);
    const last = list[list.length - 1];
    if (last && last.bucket === bucket && !Number.isNaN(last.v)) {
      last.v = (last.v * last.n + v) / (last.n + 1);
      last.n += 1;
      last.t = t;
      return;
    }
    list.push({ t, v, n: 1, bucket });
  }

  private addGap(sensorId: string, t: Timestamp): void {
    const list = this.listFor(sensorId);
    const last = list[list.length - 1];
    if (last && Number.isNaN(last.v)) return;
    list.push({ t, v: NaN, n: 0, bucket: Math.floor(t / this.bucketMs) });
  }

  private trackActuator(actuatorId: string, active: boolean, changedAt: Timestamp): void {
    let list = this.intervals.get(actuatorId);
    if (!list) {
      list = [];
      this.intervals.set(actuatorId, list);
    }
    const last = list[list.length - 1];
    const isOpen = last !== undefined && last.end === null;
    if (active && !isOpen) list.push({ start: changedAt, end: null });
    else if (!active && isOpen) last.end = changedAt;
  }

  private trim(cutoff: Timestamp): void {
    for (const list of this.points.values()) {
      let i = 0;
      while (i < list.length && list[i].t < cutoff) i++;
      if (i > 0) list.splice(0, i);
    }
    for (const list of this.intervals.values()) {
      let i = 0;
      while (i < list.length) {
        const end = list[i].end;
        if (end === null || end >= cutoff) break;
        i++;
      }
      if (i > 0) list.splice(0, i);
    }
  }
}

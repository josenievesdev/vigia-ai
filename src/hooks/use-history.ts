import { useMemo, useSyncExternalStore } from 'react';

import { RELATED_ACTUATORS } from '@/domain/catalog';
import type { Actuator, SensorKind, Timestamp } from '@/domain/types';
import type { ActuatorTrack, HistoryRepository, SeriesPoint } from '@/services/history/HistoryRepository';
import { getFarmRuntime } from '@/services/runtime';
import { useFarmStore } from '@/store/useFarmStore';

export interface SensorHistoryView {
  sensorId: string | null;
  from: Timestamp;
  to: Timestamp;
  points: SeriesPoint[];
  strips: ActuatorTrack[];
}

const EMPTY: SensorHistoryView = { sensorId: null, from: 0, to: 0, points: [], strips: [] };

/** Versión del historial: cambia con cada lote de telemetría. */
function useHistoryVersion(history: HistoryRepository): number {
  return useSyncExternalStore(history.subscribe, history.getVersion, history.getVersion);
}

/**
 * Lee el historial de una variable. `version` forma parte de la entrada para que
 * la vista se recalcule cuando llegan datos nuevos.
 */
function readHistory(
  version: number,
  history: HistoryRepository,
  zoneId: string | undefined,
  kind: SensorKind,
  sensorId: string | undefined,
  actuators: Actuator[],
  now: Timestamp | null,
  rangeMs: number,
): SensorHistoryView {
  if (!sensorId || now === null || version < 0) return EMPTY;
  const from = now - rangeMs;
  const strips = RELATED_ACTUATORS[kind].flatMap((actuatorKind) => {
    const actuator = actuators.find((a) => a.zoneId === zoneId && a.kind === actuatorKind);
    return actuator
      ? [{ id: actuator.id, label: actuator.label, intervals: history.actuatorIntervals(actuator.id, from, now) }]
      : [];
  });
  return { sensorId, from, to: now, points: history.series(sensorId, from, now), strips };
}

/**
 * Historial de una variable en la ventana `rangeMs` hasta la hora actual de la granja.
 * Es la frontera estable para las pantallas: cuando el historial venga del
 * backend, cambiará la implementación de este hook, no las pantallas.
 */
export function useSensorHistory(zoneId: string | undefined, kind: SensorKind, rangeMs: number): SensorHistoryView {
  const history = getFarmRuntime().history;
  const version = useHistoryVersion(history);
  const now = useFarmStore((s) => s.now);
  const actuators = useFarmStore((s) => s.actuators);
  const sensorId = useFarmStore((s) => s.sensors.find((x) => x.zoneId === zoneId && x.kind === kind)?.id);

  return useMemo(
    () => readHistory(version, history, zoneId, kind, sensorId, actuators, now, rangeMs),
    [version, history, zoneId, kind, sensorId, actuators, now, rangeMs],
  );
}

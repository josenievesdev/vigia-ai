import type { Timestamp } from '@/domain/types';
import type { TelemetryBatch } from '@/services/telemetry/TelemetrySource';

/** Punto de una serie. `v` es NaN cuando no hubo dato (sensor desconectado): corta la línea. */
export interface SeriesPoint {
  t: Timestamp;
  v: number;
}

/** Periodo en el que un equipo estuvo encendido. `end` null = sigue encendido. */
export interface ActuatorInterval {
  start: Timestamp;
  end: Timestamp | null;
}

/** Periodos de encendido de un equipo, listos para dibujar junto a una serie. */
export interface ActuatorTrack {
  id: string;
  label: string;
  intervals: ActuatorInterval[];
}

/**
 * Historial de telemetría. Hoy vive en memoria; con backend se implementará
 * contra la base de datos (series temporales) sin cambiar las pantallas.
 */
export interface HistoryRepository {
  append(batch: TelemetryBatch): void;
  series(sensorId: string, from: Timestamp, to: Timestamp): SeriesPoint[];
  actuatorIntervals(actuatorId: string, from: Timestamp, to: Timestamp): ActuatorInterval[];
  /** Suscripción a cambios (compatible con useSyncExternalStore). */
  subscribe(listener: () => void): () => void;
  getVersion(): number;
  clear(): void;
}

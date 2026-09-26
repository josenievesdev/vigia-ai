/**
 * Capa de visión artificial (FUTURA, no implementada).
 *
 * Contrato previsto para que cámaras + modelos de visión alimenten el mismo
 * motor de decisiones que los sensores IoT. Los análisis se harán fuera del
 * teléfono (gateway en la granja o nube); la app solo consume los eventos.
 *
 * Capacidades planificadas:
 *  - Detección de movimiento.
 *  - Comportamiento anormal (aglomeración, jadeo por calor, inmovilidad, picaje).
 *  - Conteo de animales.
 *  - Análisis de video por cámara/zona.
 */

import type { Timestamp } from '@/domain/types';

export interface Camera {
  id: string;
  zoneId: string;
  label: string;
  streamUrl?: string;
}

export type VisionEventType = 'motion' | 'abnormalBehavior' | 'animalCount';

export type BehaviorPattern = 'crowding' | 'panting' | 'immobility' | 'pecking' | 'unknown';

interface VisionEventBase {
  id: string;
  cameraId: string;
  zoneId: string;
  timestamp: Timestamp;
  /** Confianza del modelo, 0–1. */
  confidence: number;
  snapshotUrl?: string;
}

export type VisionEvent =
  | (VisionEventBase & { type: 'motion'; intensity: number })
  | (VisionEventBase & { type: 'abnormalBehavior'; pattern: BehaviorPattern; affectedCount?: number })
  | (VisionEventBase & { type: 'animalCount'; count: number; expected: number });

/** Resumen por zona que se agregará al contexto del motor de reglas. */
export interface VisionInsights {
  zoneId: string;
  motionIndex?: number;
  animalCount?: number;
  recentEvents: VisionEvent[];
}

import type {
  ActuatorCommand,
  ActuatorState,
  SensorReading,
  SensorStatus,
  Timestamp,
} from '@/domain/types';

/** Paquete de datos que la fuente entrega en cada ciclo. */
export interface TelemetryBatch {
  /** Hora de la granja (en simulación puede ir acelerada respecto al reloj real). */
  timestamp: Timestamp;
  readings: SensorReading[];
  sensorStatus: SensorStatus[];
  actuators: ActuatorState[];
}

export type TelemetryListener = (batch: TelemetryBatch) => void;
export type Unsubscribe = () => void;

export type TelemetrySourceKind = 'simulation' | 'mqtt' | 'cloud';

/**
 * Frontera entre la app y el mundo físico.
 *
 * Implementaciones:
 *  - SimulatedSource (MVP)
 *  - MqttSource      (futuro: broker MQTT ↔ ESP32)
 *  - CloudSource     (futuro: Supabase/Firebase en tiempo real)
 *
 * Nada fuera de `services/telemetry` debe saber qué implementación se usa.
 */
export interface TelemetrySource {
  readonly kind: TelemetrySourceKind;
  start(): Promise<void>;
  stop(): void;
  subscribe(listener: TelemetryListener): Unsubscribe;
  sendCommand(command: ActuatorCommand): Promise<void>;
}

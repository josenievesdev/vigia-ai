import type { SpeciesProfile } from '@/domain/profiles';
import type {
  Actuator,
  ActuatorCommand,
  ActuatorKind,
  ActuatorMode,
  AlertType,
  Decision,
  Sensor,
  SensorKind,
  Severity,
  Timestamp,
  Zone,
} from '@/domain/types';

/** Vista de una zona que reciben las reglas. Solo datos, sin dependencias de UI. */
export interface ZoneContext {
  now: Timestamp;
  hour: number;
  isPhotoperiod: boolean;
  zone: Zone;
  profile: SpeciesProfile;
  /** Últimos valores de sensores EN LÍNEA. Un sensor caído no aporta valor. */
  readings: Partial<Record<SensorKind, number>>;
  sensors: { sensor: Sensor; online: boolean; lastSeenAt: Timestamp | null }[];
  actuators: Partial<Record<ActuatorKind, { actuator: Actuator; active: boolean; mode: ActuatorMode }>>;
  // Futuro: vision?: VisionInsights (ver domain/vision/types.ts)
}

export interface CommandIntent {
  actuator: ActuatorKind;
  active: boolean;
  summary: string;
  reason: string;
  inputs: Partial<Record<SensorKind, number>>;
}

export interface AlertSignal {
  type: AlertType;
  severity: Severity;
  sensorId?: string;
  title: string;
  message: string;
}

export interface RuleOutcome {
  commands?: CommandIntent[];
  alerts?: AlertSignal[];
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  evaluate(ctx: ZoneContext): RuleOutcome;
}

/** Señal de alerta ya asociada a su zona y clave de deduplicación. */
export interface KeyedAlertSignal extends AlertSignal {
  key: string;
  zoneId: string;
}

export interface EngineResult {
  commands: ActuatorCommand[];
  decisions: Decision[];
  alertSignals: KeyedAlertSignal[];
}

/**
 * Contrato del "cerebro" de la granja. La v1 es un motor de reglas
 * determinista; una futura implementación con IA podrá envolverlo o
 * reemplazarlo sin cambios en el resto de la app.
 */
export interface DecisionEngine {
  evaluate(zones: ZoneContext[]): EngineResult;
}

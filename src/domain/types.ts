/**
 * Modelo de dominio de VigíaAI.
 *
 * Este archivo es TypeScript puro (sin React ni Expo) para que pueda
 * compartirse con un backend, un worker o el firmware-gateway en el futuro.
 */

export type Timestamp = number; // epoch ms

// ---------------------------------------------------------------------------
// Granja
// ---------------------------------------------------------------------------

/** Identificador del perfil productivo. Se amplía al agregar especies o cultivos. */
export type SpeciesId = 'layingHens';

export interface Farm {
  id: string;
  name: string;
  speciesId: SpeciesId;
  location?: string;
  zones: Zone[];
}

/** Unidad física monitoreada: galpón, corral, invernadero… */
export interface Zone {
  id: string;
  farmId: string;
  name: string;
  /** Número de animales alojados (o plantas, en cultivos). */
  population: number;
}

// ---------------------------------------------------------------------------
// Dispositivos IoT
// ---------------------------------------------------------------------------

export type SensorKind =
  | 'temperature'
  | 'humidity'
  | 'light'
  | 'waterLevel'
  | 'feedLevel'
  | 'animalActivity';

export type ActuatorKind = 'ventilation' | 'feeder' | 'waterPump' | 'lighting';

/** Automático: lo controla el motor de decisiones. Manual: lo controla el usuario. */
export type ActuatorMode = 'auto' | 'manual';

export interface Sensor {
  id: string;
  /** Nodo físico (p. ej. ESP32) que publica la lectura. Se usa para los tópicos MQTT. */
  deviceId: string;
  zoneId: string;
  kind: SensorKind;
  label: string;
  unit: string;
}

export interface Actuator {
  id: string;
  deviceId: string;
  zoneId: string;
  kind: ActuatorKind;
  label: string;
}

export interface SensorReading {
  sensorId: string;
  value: number;
  timestamp: Timestamp;
}

/** Estado reportado por el dispositivo (fuente de verdad: el hardware). */
export interface SensorStatus {
  sensorId: string;
  online: boolean;
  lastSeenAt: Timestamp | null;
}

export interface ActuatorState {
  actuatorId: string;
  active: boolean;
  changedAt: Timestamp;
}

export interface ActuatorCommand {
  actuatorId: string;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Alertas
// ---------------------------------------------------------------------------

export type Severity = 'info' | 'warning' | 'critical';
export type HealthStatus = 'normal' | 'warning' | 'critical';

export type AlertType =
  | 'highTemperature'
  | 'lowTemperature'
  | 'highHumidity'
  | 'lowWater'
  | 'lowFeed'
  | 'lowActivity'
  | 'sensorOffline'
  // Reservado para la futura capa de visión artificial.
  | 'abnormalBehavior';

export interface Alert {
  id: string;
  /** Clave de deduplicación: la misma condición no genera alertas repetidas. */
  key: string;
  type: AlertType;
  severity: Severity;
  zoneId: string;
  sensorId?: string;
  title: string;
  message: string;
  status: 'active' | 'resolved';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** Última vez que la condición se detectó (evita que la alerta parpadee). */
  lastDetectedAt: Timestamp;
  resolvedAt?: Timestamp;
}

// ---------------------------------------------------------------------------
// Decisiones (trazabilidad de la automatización)
// ---------------------------------------------------------------------------

/** Quién originó la decisión. 'ai' queda reservado para fases futuras. */
export type DecisionSource = 'rule' | 'ai' | 'user';

export interface Decision {
  id: string;
  timestamp: Timestamp;
  source: DecisionSource;
  ruleId?: string;
  zoneId: string;
  summary: string;
  reason: string;
  /** Valores que motivaron la decisión, para auditoría. */
  inputs: Partial<Record<SensorKind, number>>;
  commands: ActuatorCommand[];
}

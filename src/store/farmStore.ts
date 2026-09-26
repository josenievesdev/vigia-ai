import { createStore } from 'zustand/vanilla';

import type { LightState } from '@/domain/lighting';
import type { FarmLocation } from '@/domain/location';
import { compareAlerts } from '@/engine/alerts/AlertManager';
import type { SpeciesProfile } from '@/domain/profiles';
import type {
  Actuator,
  ActuatorMode,
  ActuatorState,
  Alert,
  Decision,
  Farm,
  Sensor,
  SensorReading,
  SensorStatus,
  Timestamp,
} from '@/domain/types';
import type { ScenarioId } from '@/services/simulation/scenarios';
import type { SimulationClock } from '@/services/simulation/SimulatedSource';
import type { TelemetryBatch, TelemetrySourceKind } from '@/services/telemetry/TelemetrySource';
import type { OutsideConditions, WeatherStatus } from '@/services/weather/types';

const MAX_DECISIONS = 100;
const MAX_RESOLVED_ALERTS = 50;

export type ConnectionStatus = 'idle' | 'connecting' | 'live' | 'error';

export interface SimulationState {
  mode: SimulationClock;
  scenarios: ScenarioId[];
  timeScale: number;
}

/** Contexto exterior de la granja en la hora actual (clima + sol). */
export interface EnvironmentView {
  location: FarmLocation;
  outside: OutsideConditions;
  /** true si `outside` viene de datos reales (no del clima de respaldo). */
  realWeather: boolean;
  weatherStatus: WeatherStatus;
  weatherUpdatedAt: Timestamp | null;
  /** Estado de luz de la zona principal (sol real + programa de iluminación). */
  light: LightState;
}

export interface FarmState {
  farm: Farm | null;
  profile: SpeciesProfile | null;
  sensors: Sensor[];
  actuators: Actuator[];

  sourceKind: TelemetrySourceKind | null;
  connection: ConnectionStatus;
  /** Hora de la granja según la última lectura. */
  now: Timestamp | null;

  readings: Record<string, SensorReading>;
  sensorStatus: Record<string, SensorStatus>;
  actuatorStates: Record<string, ActuatorState>;
  actuatorModes: Record<string, ActuatorMode>;

  /** Activas, ordenadas por severidad y antigüedad. */
  alerts: Alert[];
  resolvedAlerts: Alert[];
  /** Más reciente primero. */
  decisions: Decision[];

  simulation: SimulationState | null;
  environment: EnvironmentView | null;
}

const initialState: FarmState = {
  farm: null,
  profile: null,
  sensors: [],
  actuators: [],
  sourceKind: null,
  connection: 'idle',
  now: null,
  readings: {},
  sensorStatus: {},
  actuatorStates: {},
  actuatorModes: {},
  alerts: [],
  resolvedAlerts: [],
  decisions: [],
  simulation: null,
  environment: null,
};

/**
 * Estado global (sin dependencia de React). Solo guarda datos y transiciones
 * simples; la orquestación (fuente → motor → comandos) vive en
 * `services/runtime/FarmRuntime`. La UI lo lee con `useFarmStore`.
 */
export const farmStore = createStore<FarmState>()(() => initialState);

// --- Transiciones (usadas por el runtime) ------------------------------------

export const farmActions = {
  reset() {
    farmStore.setState(initialState, true);
  },

  configure(input: {
    farm: Farm;
    profile: SpeciesProfile;
    sensors: Sensor[];
    actuators: Actuator[];
    sourceKind: TelemetrySourceKind;
    simulation: SimulationState | null;
  }) {
    farmStore.setState({
      ...input,
      actuatorModes: Object.fromEntries(input.actuators.map((a) => [a.id, 'auto' as const])),
    });
  },

  setConnection(connection: ConnectionStatus) {
    farmStore.setState({ connection });
  },

  ingest(batch: TelemetryBatch) {
    farmStore.setState((s) => {
      const readings = { ...s.readings };
      for (const r of batch.readings) readings[r.sensorId] = r;

      const sensorStatus = { ...s.sensorStatus };
      for (const st of batch.sensorStatus) {
        // Si el sensor cae, se conserva la última vez que se vio.
        const lastSeenAt = st.lastSeenAt ?? s.sensorStatus[st.sensorId]?.lastSeenAt ?? null;
        sensorStatus[st.sensorId] = { ...st, lastSeenAt };
      }

      const actuatorStates = { ...s.actuatorStates };
      for (const a of batch.actuators) actuatorStates[a.actuatorId] = a;

      return { now: batch.timestamp, readings, sensorStatus, actuatorStates, connection: 'live' };
    });
  },

  setAlerts(active: Alert[], resolved: Alert[]) {
    farmStore.setState((s) => ({
      alerts: [...active].sort(compareAlerts),
      resolvedAlerts: resolved.length
        ? [...resolved, ...s.resolvedAlerts].slice(0, MAX_RESOLVED_ALERTS)
        : s.resolvedAlerts,
    }));
  },

  addDecisions(decisions: Decision[]) {
    if (!decisions.length) return;
    farmStore.setState((s) => ({
      decisions: [...[...decisions].reverse(), ...s.decisions].slice(0, MAX_DECISIONS),
    }));
  },

  setActuatorMode(actuatorId: string, mode: ActuatorMode) {
    farmStore.setState((s) => ({ actuatorModes: { ...s.actuatorModes, [actuatorId]: mode } }));
  },

  setSimulation(simulation: SimulationState) {
    farmStore.setState({ simulation });
  },

  setEnvironment(environment: EnvironmentView) {
    farmStore.setState({ environment });
  },
};

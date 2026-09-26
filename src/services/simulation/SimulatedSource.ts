import { getSpeciesProfile, type SpeciesProfile } from '@/domain/profiles';
import type {
  ActuatorCommand,
  ActuatorState,
  SensorReading,
  SensorStatus,
  Timestamp,
} from '@/domain/types';
import type {
  TelemetryBatch,
  TelemetryListener,
  TelemetrySource,
  Unsubscribe,
} from '@/services/telemetry/TelemetrySource';
import { SyntheticWeather } from '@/services/weather/syntheticWeather';
import type { WeatherProvider } from '@/services/weather/types';
import { createRng, noise, type Rng } from '@/utils/random';

import type { FarmSetup } from './demoFarm';
import { defaultZoneParams } from './demoFarm';
import {
  type ActuatorFlags,
  advanceEnvironment,
  applyScenarioOnset,
  type EnvironmentState,
  initialEnvironment,
  type ZoneModelParams,
} from './environmentModel';
import type { ScenarioId } from './scenarios';

/**
 * - live: el reloj de la simulación es el reloj real (demo "en vivo").
 * - accelerated: el tiempo avanza `timeScale` veces más rápido (presentaciones).
 */
export type SimulationClock = 'live' | 'accelerated';

export interface SimulatedSourceOptions {
  setup: FarmSetup;
  clock?: SimulationClock;
  /** Clima exterior (real u otro). Por defecto, el clima sintético de respaldo. */
  weather?: WeatherProvider;
  /** Intervalo real entre lecturas, ms. */
  tickMs?: number;
  /** Solo reloj acelerado: segundos simulados por segundo real (60 = 1 min por segundo). */
  timeScale?: number;
  startTime?: Timestamp;
  seed?: number;
}

interface ZoneSim {
  params: ZoneModelParams;
  env: EnvironmentState;
}

/** Ruido de medición por tipo de sensor (independiente del estado físico). */
const SENSOR_NOISE: Record<keyof EnvironmentState, number> = {
  temperature: 0.1,
  humidity: 0.5,
  light: 3,
  waterLevel: 0.2,
  feedLevel: 0.2,
  animalActivity: 1,
};

/**
 * Fuente de telemetría simulada. Se comporta como un gateway real: publica
 * lecturas periódicas y ejecuta los comandos que recibe sobre sus actuadores,
 * que a su vez modifican el modelo físico (circuito cerrado).
 */
export class SimulatedSource implements TelemetrySource {
  readonly kind = 'simulation' as const;

  private readonly setup: FarmSetup;
  private readonly profile: SpeciesProfile;
  private readonly tickMs: number;
  private readonly rng: Rng;
  private readonly listeners = new Set<TelemetryListener>();
  private readonly zones = new Map<string, ZoneSim>();
  private readonly actuators = new Map<string, ActuatorState>();
  private readonly scenarios = new Set<ScenarioId>();
  private readonly weather: WeatherProvider;
  readonly clock: SimulationClock;
  private timer: ReturnType<typeof setInterval> | null = null;
  private time: Timestamp;
  private timeScale: number;
  /** Mientras se genera historia previa, no se emiten confirmaciones extra. */
  private priming = false;

  constructor(options: SimulatedSourceOptions) {
    this.setup = options.setup;
    this.profile = getSpeciesProfile(options.setup.farm.speciesId);
    this.clock = options.clock ?? 'accelerated';
    this.weather = options.weather ?? new SyntheticWeather(options.setup.farm.location);
    this.tickMs = options.tickMs ?? 1000;
    this.timeScale = this.clock === 'live' ? 1 : (options.timeScale ?? 60);
    this.time = options.startTime ?? Date.now();
    this.rng = createRng(options.seed ?? Date.now());

    for (const zone of this.setup.farm.zones) {
      this.zones.set(zone.id, { params: defaultZoneParams(zone.population), env: { ...initialEnvironment } });
    }
    for (const a of this.setup.actuators) {
      this.actuators.set(a.id, { actuatorId: a.id, active: false, changedAt: this.time });
    }
  }

  // --- TelemetrySource -----------------------------------------------------

  async start(): Promise<void> {
    if (this.timer) return;
    this.emit();
    this.timer = setInterval(() => {
      if (this.clock === 'live') {
        // En vivo, la simulación sigue al reloj real (sin deriva por el temporizador).
        const behind = (Date.now() - this.time) / 1000;
        if (behind > 0) this.advance(behind);
      } else {
        this.advance((this.tickMs / 1000) * this.timeScale);
      }
    }, this.tickMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  subscribe(listener: TelemetryListener): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async sendCommand(command: ActuatorCommand): Promise<void> {
    const current = this.actuators.get(command.actuatorId);
    if (!current) throw new Error(`Actuador desconocido: ${command.actuatorId}`);
    if (current.active === command.active) return;
    this.actuators.set(command.actuatorId, { ...current, active: command.active, changedAt: this.time });
    // Como un dispositivo real, confirma el nuevo estado sin esperar al siguiente ciclo.
    if (!this.priming) queueMicrotask(() => this.emit());
  }

  // --- Historia previa --------------------------------------------------------

  /**
   * Genera `seconds` de historia anterior al instante actual: retrocede el
   * reloj y simula hasta volver a él, publicando cada paso. Así la app arranca
   * con gráficas y registros de un día completo. Solo antes de `start()`.
   */
  prime(seconds: number, stepSeconds = 60): void {
    if (this.timer) throw new Error('prime() debe llamarse antes de start()');
    const end = this.time;
    this.time = end - seconds * 1000;
    for (const [id, state] of this.actuators) this.actuators.set(id, { ...state, changedAt: this.time });
    this.priming = true;
    try {
      while (this.time < end) this.advance(Math.min(stepSeconds, (end - this.time) / 1000));
    } finally {
      this.priming = false;
    }
  }

  // --- Controles del modo demo --------------------------------------------

  setScenario(id: ScenarioId, enabled: boolean): void {
    if (enabled && !this.scenarios.has(id)) {
      this.scenarios.add(id);
      for (const zone of this.zones.values()) zone.env = applyScenarioOnset(zone.env, id);
    } else if (!enabled) {
      this.scenarios.delete(id);
    }
    this.emit();
  }

  get activeScenarios(): ReadonlySet<ScenarioId> {
    return this.scenarios;
  }

  /** Solo en reloj acelerado; en vivo el tiempo es siempre el real. */
  setTimeScale(timeScale: number): void {
    if (this.clock === 'accelerated') this.timeScale = timeScale;
  }

  getTimeScale(): number {
    return this.timeScale;
  }

  /** Avanza la simulación `seconds` simulados y publica un lote. Público para pruebas. */
  advance(seconds: number): void {
    for (const [zoneId, zone] of this.zones) {
      zone.env = advanceEnvironment(
        zone.env,
        this.time,
        seconds,
        this.actuatorFlags(zoneId),
        this.scenarios,
        this.profile,
        zone.params,
        this.weather,
        this.rng,
      );
    }
    this.time += seconds * 1000;
    this.emit();
  }

  // --- Internos ------------------------------------------------------------

  private actuatorFlags(zoneId: string): ActuatorFlags {
    const flags: ActuatorFlags = { ventilation: false, feeder: false, waterPump: false, lighting: false };
    for (const a of this.setup.actuators) {
      if (a.zoneId === zoneId) flags[a.kind] = this.actuators.get(a.id)?.active ?? false;
    }
    return flags;
  }

  private isSensorOffline(kind: string): boolean {
    return this.scenarios.has('sensorFailure') && kind === 'temperature';
  }

  private emit(): void {
    const readings: SensorReading[] = [];
    const sensorStatus: SensorStatus[] = [];

    for (const sensor of this.setup.sensors) {
      const zone = this.zones.get(sensor.zoneId);
      if (!zone) continue;
      if (this.isSensorOffline(sensor.kind)) {
        sensorStatus.push({ sensorId: sensor.id, online: false, lastSeenAt: null });
        continue;
      }
      const raw = zone.env[sensor.kind] + noise(this.rng, SENSOR_NOISE[sensor.kind]);
      const value = sensor.unit === '%' || sensor.kind === 'animalActivity' ? Math.min(100, Math.max(0, raw)) : Math.max(0, raw);
      readings.push({ sensorId: sensor.id, value, timestamp: this.time });
      sensorStatus.push({ sensorId: sensor.id, online: true, lastSeenAt: this.time });
    }

    const batch: TelemetryBatch = {
      timestamp: this.time,
      readings,
      sensorStatus,
      actuators: [...this.actuators.values()],
    };
    for (const listener of this.listeners) listener(batch);
  }
}

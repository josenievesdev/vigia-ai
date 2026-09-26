import { lightState, NATURAL_LIGHT } from '@/domain/lighting';
import { getSpeciesProfile } from '@/domain/profiles';
import type { Decision } from '@/domain/types';
import { reconcileAlerts } from '@/engine/alerts/AlertManager';
import { buildZoneContexts } from '@/engine/context';
import type { DecisionEngine } from '@/engine/types';
import type { HistoryRepository } from '@/services/history/HistoryRepository';
import { InMemoryHistory } from '@/services/history/InMemoryHistory';
import type { FarmSetup } from '@/services/simulation/demoFarm';
import type { ScenarioId } from '@/services/simulation/scenarios';
import { SimulatedSource } from '@/services/simulation/SimulatedSource';
import type { TelemetryBatch, TelemetrySource, Unsubscribe } from '@/services/telemetry/TelemetrySource';
import { SyntheticWeather } from '@/services/weather/syntheticWeather';
import type { WeatherProvider } from '@/services/weather/types';
import type { WeatherService } from '@/services/weather/WeatherService';
import { farmActions, farmStore } from '@/store/farmStore';
import { createId } from '@/utils/id';

/**
 * Orquestador: conecta la fuente de telemetría, el motor de decisiones y el
 * store. No depende de React, por lo que puede moverse a un servicio en
 * segundo plano o a un backend sin cambios.
 *
 *   clima real ─┐
 *   fuente ──lecturas──► historial + store ──contexto──► motor ──comandos──► fuente
 *                                          └──► alertas + decisiones ──► store
 */
export interface FarmRuntimeOptions {
  history?: HistoryRepository;
  /** Solo simulación: segundos de historia previa a generar al arrancar. */
  primeSeconds?: number;
  /** Clima exterior real. Sin él se usa el clima sintético de respaldo. */
  weather?: WeatherService;
}

/** Cada cuánto se refresca el clima real (Open-Meteo actualiza cada 15 min). */
const WEATHER_REFRESH_MS = 15 * 60_000;

export class FarmRuntime {
  readonly history: HistoryRepository;
  private unsubscribe: Unsubscribe | null = null;
  private primed = false;
  private running = false;
  /** Invalida arranques en curso si se llama a stop() mientras se espera el clima. */
  private generation = 0;
  private weatherTimer: ReturnType<typeof setInterval> | null = null;
  private readonly outside: WeatherProvider;

  constructor(
    private readonly source: TelemetrySource,
    private readonly engine: DecisionEngine,
    private readonly setup: FarmSetup,
    private readonly options: FarmRuntimeOptions = {},
  ) {
    this.history = options.history ?? new InMemoryHistory();
    this.outside = options.weather ?? new SyntheticWeather(setup.farm.location);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const generation = ++this.generation;
    const sim = this.simulation;
    farmActions.configure({
      farm: this.setup.farm,
      profile: getSpeciesProfile(this.setup.farm.speciesId),
      sensors: this.setup.sensors,
      actuators: this.setup.actuators,
      sourceKind: this.source.kind,
      simulation: sim ? { mode: sim.clock, scenarios: [...sim.activeScenarios], timeScale: sim.getTimeScale() } : null,
    });
    farmActions.setConnection('connecting');

    // El clima real se descarga antes de generar la historia previa (así usa las últimas 24 h reales).
    const { weather } = this.options;
    if (weather) {
      await weather.refresh();
      if (generation !== this.generation) return;
      this.weatherTimer = setInterval(() => void weather.refresh(), WEATHER_REFRESH_MS);
    }

    this.unsubscribe = this.source.subscribe((batch) => this.handleBatch(batch));
    if (sim && this.options.primeSeconds && !this.primed) {
      sim.prime(this.options.primeSeconds);
      this.primed = true;
    }
    try {
      await this.source.start();
    } catch (error) {
      farmActions.setConnection('error');
      throw error;
    }
  }

  stop(): void {
    this.generation++;
    this.running = false;
    if (this.weatherTimer) clearInterval(this.weatherTimer);
    this.weatherTimer = null;
    this.source.stop();
    this.unsubscribe?.();
    this.unsubscribe = null;
    farmActions.setConnection('idle');
  }

  // --- Control manual ------------------------------------------------------

  async setManual(actuatorId: string, active: boolean): Promise<void> {
    if (!this.running) return;
    const actuator = this.setup.actuators.find((a) => a.id === actuatorId);
    if (!actuator) return;
    farmActions.setActuatorMode(actuatorId, 'manual');
    await this.source.sendCommand({ actuatorId, active });
    this.logUserDecision(
      actuator.zoneId,
      `${actuator.label}: ${active ? 'encendido' : 'apagado'} manual`,
      'Acción del usuario desde la app. La automatización queda en pausa para este equipo.',
      [{ actuatorId, active }],
    );
  }

  setAuto(actuatorId: string): void {
    if (!this.running) return;
    const actuator = this.setup.actuators.find((a) => a.id === actuatorId);
    if (!actuator) return;
    farmActions.setActuatorMode(actuatorId, 'auto');
    this.logUserDecision(
      actuator.zoneId,
      `${actuator.label}: modo automático`,
      'El usuario devolvió el control al motor de reglas.',
      [],
    );
  }

  // --- Modo demo -----------------------------------------------------------

  get simulation(): SimulatedSource | null {
    return this.source instanceof SimulatedSource ? this.source : null;
  }

  setScenario(id: ScenarioId, enabled: boolean): void {
    const sim = this.simulation;
    if (!sim || !this.running) return;
    sim.setScenario(id, enabled);
    farmActions.setSimulation({ mode: sim.clock, scenarios: [...sim.activeScenarios], timeScale: sim.getTimeScale() });
  }

  clearScenarios(): void {
    const sim = this.simulation;
    if (!sim || !this.running) return;
    for (const id of [...sim.activeScenarios]) sim.setScenario(id, false);
    farmActions.setSimulation({ mode: sim.clock, scenarios: [], timeScale: sim.getTimeScale() });
  }

  setTimeScale(timeScale: number): void {
    const sim = this.simulation;
    if (!sim || !this.running) return;
    sim.setTimeScale(timeScale);
    farmActions.setSimulation({ mode: sim.clock, scenarios: [...sim.activeScenarios], timeScale: sim.getTimeScale() });
  }

  // --- Ciclo principal -----------------------------------------------------

  private handleBatch(batch: TelemetryBatch): void {
    this.history.append(batch);
    farmActions.ingest(batch);
    this.publishEnvironment(batch.timestamp);
    const s = farmStore.getState();
    if (!s.farm || !s.profile) return;

    const contexts = buildZoneContexts({
      now: batch.timestamp,
      farm: s.farm,
      profile: s.profile,
      sensors: s.sensors,
      actuators: s.actuators,
      readings: s.readings,
      sensorStatus: s.sensorStatus,
      actuatorStates: s.actuatorStates,
      actuatorModes: s.actuatorModes,
    });
    const result = this.engine.evaluate(contexts);

    const { active, resolved } = reconcileAlerts(s.alerts, result.alertSignals, batch.timestamp);
    farmActions.setAlerts(active, resolved);
    farmActions.addDecisions(result.decisions);

    for (const command of result.commands) {
      this.source.sendCommand(command).catch((error) => {
        console.warn('[VigíaAI] No se pudo enviar el comando', command, error);
      });
    }
  }

  /** Clima exterior y sol en la hora actual de la granja, para la UI. */
  private publishEnvironment(now: number): void {
    const { weather } = this.options;
    const { location, zones } = this.setup.farm;
    farmActions.setEnvironment({
      location,
      outside: this.outside.conditionsAt(now),
      realWeather: weather ? weather.hasRealDataAt(now) : false,
      weatherStatus: weather ? weather.getStatus() : 'synthetic',
      weatherUpdatedAt: weather?.getUpdatedAt() ?? null,
      light: lightState(now, location, zones[0]?.lighting ?? NATURAL_LIGHT),
    });
  }

  private logUserDecision(zoneId: string, summary: string, reason: string, commands: Decision['commands']) {
    farmActions.addDecisions([
      {
        id: createId('dec'),
        timestamp: farmStore.getState().now ?? Date.now(),
        source: 'user',
        zoneId,
        summary,
        reason,
        inputs: {},
        commands,
      },
    ]);
  }
}

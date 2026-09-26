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
import { farmActions, farmStore } from '@/store/farmStore';
import { createId } from '@/utils/id';

/**
 * Orquestador: conecta la fuente de telemetría, el motor de decisiones y el
 * store. No depende de React, por lo que puede moverse a un servicio en
 * segundo plano o a un backend sin cambios.
 *
 *   fuente ──lecturas──► historial + store ──contexto──► motor ──comandos──► fuente
 *                                          └──► alertas + decisiones ──► store
 */
export interface FarmRuntimeOptions {
  history?: HistoryRepository;
  /** Solo simulación: segundos de historia previa a generar al arrancar. */
  primeSeconds?: number;
}

export class FarmRuntime {
  readonly history: HistoryRepository;
  private unsubscribe: Unsubscribe | null = null;
  private primed = false;

  constructor(
    private readonly source: TelemetrySource,
    private readonly engine: DecisionEngine,
    private readonly setup: FarmSetup,
    private readonly options: FarmRuntimeOptions = {},
  ) {
    this.history = options.history ?? new InMemoryHistory();
  }

  async start(): Promise<void> {
    if (this.unsubscribe) return;
    const sim = this.simulation;
    farmActions.configure({
      farm: this.setup.farm,
      profile: getSpeciesProfile(this.setup.farm.speciesId),
      sensors: this.setup.sensors,
      actuators: this.setup.actuators,
      sourceKind: this.source.kind,
      simulation: sim ? { scenarios: [...sim.activeScenarios], timeScale: sim.getTimeScale() } : null,
    });
    farmActions.setConnection('connecting');
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
    this.source.stop();
    this.unsubscribe?.();
    this.unsubscribe = null;
    farmActions.setConnection('idle');
  }

  // --- Control manual ------------------------------------------------------

  async setManual(actuatorId: string, active: boolean): Promise<void> {
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
    if (!sim) return;
    sim.setScenario(id, enabled);
    farmActions.setSimulation({ scenarios: [...sim.activeScenarios], timeScale: sim.getTimeScale() });
  }

  clearScenarios(): void {
    const sim = this.simulation;
    if (!sim) return;
    for (const id of [...sim.activeScenarios]) sim.setScenario(id, false);
    farmActions.setSimulation({ scenarios: [], timeScale: sim.getTimeScale() });
  }

  setTimeScale(timeScale: number): void {
    const sim = this.simulation;
    if (!sim) return;
    sim.setTimeScale(timeScale);
    farmActions.setSimulation({ scenarios: [...sim.activeScenarios], timeScale });
  }

  // --- Ciclo principal -----------------------------------------------------

  private handleBatch(batch: TelemetryBatch): void {
    this.history.append(batch);
    farmActions.ingest(batch);
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

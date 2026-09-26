import { RuleEngine } from '@/engine/RuleEngine';
import type { HistoryRepository } from '@/services/history/HistoryRepository';
import { InMemoryHistory } from '@/services/history/InMemoryHistory';
import { demoFarmSetup } from '@/services/simulation/demoFarm';
import { type SimulationClock, SimulatedSource } from '@/services/simulation/SimulatedSource';
import { WeatherService } from '@/services/weather/WeatherService';
import { farmActions } from '@/store/farmStore';

import { FarmRuntime } from './FarmRuntime';

export { FarmRuntime } from './FarmRuntime';

let mode: SimulationClock = 'live';
let runtime: FarmRuntime | null = null;

/** Clima real de la granja. Se comparte entre reinicios para conservar lo descargado. */
const weather = new WeatherService(demoFarmSetup.farm.location);
/**
 * Historial único (se limpia al reiniciar). Al ser siempre el mismo objeto, la UI
 * puede guardarlo sin riesgo aunque el runtime cambie.
 */
const history = new InMemoryHistory();

/**
 * Punto único donde se elige la fuente de datos. Para conectar hardware real
 * bastará con cambiar `SimulatedSource` por `MqttSource` (y la configuración
 * de la granja por la que venga del backend). El clima real se mantiene.
 */
function createRuntime(clock: SimulationClock): FarmRuntime {
  const source = new SimulatedSource({ setup: demoFarmSetup, clock, weather });
  return new FarmRuntime(source, new RuleEngine(), demoFarmSetup, {
    // Arranca con un día completo de historia, simulada con el clima real de ayer.
    primeSeconds: 24 * 3600,
    weather,
    history,
  });
}

export function getFarmHistory(): HistoryRepository {
  return history;
}

/**
 * Runtime vigente. IMPORTANTE: llamarlo dentro de manejadores de eventos, no
 * durante el render (el compilador de React memoriza las llamadas del render y
 * quedaría apuntando al runtime anterior tras un cambio de modo).
 */
export function getFarmRuntime(): FarmRuntime {
  if (!runtime) runtime = createRuntime(mode);
  return runtime;
}

/**
 * Cambia entre simulación en vivo (hora y clima reales) y acelerada (demos).
 * Reinicia la simulación: el historial y los registros se regeneran.
 */
export async function setSimulationMode(next: SimulationClock): Promise<void> {
  if (runtime && next === mode) return;
  runtime?.stop();
  mode = next;
  history.clear();
  farmActions.reset();
  runtime = createRuntime(next);
  await runtime.start();
}

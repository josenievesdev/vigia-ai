import type { FarmLocation } from '@/domain/location';
import { getSpeciesProfile } from '@/domain/profiles';
import { RuleEngine } from '@/engine/RuleEngine';
import { loadConfig, saveConfig } from '@/services/config/configStorage';
import {
  defaultConfig,
  type FarmConfig,
  profileWithThresholds,
  setupFromConfig,
  validateConfig,
} from '@/services/config/farmConfig';
import type { HistoryRepository } from '@/services/history/HistoryRepository';
import { InMemoryHistory } from '@/services/history/InMemoryHistory';
import { ProductionService } from '@/services/production/ProductionService';
import { demoFarmSetup } from '@/services/simulation/demoFarm';
import { type SimulationClock, SimulatedSource } from '@/services/simulation/SimulatedSource';
import { WeatherService } from '@/services/weather/WeatherService';
import { farmActions } from '@/store/farmStore';

import { FarmRuntime } from './FarmRuntime';

export { FarmRuntime } from './FarmRuntime';

const baseProfile = getSpeciesProfile(demoFarmSetup.farm.speciesId);

/** Dónde vive la configuración de la granja: en el teléfono (demo) o en Supabase (granja real). */
export interface ConfigStore {
  load(): Promise<FarmConfig>;
  save(config: FarmConfig): Promise<void>;
}

/** Configuración guardada en el teléfono: la del modo demo. */
export const localConfigStore: ConfigStore = {
  load: () => loadConfig(baseProfile),
  save: saveConfig,
};

let mode: SimulationClock = 'live';
let runtime: FarmRuntime | null = null;
let config: FarmConfig = defaultConfig(baseProfile);
let store: ConfigStore = localConfigStore;
/** Invalida arranques en curso si llega otra orden (cerrar sesión, cambiar de granja). */
let generation = 0;

/**
 * Historial único (se limpia al reiniciar). Al ser siempre el mismo objeto, la UI
 * puede guardarlo sin riesgo aunque el runtime cambie.
 */
const history = new InMemoryHistory();

/** Clima por ubicación: se conserva lo descargado entre reinicios. */
let weather: WeatherService | null = null;
function weatherFor(location: FarmLocation): WeatherService {
  if (!weather || weather.location.latitude !== location.latitude || weather.location.longitude !== location.longitude) {
    weather = new WeatherService(location);
  }
  return weather;
}

/**
 * Punto único donde se arma la granja. Para conectar hardware real bastará
 * con cambiar `SimulatedSource` por `MqttSource`; el clima real se mantiene.
 */
function createRuntime(clock: SimulationClock): FarmRuntime {
  const setup = setupFromConfig(config);
  const profile = profileWithThresholds(baseProfile, config.thresholds);
  const outside = weatherFor(config.location);
  const source = new SimulatedSource({ setup, clock, weather: outside });
  return new FarmRuntime(source, new RuleEngine(), setup, {
    // Arranca con un día completo de historia, simulada con el clima real de ayer.
    primeSeconds: 24 * 3600,
    weather: outside,
    history,
    profile,
    production: new ProductionService({ setup, profile, weather: outside }),
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

async function restart(): Promise<void> {
  runtime?.stop();
  history.clear();
  farmActions.reset();
  farmActions.setConfig(config);
  runtime = createRuntime(mode);
  await runtime.start();
}

/** Pone en marcha la granja con la configuración de `source` (por defecto, la del teléfono). */
export async function startFarm(source: ConfigStore = localConfigStore): Promise<void> {
  const current = ++generation;
  const next = await source.load();
  if (current !== generation) return;
  store = source;
  config = next;
  await restart();
}

/** Detiene la simulación (al cerrar sesión o si la cuenta queda bloqueada). */
export function stopFarm(): void {
  generation++;
  runtime?.stop();
  runtime = null;
  history.clear();
  farmActions.reset();
}

/**
 * Cambia entre simulación en vivo (hora y clima reales) y acelerada (demos).
 * Reinicia la simulación: el historial y los registros se regeneran.
 */
export async function setSimulationMode(next: SimulationClock): Promise<void> {
  if (runtime && next === mode) return;
  mode = next;
  await restart();
}

/** Guarda (en el teléfono o en Supabase) y aplica una configuración nueva: reinicia la simulación. */
export async function applyFarmConfig(next: FarmConfig): Promise<void> {
  const errors = validateConfig(next);
  if (errors.length) throw new Error(errors.join(' '));
  await store.save(next);
  config = next;
  await restart();
}

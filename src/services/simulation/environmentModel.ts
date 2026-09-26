import type { SpeciesProfile } from '@/domain/profiles';
import type { ActuatorKind, Timestamp } from '@/domain/types';
import type { OutsideConditions, WeatherProvider } from '@/services/weather/types';
import { noise, type Rng } from '@/utils/random';

import type { ScenarioId } from './scenarios';

/**
 * Modelo físico simplificado de un galpón abierto. Funciones puras: dado un
 * estado, el clima exterior (real o sintético), los actuadores y los escenarios
 * activos, calcula el estado siguiente del interior.
 */

export interface EnvironmentState {
  temperature: number; // °C
  humidity: number; // %
  light: number; // lux
  waterLevel: number; // % del tanque
  feedLevel: number; // % de la tolva
  animalActivity: number; // índice 0–100
}

export type ActuatorFlags = Record<ActuatorKind, boolean>;

export interface ZoneModelParams {
  population: number;
  tankLiters: number;
  hopperKg: number;
  /** Caudal de reposición de la bomba, L/h. */
  pumpLitersPerHour: number;
  /** Caudal de reposición del alimentador, kg/h. */
  feederKgPerHour: number;
}

export const initialEnvironment: EnvironmentState = {
  temperature: 23,
  humidity: 62,
  light: 180,
  waterLevel: 85,
  feedLevel: 60,
  animalActivity: 65,
};

/** Paso máximo de integración para mantener estable el modelo. */
const MAX_STEP_SECONDS = 30;
/** Calentamiento del interior por el sol sobre el techo, °C a 1000 W/m². */
export const SOLAR_GAIN = 2.5;
/** Enfriamiento de la ventilación forzada, °C. */
export const VENTILATION_COOLING = 5;
/** Escenario demo "ola de calor": grados extra sobre el clima exterior. */
const HEAT_WAVE_EXTRA = 11;
/** Iluminancia interior por W/m² de radiación exterior (galpón abierto y techado). */
const LUX_PER_WM2 = 1.2;
const LAMP_LUX = 60;
/** Por debajo de esta iluminancia las aves se comportan como de noche. */
const DARK_LUX = 20;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Aproximación de primer orden: `current` tiende a `target` con constante de tiempo `tau`. */
const approach = (current: number, target: number, dt: number, tau: number) =>
  current + (target - current) * (1 - Math.exp(-dt / tau));

function step(
  s: EnvironmentState,
  dt: number,
  outside: OutsideConditions,
  actuators: ActuatorFlags,
  scenarios: ReadonlySet<ScenarioId>,
  profile: SpeciesProfile,
  params: ZoneModelParams,
  rng: Rng,
): EnvironmentState {
  const activityFactor = s.animalActivity / 100;
  const outsideTemp = outside.temperature + (scenarios.has('heatWave') ? HEAT_WAVE_EXTRA : 0);

  // Temperatura: exterior + calor de las aves + sol en el techo − ventilación.
  const animalHeat = 1 + 2.5 * activityFactor;
  const solarGain = (Math.max(0, outside.radiation) / 1000) * SOLAR_GAIN;
  const cooling = actuators.ventilation ? VENTILATION_COOLING : 0;
  const tempTarget = outsideTemp + animalHeat + solarGain - cooling;
  const temperature = approach(s.temperature, tempTarget, dt, 20 * 60) + noise(rng, 0.02);

  // Humedad: la del exterior, corregida por la diferencia de temperatura (aire más
  // caliente = menor humedad relativa) más la respiración de las aves.
  const humidityTarget =
    outside.humidity * Math.exp(-0.06 * (temperature - outsideTemp)) + (actuators.ventilation ? 1 : 4);
  const humidity = clamp(approach(s.humidity, humidityTarget, dt, 30 * 60) + noise(rng, 0.05), 15, 98);

  // Luz: radiación solar real + lámparas.
  const light = Math.max(0, outside.radiation) * LUX_PER_WM2 + (actuators.lighting ? LAMP_LUX : 0);
  const lit = light > DARK_LUX;

  // Actividad: depende de luz, estrés térmico y disponibilidad de agua/alimento.
  let activityTarget = lit ? 75 : 12;
  if (temperature > 28) activityTarget -= (temperature - 28) * 6;
  if (s.waterLevel < 10) activityTarget -= 25;
  if (s.feedLevel < 10) activityTarget -= 15;
  if (scenarios.has('lowActivity')) activityTarget *= 0.3;
  const animalActivity = clamp(
    approach(s.animalActivity, activityTarget, dt, 15 * 60) + noise(rng, 0.3),
    0,
    100,
  );

  // Agua: más consumo con calor y actividad.
  const heatWaterFactor = 1 + Math.max(0, temperature - 24) * 0.08;
  const waterUseLps =
    ((params.population * profile.consumption.waterLitersPerDay) / 86400) *
    heatWaterFactor *
    (0.4 + 0.6 * activityFactor) *
    2; // el consumo se concentra en el día
  const pumpLps = actuators.waterPump && !scenarios.has('waterOutage') ? params.pumpLitersPerHour / 3600 : 0;
  const waterLevel = clamp(s.waterLevel + ((pumpLps - waterUseLps) * dt * 100) / params.tankLiters, 0, 100);

  // Alimento: se consume durante el periodo de luz.
  const feedUseKps = lit
    ? ((params.population * profile.consumption.feedKgPerDay) / (12 * 3600)) * (0.5 + 0.5 * activityFactor)
    : 0;
  const feederKps = actuators.feeder && !scenarios.has('feedShortage') ? params.feederKgPerHour / 3600 : 0;
  const feedLevel = clamp(s.feedLevel + ((feederKps - feedUseKps) * dt * 100) / params.hopperKg, 0, 100);

  return { temperature, humidity, light, waterLevel, feedLevel, animalActivity };
}

/** Avanza el modelo `dtSeconds`, subdividiendo en pasos pequeños con el clima de cada instante. */
export function advanceEnvironment(
  state: EnvironmentState,
  startTime: Timestamp,
  dtSeconds: number,
  actuators: ActuatorFlags,
  scenarios: ReadonlySet<ScenarioId>,
  profile: SpeciesProfile,
  params: ZoneModelParams,
  weather: WeatherProvider,
  rng: Rng,
): EnvironmentState {
  let s = state;
  let elapsed = 0;
  while (elapsed < dtSeconds) {
    const dt = Math.min(MAX_STEP_SECONDS, dtSeconds - elapsed);
    const outside = weather.conditionsAt(startTime + elapsed * 1000);
    s = step(s, dt, outside, actuators, scenarios, profile, params, rng);
    elapsed += dt;
  }
  return s;
}

/** Efecto inmediato al activar un escenario (para que la demo se note en segundos). */
export function applyScenarioOnset(state: EnvironmentState, scenario: ScenarioId): EnvironmentState {
  switch (scenario) {
    case 'waterOutage':
      return { ...state, waterLevel: Math.min(state.waterLevel, 24) };
    case 'feedShortage':
      return { ...state, feedLevel: Math.min(state.feedLevel, 24) };
    default:
      return state;
  }
}

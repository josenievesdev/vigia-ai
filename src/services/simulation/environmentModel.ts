import type { SpeciesProfile } from '@/domain/profiles';
import { hourOfDay } from '@/domain/time';
import type { ActuatorKind, Timestamp } from '@/domain/types';

import { noise, type Rng } from './random';
import type { ScenarioId } from './scenarios';

/**
 * Modelo físico simplificado de un galpón. Funciones puras: dado un estado,
 * los actuadores y los escenarios activos, calcula el estado siguiente.
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

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Aproximación de primer orden: `current` tiende a `target` con constante de tiempo `tau`. */
const approach = (current: number, target: number, dt: number, tau: number) =>
  current + (target - current) * (1 - Math.exp(-dt / tau));

/** Temperatura exterior: ciclo diario con mínimo ~3 a. m. y máximo ~3 p. m. */
export function outsideTemperature(hour: number, scenarios: ReadonlySet<ScenarioId>): number {
  const base = 22 + 6 * Math.sin((2 * Math.PI * (hour - 9)) / 24);
  return base + (scenarios.has('heatWave') ? 11 : 0);
}

function daylight(hour: number): number {
  return Math.max(0, Math.sin((Math.PI * (hour - 6)) / 12)) * 250;
}

function step(
  s: EnvironmentState,
  time: Timestamp,
  dt: number,
  actuators: ActuatorFlags,
  scenarios: ReadonlySet<ScenarioId>,
  profile: SpeciesProfile,
  params: ZoneModelParams,
  rng: Rng,
): EnvironmentState {
  const hour = hourOfDay(time);
  const activityFactor = s.animalActivity / 100;

  // Temperatura: exterior + calor animal − ventilación.
  const animalHeat = 1 + 2.5 * activityFactor;
  const cooling = actuators.ventilation ? 5 : 0;
  const tempTarget = outsideTemperature(hour, scenarios) + animalHeat - cooling;
  const temperature = approach(s.temperature, tempTarget, dt, 20 * 60) + noise(rng, 0.02);

  // Humedad: baja con el calor y con la renovación de aire.
  const humidityTarget = 66 - (temperature - 22) * 1.5 - (actuators.ventilation ? 8 : 0);
  const humidity = clamp(approach(s.humidity, humidityTarget, dt, 30 * 60) + noise(rng, 0.05), 15, 98);

  // Luz: natural + artificial.
  const light = daylight(hour) + (actuators.lighting ? 120 : 0);
  const lit = light > 60;

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
    ? ((params.population * profile.consumption.feedKgPerDay) / (16 * 3600)) * (0.5 + 0.5 * activityFactor)
    : 0;
  const feederKps = actuators.feeder && !scenarios.has('feedShortage') ? params.feederKgPerHour / 3600 : 0;
  const feedLevel = clamp(s.feedLevel + ((feederKps - feedUseKps) * dt * 100) / params.hopperKg, 0, 100);

  return { temperature, humidity, light, waterLevel, feedLevel, animalActivity };
}

/** Avanza el modelo `dtSeconds`, subdividiendo en pasos pequeños. */
export function advanceEnvironment(
  state: EnvironmentState,
  startTime: Timestamp,
  dtSeconds: number,
  actuators: ActuatorFlags,
  scenarios: ReadonlySet<ScenarioId>,
  profile: SpeciesProfile,
  params: ZoneModelParams,
  rng: Rng,
): EnvironmentState {
  let s = state;
  let elapsed = 0;
  while (elapsed < dtSeconds) {
    const dt = Math.min(MAX_STEP_SECONDS, dtSeconds - elapsed);
    s = step(s, startTime + elapsed * 1000, dt, actuators, scenarios, profile, params, rng);
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

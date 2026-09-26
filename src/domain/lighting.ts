import type { FarmLocation } from './location';
import { sunCrossings, sunPosition, sunTimes, type SunTimes } from './solar';
import type { Timestamp } from './types';

/**
 * Programa de iluminación del galpón (decisión de manejo, no de especie):
 * - natural: solo luz del sol; las aves duermen al oscurecer.
 * - extended: lámparas que completan la falta de luz natural dentro de una
 *   ventana horaria (p. ej. 5:00–21:00 = 16 h, típico para aumentar la postura).
 */
export type LightingProgram = { type: 'natural' } | { type: 'extended'; startHour: number; endHour: number };

export const NATURAL_LIGHT: LightingProgram = { type: 'natural' };

/** Elevación solar desde la que las aves se comportan como de día (~12 min antes de salir el sol). */
export const DAYLIGHT_ELEVATION = -3;

export interface LightState {
  sunElevation: number;
  sunAzimuth: number;
  /** Luz natural 0 (noche) … 1 (día pleno), con transición suave en el crepúsculo. */
  natural: number;
  /** El programa pide lámparas encendidas en este momento. */
  artificialWanted: boolean;
  /** Periodo de luz para las aves (natural o artificial). */
  isLightPeriod: boolean;
  minutesSinceStart: number | null;
  minutesUntilEnd: number | null;
  sun: SunTimes | null;
}

/** Hora local del dispositivo (se asume la misma zona horaria de la granja). */
function atLocalHour(reference: Timestamp, hour: number): Timestamp {
  const d = new Date(reference);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

export function lightState(time: Timestamp, location: FarmLocation, program: LightingProgram): LightState {
  const { latitude, longitude } = location;
  const position = sunPosition(time, latitude, longitude);
  const naturalOn = position.elevation > DAYLIGHT_ELEVATION;
  const window = sunCrossings(time, latitude, longitude, 90 - DAYLIGHT_ELEVATION);

  let start = window?.rise ?? null;
  let end = window?.set ?? null;
  let artificialWanted = false;
  if (program.type === 'extended') {
    const programStart = atLocalHour(time, program.startHour);
    const programEnd = atLocalHour(time, program.endHour);
    artificialWanted = time >= programStart && time < programEnd && !naturalOn;
    start = start === null ? programStart : Math.min(start, programStart);
    end = end === null ? programEnd : Math.max(end, programEnd);
  }

  const isLightPeriod = naturalOn || artificialWanted;
  return {
    sunElevation: position.elevation,
    sunAzimuth: position.azimuth,
    natural: Math.min(1, Math.max(0, (position.elevation + 6) / 12)),
    artificialWanted,
    isLightPeriod,
    minutesSinceStart: isLightPeriod && start !== null ? (time - start) / 60_000 : null,
    minutesUntilEnd: isLightPeriod && end !== null ? (end - time) / 60_000 : null,
    sun: sunTimes(time, latitude, longitude),
  };
}

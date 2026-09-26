import type { ProductionProfile } from '@/domain/profiles';
import type { Timestamp } from '@/domain/types';

import type { DayConditions, LayingFactors, ProductionDay } from './types';

/**
 * Modelo de producción de ponedoras (puro).
 * La postura de un día depende de las condiciones del día ANTERIOR: el huevo
 * tarda ~25 h en formarse. La mortalidad y el consumo dependen del propio día.
 * Los coeficientes son estimaciones de referencia para una demo realista.
 */

const HOUR_MS = 3600_000;
const WEEK_MS = 7 * 24 * HOUR_MS;

/** Interpolación lineal en una curva [x, y] ordenada por x. */
export function interpolate(curve: [number, number][], x: number): number {
  if (x <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i];
    if (x <= x1) {
      const [x0, y0] = curve[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return curve[curve.length - 1][1];
}

export function ageInWeeks(hatchDate: Timestamp, time: Timestamp): number {
  return (time - hatchDate) / WEEK_MS;
}

export function expectedLayingRate(profile: ProductionProfile, ageWeeks: number): number {
  return interpolate(profile.layingCurve, ageWeeks);
}

/** Temperatura efectiva para el ave: la humedad alta agrava el calor. */
export function effectiveTemperature(temperature: number, humidity: number | undefined): number {
  return temperature + Math.max(0, (humidity ?? 60) - 60) * 0.05;
}

export function layingFactors(profile: ProductionProfile, previous: DayConditions): LayingFactors {
  const missingLight = Math.max(0, profile.optimalLightHours - previous.lightHours);
  return {
    light: Math.max(0.6, 1 - profile.lossPerMissingLightHour * missingLight),
    heat: Math.exp(-profile.heatLossPerDegreeHour * previous.heatDegreeHours),
    water: Math.max(0.3, 1 - 0.08 * previous.waterOutageHours),
    feed: Math.max(0.5, 1 - 0.04 * previous.feedOutageHours),
    health: Math.max(0.6, 1 - 0.02 * previous.sickHours),
  };
}

export function combinedFactor(f: LayingFactors): number {
  return f.light * f.heat * f.water * f.feed * f.health;
}

export function eggWeight(profile: ProductionProfile, ageWeeks: number, previous: DayConditions): number {
  // Con calor el huevo sale más pequeño.
  return interpolate(profile.eggWeightCurve, ageWeeks) - Math.min(3, previous.heatDegreeHours * 0.03);
}

/** Temperatura a partir de la cual el calor extremo eleva la mortalidad (°C). */
export const LETHAL_HEAT = 36.5;

/** Fracción del lote que muere en el día (calor extremo y falta de agua la disparan). */
export function mortalityRate(profile: ProductionProfile, current: DayConditions): number {
  const heat = Math.max(0, current.maxTemperature - LETHAL_HEAT) * 0.0004;
  const thirst = Math.max(0, current.waterOutageHours - 8) * 0.0008;
  return profile.dailyMortality + heat + thirst;
}

/** Muertes enteras a partir de las esperadas: la parte fraccionaria se sortea. */
export function drawDeaths(expected: number, rng: () => number): number {
  return Math.floor(expected) + (rng() < expected % 1 ? 1 : 0);
}

/** Gramos de alimento por ave: comen menos con calor o si falta alimento. */
export function feedPerBird(profile: ProductionProfile, current: DayConditions): number {
  const heat = 1 - 0.015 * Math.max(0, current.meanTemperature - 21);
  const shortage = 1 - Math.min(1, current.feedOutageHours / 24);
  return Math.max(0, profile.feedGramsPerBird * heat * shortage);
}

/** Mililitros de agua por ave: beben más con calor; menos si no hay agua. */
export function waterPerBird(profile: ProductionProfile, current: DayConditions): number {
  const heat = 1 + 0.05 * Math.max(0, current.meanTemperature - 21);
  const shortage = 1 - Math.min(1, current.waterOutageHours / 24);
  return Math.max(0, profile.waterMlPerBird * heat * shortage);
}

export interface ProductionDayInput {
  profile: ProductionProfile;
  day: Timestamp;
  ageWeeks: number;
  hens: number;
  previous: DayConditions;
  current: DayConditions;
  source: ProductionDay['source'];
  rng: () => number;
  /** Muertes ya conocidas del día; si falta, se sortean con la tasa de mortalidad. */
  deaths?: number;
}

export function productionDay(input: ProductionDayInput): ProductionDay {
  const { profile, hens, previous, current, rng } = input;
  const expectedRate = expectedLayingRate(profile, input.ageWeeks);
  const factors = layingFactors(profile, previous);
  const noise = 1 + (rng() - 0.5) * 0.02;
  const layingRate = Math.min(1, expectedRate * combinedFactor(factors) * noise);
  const eggs = Math.round(hens * layingRate);

  const mortality = input.deaths ?? drawDeaths(hens * mortalityRate(profile, current), rng);

  const gFeed = feedPerBird(profile, current);
  const mlWater = waterPerBird(profile, current);
  const feedKg = (hens * gFeed) / 1000;
  const waterL = (hens * mlWater) / 1000;
  const weight = eggWeight(profile, input.ageWeeks, previous);
  const eggMassKg = (eggs * weight) / 1000;

  return {
    day: input.day,
    ageWeeks: input.ageWeeks,
    hens,
    eggs,
    layingRate: hens > 0 ? eggs / hens : 0,
    expectedRate,
    eggWeight: weight,
    mortality,
    feedKg,
    waterL,
    feedPerBird: gFeed,
    waterPerBird: mlWater,
    feedConversion: eggMassKg > 0 ? feedKg / eggMassKg : 0,
    factors,
    previous,
    current,
    source: input.source,
  };
}

/** Función de error (Abramowitz-Stegun 7.1.26). */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return sign * y;
}

/**
 * Fracción de los huevos del día ya puestos a la hora `time`: la mayoría se
 * ponen en la mañana, unas 4–5 h después del amanecer.
 */
export function layingProgress(time: Timestamp, dawn: Timestamp): number {
  const mean = dawn + 4.5 * HOUR_MS;
  const sd = 1.8 * HOUR_MS;
  return Math.min(1, Math.max(0, 0.5 * (1 + erf((time - mean) / (sd * Math.SQRT2)))));
}

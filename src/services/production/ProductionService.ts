import { lightHoursForDay, NATURAL_LIGHT } from '@/domain/lighting';
import { ConditionsAccumulator, type ConditionSample } from '@/domain/production/conditions';
import {
  ageInWeeks,
  drawDeaths,
  expectedLayingRate,
  feedPerBird,
  LETHAL_HEAT,
  layingProgress,
  mortalityRate,
  productionDay,
  waterPerBird,
} from '@/domain/production/model';
import type { DayConditions, ProductionDay, ProductionToday } from '@/domain/production/types';
import type { SpeciesProfile } from '@/domain/profiles';
import { sunCrossings } from '@/domain/solar';
import type { Timestamp, Zone } from '@/domain/types';
import type { FarmSetup } from '@/services/simulation/demoFarm';
import { SOLAR_GAIN, VENTILATION_COOLING } from '@/services/simulation/environmentModel';
import type { OutsideConditions, WeatherProvider } from '@/services/weather/types';
import { createRng, type Rng } from '@/utils/random';

const HOUR_MS = 3600_000;
/** Un día observado "desde el inicio" si la primera muestra llegó antes de esta hora. */
const DAY_START_TOLERANCE_MS = 30 * 60_000;

/** Medianoche local (se asume la zona horaria del dispositivo = la de la granja). */
export function localDayStart(time: Timestamp): Timestamp {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function addDays(dayStart: Timestamp, days: number): Timestamp {
  const d = new Date(dayStart);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export interface ProductionSnapshot {
  /** Días cerrados, del más antiguo al más reciente. */
  days: ProductionDay[];
  today: ProductionToday | null;
}

export interface ProductionServiceOptions {
  setup: FarmSetup;
  profile: SpeciesProfile;
  weather: WeatherProvider;
  backfillDays?: number;
  seed?: number;
}

/**
 * Producción del galpón principal:
 * - Historial: los últimos N días se estiman con el clima (real si hay datos).
 * - Día en curso: acumula las condiciones del galpón (simulado o, en el futuro,
 *   medido) y al cerrar el día genera su registro. La postura de cada día sale
 *   de las condiciones del día anterior.
 */
export class ProductionService {
  private readonly zone: Zone;
  private readonly location: FarmSetup['farm']['location'];
  private readonly profile: SpeciesProfile;
  private readonly weather: WeatherProvider;
  private readonly backfillDays: number;
  private readonly rng: Rng;

  private days: ProductionDay[] = [];
  private hens: number;
  /** Condiciones del día anterior al día en curso. */
  private previous: DayConditions | null = null;
  private currentDay: Timestamp | null = null;
  private acc: ConditionsAccumulator;
  private observedFromStart = false;
  private plan: ProductionDay | null = null;
  private deathsDebt = 0;
  private deathsToday = 0;
  private lastTime: Timestamp | null = null;
  private today: ProductionToday | null = null;

  constructor(options: ProductionServiceOptions) {
    this.zone = options.setup.farm.zones[0];
    this.location = options.setup.farm.location;
    this.profile = options.profile;
    this.weather = options.weather;
    this.backfillDays = options.backfillDays ?? 30;
    this.rng = createRng(options.seed ?? 11);
    this.hens = this.zone.population;
    this.acc = new ConditionsAccumulator(this.profile.production);
  }

  private ageAt(time: Timestamp): number {
    return this.zone.hatchDate === undefined ? 38 : ageInWeeks(this.zone.hatchDate, time);
  }

  private lightHours(day: Timestamp): number {
    return lightHoursForDay(day + 12 * HOUR_MS, this.location, this.zone.lighting ?? NATURAL_LIGHT);
  }

  private dawn(day: Timestamp): Timestamp {
    const crossing = sunCrossings(day + 12 * HOUR_MS, this.location.latitude, this.location.longitude, 96);
    return crossing?.rise ?? day + 6 * HOUR_MS;
  }

  /** Temperatura interior estimada a partir del clima (para días sin simulación). */
  private insideFromOutside(outside: OutsideConditions, lit: boolean): { temperature: number; humidity: number } {
    const animalHeat = lit ? 3.1 : 1.3;
    const raw = outside.temperature + animalHeat + (Math.max(0, outside.radiation) / 1000) * SOLAR_GAIN;
    const ventOn = this.profile.control.ventilation.on;
    const temperature = raw >= ventOn ? Math.max(outside.temperature + 0.5, raw - VENTILATION_COOLING) : raw;
    const humidity = Math.min(98, outside.humidity * Math.exp(-0.06 * (temperature - outside.temperature)) + 2);
    return { temperature, humidity };
  }

  /** Condiciones de un día completo estimadas con el clima, hora a hora. */
  private conditionsFromWeather(day: Timestamp): DayConditions {
    const acc = new ConditionsAccumulator(this.profile.production);
    for (let h = 0; h < 24; h++) {
      const t = day + h * HOUR_MS + 30 * 60_000;
      const outside = this.weather.conditionsAt(t);
      const inside = this.insideFromOutside(outside, outside.isDay);
      acc.add({ ...inside, waterLevel: 60, feedLevel: 60 }, 1);
    }
    return acc.result(this.lightHours(day));
  }

  /** Genera el historial de los días previos a `now` con el clima. Llamar antes de recibir muestras. */
  backfill(now: Timestamp): void {
    const today = localDayStart(now);
    const first = addDays(today, -this.backfillDays);
    const P = this.profile.production;
    const dayStarts: Timestamp[] = [];
    for (let day = first; day < today; day = addDays(day, 1)) dayStarts.push(day);
    const conditions = dayStarts.map((day) => this.conditionsFromWeather(day));

    // Las aves configuradas son las vivas hoy: hacia atrás se suman las muertes de cada día.
    const deaths = new Array<number>(dayStarts.length);
    let hens = this.zone.population;
    for (let i = dayStarts.length - 1; i >= 0; i--) {
      deaths[i] = drawDeaths(hens * mortalityRate(P, conditions[i]), this.rng);
      hens += deaths[i];
    }

    let previous = this.conditionsFromWeather(addDays(first, -1));
    this.days = dayStarts.map((day, i) => {
      const record = productionDay({
        profile: P,
        day,
        ageWeeks: this.ageAt(day),
        hens,
        previous,
        current: conditions[i],
        source: 'weather',
        rng: this.rng,
        deaths: deaths[i],
      });
      hens -= deaths[i];
      previous = conditions[i];
      return record;
    });
    this.hens = hens;
    this.previous = previous;
  }

  /** Nueva muestra de condiciones del galpón (una por lote de telemetría). */
  onSample(time: Timestamp, sample: ConditionSample): void {
    const day = localDayStart(time);
    if (this.currentDay === null || day !== this.currentDay) this.rollOver(day, time);

    const hours = this.lastTime === null ? 0 : Math.min(0.5, Math.max(0, (time - this.lastTime) / HOUR_MS));
    this.lastTime = time;
    this.acc.add(sample, hours);

    // Mortalidad en vivo: base + calor extremo + sed prolongada.
    const P = this.profile.production;
    let ratePerHour = P.dailyMortality / 24;
    if (sample.temperature !== undefined && sample.temperature > LETHAL_HEAT) {
      ratePerHour += ((sample.temperature - LETHAL_HEAT) * 0.0004) / 24;
    }
    const partial = this.acc.result(0);
    if (sample.waterLevel !== undefined && sample.waterLevel < 5 && partial.waterOutageHours > 8) ratePerHour += 0.0008;
    this.deathsDebt += this.hens * ratePerHour * hours;
    this.deathsToday = Math.floor(this.deathsDebt);
    this.updateToday(time);
  }

  private rollOver(day: Timestamp, time: Timestamp): void {
    // Cierra el día anterior si se observó completo.
    if (this.currentDay !== null && this.plan) {
      const current = this.acc.result(this.lightHours(this.currentDay));
      if (this.observedFromStart) {
        const record = this.finalize(this.plan, current);
        this.days = [...this.days.filter((d) => d.day !== record.day), record].slice(-this.backfillDays);
        this.hens = Math.max(0, this.hens - record.mortality);
        this.previous = current;
      } else {
        // Día parcial (antes del arranque): se conserva el estimado con el clima.
        this.previous = this.days.find((d) => d.day === this.currentDay)?.current ?? current;
      }
    }

    this.currentDay = day;
    // Observado completo si ya estábamos recibiendo datos al empezar el día.
    this.observedFromStart = this.lastTime !== null || time - day <= DAY_START_TOLERANCE_MS;
    this.acc = new ConditionsAccumulator(this.profile.production);
    this.deathsDebt = 0;
    this.deathsToday = 0;
    const previous = this.previous ?? this.conditionsFromWeather(addDays(day, -1));
    this.previous = previous;
    // Los huevos del día quedan determinados por las condiciones de ayer.
    this.plan = productionDay({
      profile: this.profile.production,
      day,
      ageWeeks: this.ageAt(day),
      hens: this.hens,
      previous,
      current: previous,
      source: 'simulation',
      rng: this.rng,
    });
  }

  private finalize(plan: ProductionDay, current: DayConditions): ProductionDay {
    const P = this.profile.production;
    const gFeed = feedPerBird(P, current);
    const mlWater = waterPerBird(P, current);
    const feedKg = (plan.hens * gFeed) / 1000;
    const eggMassKg = (plan.eggs * plan.eggWeight) / 1000;
    return {
      ...plan,
      mortality: this.deathsToday,
      feedPerBird: gFeed,
      waterPerBird: mlWater,
      feedKg,
      waterL: (plan.hens * mlWater) / 1000,
      feedConversion: eggMassKg > 0 ? feedKg / eggMassKg : 0,
      current,
    };
  }

  private updateToday(time: Timestamp): void {
    const plan = this.plan;
    if (!plan || this.currentDay === null) return;
    this.today = {
      day: this.currentDay,
      ageWeeks: plan.ageWeeks,
      hens: this.hens - this.deathsToday,
      expectedEggs: plan.eggs,
      eggsSoFar: Math.round(plan.eggs * layingProgress(time, this.dawn(this.currentDay))),
      expectedRate: expectedLayingRate(this.profile.production, plan.ageWeeks),
      projectedRate: plan.layingRate,
      mortalitySoFar: this.deathsToday,
      factors: plan.factors,
      previous: plan.previous,
    };
  }

  snapshot(): ProductionSnapshot {
    return { days: this.days, today: this.today };
  }
}

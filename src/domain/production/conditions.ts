import type { ProductionProfile } from '@/domain/profiles';

import { effectiveTemperature } from './model';
import type { DayConditions } from './types';

/** Una muestra de las condiciones del galpón durante `hours` horas. */
export interface ConditionSample {
  temperature?: number;
  humidity?: number;
  /** % del tanque */
  waterLevel?: number;
  /** % de la tolva */
  feedLevel?: number;
  /** Actividad baja de día sin causa ambiental. */
  sick?: boolean;
}

const OUTAGE_LEVEL = 5;

/** Acumula las condiciones de un día a partir de muestras sucesivas. */
export class ConditionsAccumulator {
  private hours = 0;
  private tempHours = 0;
  private tempSum = 0;
  private maxTemperature = -Infinity;
  private heatDegreeHours = 0;
  private waterOutageHours = 0;
  private feedOutageHours = 0;
  private sickHours = 0;

  constructor(private readonly profile: ProductionProfile) {}

  add(sample: ConditionSample, hours: number): void {
    if (hours <= 0) return;
    this.hours += hours;
    if (sample.temperature !== undefined) {
      this.tempHours += hours;
      this.tempSum += sample.temperature * hours;
      this.maxTemperature = Math.max(this.maxTemperature, sample.temperature);
      const effective = effectiveTemperature(sample.temperature, sample.humidity);
      this.heatDegreeHours += Math.max(0, effective - this.profile.heatThreshold) * hours;
    }
    if (sample.waterLevel !== undefined && sample.waterLevel < OUTAGE_LEVEL) this.waterOutageHours += hours;
    if (sample.feedLevel !== undefined && sample.feedLevel < OUTAGE_LEVEL) this.feedOutageHours += hours;
    if (sample.sick) this.sickHours += hours;
  }

  /** Horas acumuladas (para saber si el día está completo). */
  get coveredHours(): number {
    return this.hours;
  }

  result(lightHours: number): DayConditions {
    const mean = this.tempHours > 0 ? this.tempSum / this.tempHours : 21;
    return {
      lightHours,
      heatDegreeHours: this.heatDegreeHours,
      maxTemperature: Number.isFinite(this.maxTemperature) ? this.maxTemperature : mean,
      meanTemperature: mean,
      waterOutageHours: this.waterOutageHours,
      feedOutageHours: this.feedOutageHours,
      sickHours: this.sickHours,
    };
  }
}

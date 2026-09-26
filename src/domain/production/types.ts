import type { Timestamp } from '@/domain/types';

/** Condiciones de un día que influyen en la producción. */
export interface DayConditions {
  /** Horas con luz para las aves (natural + artificial). */
  lightHours: number;
  /** Σ de grados por encima del umbral de calor, por hora (temperatura efectiva). */
  heatDegreeHours: number;
  maxTemperature: number;
  meanTemperature: number;
  /** Horas con el tanque prácticamente vacío. */
  waterOutageHours: number;
  /** Horas con la tolva prácticamente vacía. */
  feedOutageHours: number;
  /** Horas de luz con actividad baja sin causa ambiental (posible enfermedad). */
  sickHours: number;
}

/** Multiplicadores de postura (1 = sin pérdida) por causa. */
export interface LayingFactors {
  light: number;
  heat: number;
  water: number;
  feed: number;
  health: number;
}

export interface ProductionDay {
  /** Medianoche local del día. */
  day: Timestamp;
  ageWeeks: number;
  /** Aves vivas al inicio del día. */
  hens: number;
  eggs: number;
  /** Huevos / aves (0–1). */
  layingRate: number;
  /** Postura esperada por edad, sin pérdidas (0–1). */
  expectedRate: number;
  /** Gramos. */
  eggWeight: number;
  mortality: number;
  feedKg: number;
  waterL: number;
  /** Gramos por ave. */
  feedPerBird: number;
  /** Mililitros por ave. */
  waterPerBird: number;
  /** kg de alimento por kg de huevo. */
  feedConversion: number;
  factors: LayingFactors;
  /** Condiciones del día anterior (formación del huevo) y del propio día. */
  previous: DayConditions;
  current: DayConditions;
  /** De dónde salen los datos del día. */
  source: 'weather' | 'simulation';
}

/** Producción del día en curso (parcial). */
export interface ProductionToday {
  day: Timestamp;
  ageWeeks: number;
  hens: number;
  expectedEggs: number;
  eggsSoFar: number;
  expectedRate: number;
  projectedRate: number;
  mortalitySoFar: number;
  factors: LayingFactors;
  previous: DayConditions;
}

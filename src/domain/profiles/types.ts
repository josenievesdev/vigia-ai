import type { ActuatorKind, SensorKind, SpeciesId } from '@/domain/types';

/**
 * Referencias productivas de la especie. Curvas aproximadas de líneas
 * comerciales de ponedoras; cada granja podrá ajustarlas a su genética.
 */
export interface ProductionProfile {
  /** Postura esperada en condiciones ideales según la edad: [semanas, fracción 0–1]. */
  layingCurve: [number, number][];
  /** Peso medio del huevo según la edad: [semanas, gramos]. */
  eggWeightCurve: [number, number][];
  /** Horas de luz con las que se alcanza la postura máxima. */
  optimalLightHours: number;
  /** Pérdida de postura por cada hora de luz que falta (fracción). */
  lossPerMissingLightHour: number;
  /** Temperatura efectiva (°C) a partir de la cual el calor reduce la postura. */
  heatThreshold: number;
  /** Pérdida por grado-hora sobre el umbral (coeficiente exponencial). */
  heatLossPerDegreeHour: number;
  /** Consumo de referencia por ave y día a 21 °C. */
  feedGramsPerBird: number;
  waterMlPerBird: number;
  /** Mortalidad diaria de base (fracción del lote). */
  dailyMortality: number;
}

/** Rango con límites de advertencia y críticos. */
export interface Band {
  warning: number;
  critical: number;
}

/** Control con histéresis: se activa al cruzar `on` y se apaga al cruzar `off`. */
export interface Hysteresis {
  on: number;
  off: number;
}

/**
 * Perfil productivo: todo lo que cambia entre especies o cultivos vive aquí.
 * El motor de reglas y la simulación leen el perfil y nunca valores fijos.
 */
export interface SpeciesProfile {
  id: SpeciesId;
  displayName: string;
  /** Sustantivo plural para la UI ("gallinas", "cerdos", "plantas"). */
  populationNoun: string;
  sensorKinds: SensorKind[];
  actuatorKinds: ActuatorKind[];

  comfort: {
    temperature: { min: number; max: number };
    humidity: { min: number; max: number };
  };

  alerts: {
    highTemperature: Band;
    lowTemperature: Band;
    highHumidity: Band;
    /**
     * La humedad alta solo es un riesgo agudo con calor (agrava el estrés
     * térmico). Por debajo de esta temperatura (°C) no se alerta.
     */
    highHumidityMinTemperature: number;
    /** % del tanque/tolva por debajo del cual se alerta. */
    lowWater: Band;
    lowFeed: Band;
    /** Índice de actividad (0–100) por debajo del cual se alerta durante el periodo de luz. */
    lowActivity: Band;
  };

  control: {
    /** °C */
    ventilation: Hysteresis;
    /** % de nivel */
    feeder: Hysteresis;
    waterPump: Hysteresis;
    /** Fotoperiodo en horas del día [inicio, fin). */
    photoperiod: { startHour: number; endHour: number };
  };

  /** Referencias de producción (postura, peso, consumo, mortalidad). */
  production: ProductionProfile;

  /** Consumo por animal y día, usado por la simulación y futuras proyecciones. */
  consumption: {
    waterLitersPerDay: number;
    feedKgPerDay: number;
  };
}

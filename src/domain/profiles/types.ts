import type { ActuatorKind, SensorKind, SpeciesId } from '@/domain/types';

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

  /** Consumo por animal y día, usado por la simulación y futuras proyecciones. */
  consumption: {
    waterLitersPerDay: number;
    feedKgPerDay: number;
  };
}

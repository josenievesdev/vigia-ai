import type { ActuatorKind, SensorKind } from './types';

export interface SensorKindInfo {
  label: string;
  unit: string;
  /** Decimales a mostrar en la UI. */
  precision: number;
}

export const SENSOR_KINDS: Record<SensorKind, SensorKindInfo> = {
  temperature: { label: 'Temperatura', unit: '°C', precision: 1 },
  humidity: { label: 'Humedad', unit: '%', precision: 0 },
  light: { label: 'Luz', unit: 'lux', precision: 0 },
  waterLevel: { label: 'Agua', unit: '%', precision: 0 },
  feedLevel: { label: 'Alimento', unit: '%', precision: 0 },
  animalActivity: { label: 'Actividad', unit: '/100', precision: 0 },
};

export const ACTUATOR_KINDS: Record<ActuatorKind, { label: string }> = {
  ventilation: { label: 'Ventilación' },
  feeder: { label: 'Alimentador' },
  waterPump: { label: 'Suministro de agua' },
  lighting: { label: 'Iluminación' },
};

/** Equipos que influyen en cada variable (para mostrar causa → efecto en las gráficas). */
export const RELATED_ACTUATORS: Record<SensorKind, ActuatorKind[]> = {
  temperature: ['ventilation'],
  humidity: ['ventilation'],
  light: ['lighting'],
  waterLevel: ['waterPump'],
  feedLevel: ['feeder'],
  animalActivity: ['lighting'],
};

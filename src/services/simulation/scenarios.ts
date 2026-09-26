/** Escenarios del modo demo. Cada uno altera el modelo físico, no los datos mostrados. */
export type ScenarioId = 'heatWave' | 'waterOutage' | 'feedShortage' | 'lowActivity' | 'sensorFailure';

export interface ScenarioInfo {
  id: ScenarioId;
  label: string;
  description: string;
}

export const SCENARIOS: ScenarioInfo[] = [
  {
    id: 'heatWave',
    label: 'Ola de calor',
    description: 'La temperatura exterior sube ~11 °C. La ventilación se activa pero no alcanza a compensar.',
  },
  {
    id: 'waterOutage',
    label: 'Falta de agua',
    description: 'Se corta el suministro: el tanque baja y la bomba no logra rellenarlo.',
  },
  {
    id: 'feedShortage',
    label: 'Falta de alimento',
    description: 'El silo queda vacío: la tolva baja y el alimentador no puede reponer.',
  },
  {
    id: 'lowActivity',
    label: 'Baja actividad animal',
    description: 'Las aves reducen su movimiento, posible signo de enfermedad o estrés.',
  },
  {
    id: 'sensorFailure',
    label: 'Sensor desconectado',
    description: 'El sensor de temperatura deja de reportar.',
  },
];

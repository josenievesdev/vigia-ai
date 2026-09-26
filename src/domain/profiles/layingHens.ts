import type { SpeciesProfile } from './types';

/**
 * Gallinas ponedoras en galpón con ventilación natural/forzada.
 * Valores de referencia generales; cada granja podrá ajustarlos en el futuro.
 */
export const layingHensProfile: SpeciesProfile = {
  id: 'layingHens',
  displayName: 'Gallinas ponedoras',
  populationNoun: 'gallinas',
  sensorKinds: ['temperature', 'humidity', 'light', 'waterLevel', 'feedLevel', 'animalActivity'],
  actuatorKinds: ['ventilation', 'feeder', 'waterPump', 'lighting'],

  comfort: {
    temperature: { min: 18, max: 26 },
    humidity: { min: 50, max: 70 },
  },

  alerts: {
    highTemperature: { warning: 29, critical: 32 },
    lowTemperature: { warning: 14, critical: 10 },
    highHumidity: { warning: 80, critical: 90 },
    highHumidityMinTemperature: 28,
    lowWater: { warning: 20, critical: 10 },
    lowFeed: { warning: 20, critical: 10 },
    lowActivity: { warning: 35, critical: 20 },
  },

  control: {
    ventilation: { on: 27, off: 24 },
    feeder: { on: 30, off: 95 },
    waterPump: { on: 35, off: 95 },
    // 16 h de luz: estándar habitual para mantener la postura.
    photoperiod: { startHour: 5, endHour: 21 },
  },

  consumption: {
    waterLitersPerDay: 0.25,
    feedKgPerDay: 0.115,
  },
};

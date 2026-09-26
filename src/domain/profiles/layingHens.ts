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

  production: {
    layingCurve: [
      [18, 0.05],
      [20, 0.5],
      [22, 0.85],
      [25, 0.94],
      [30, 0.95],
      [40, 0.92],
      [50, 0.89],
      [60, 0.85],
      [70, 0.8],
      [80, 0.75],
    ],
    eggWeightCurve: [
      [20, 48],
      [25, 56],
      [30, 59],
      [40, 62],
      [50, 63.5],
      [60, 64.5],
      [70, 65],
    ],
    optimalLightHours: 16,
    lossPerMissingLightHour: 0.02,
    // Lote aclimatado al trópico: el calor resta postura sobre ~30 °C efectivos.
    heatThreshold: 30,
    heatLossPerDegreeHour: 0.003,
    feedGramsPerBird: 110,
    waterMlPerBird: 220,
    dailyMortality: 0.0002,
  },

  consumption: {
    waterLitersPerDay: 0.25,
    feedKgPerDay: 0.115,
  },
};

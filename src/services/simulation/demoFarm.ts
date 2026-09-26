import { ACTUATOR_KINDS, SENSOR_KINDS } from '@/domain/catalog';
import { NATURAL_LIGHT } from '@/domain/lighting';
import type { FarmLocation } from '@/domain/location';
import type { ActuatorKind, Actuator, Farm, Sensor, SensorKind } from '@/domain/types';

import type { ZoneModelParams } from './environmentModel';

/**
 * Configuración de la granja de demostración. Cuando exista backend, esta
 * información (granja, zonas, dispositivos) vendrá de la base de datos.
 */

export interface FarmSetup {
  farm: Farm;
  sensors: Sensor[];
  actuators: Actuator[];
}

/** Ubicación real de la granja demo (coordenadas de Open-Meteo Geocoding). */
export const VALLEDUPAR: FarmLocation = {
  name: 'Valledupar',
  region: 'Cesar',
  country: 'Colombia',
  latitude: 10.46538,
  longitude: -73.2531,
  elevation: 160,
  timezone: 'America/Bogota',
};

const FARM_ID = 'farm-el-paraiso';
const WEEK_MS = 7 * 24 * 3600_000;
/** Lote de 38 semanas: plena postura. */
export const DEMO_FLOCK_AGE_WEEKS = 38;
const ZONE_ID = 'zone-galpon-1';
const DEVICE_ID = 'esp32-galpon-1';

const sensorKinds: SensorKind[] = [
  'temperature',
  'humidity',
  'light',
  'waterLevel',
  'feedLevel',
  'animalActivity',
];
const actuatorKinds: ActuatorKind[] = ['ventilation', 'feeder', 'waterPump', 'lighting'];

export const demoFarmSetup: FarmSetup = {
  farm: {
    id: FARM_ID,
    name: 'Granja El Paraíso',
    speciesId: 'layingHens',
    location: VALLEDUPAR,
    zones: [
      {
        id: ZONE_ID,
        farmId: FARM_ID,
        name: 'Galpón 1',
        population: 1200,
        lighting: NATURAL_LIGHT,
        hatchDate: Date.now() - DEMO_FLOCK_AGE_WEEKS * WEEK_MS,
      },
    ],
  },
  sensors: sensorKinds.map((kind) => ({
    id: `${ZONE_ID}:${kind}`,
    deviceId: DEVICE_ID,
    zoneId: ZONE_ID,
    kind,
    label: SENSOR_KINDS[kind].label,
    unit: SENSOR_KINDS[kind].unit,
  })),
  actuators: actuatorKinds.map((kind) => ({
    id: `${ZONE_ID}:${kind}`,
    deviceId: DEVICE_ID,
    zoneId: ZONE_ID,
    kind,
    label: ACTUATOR_KINDS[kind].label,
  })),
};

export function defaultZoneParams(population: number): ZoneModelParams {
  return {
    population,
    tankLiters: 200,
    hopperKg: 120,
    pumpLitersPerHour: 120,
    feederKgPerHour: 60,
  };
}

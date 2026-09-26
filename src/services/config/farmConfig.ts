import type { LightingProgram } from '@/domain/lighting';
import type { FarmLocation } from '@/domain/location';
import type { SpeciesProfile } from '@/domain/profiles';
import type { Timestamp } from '@/domain/types';
import { demoFarmSetup, type FarmSetup } from '@/services/simulation/demoFarm';

/**
 * Configuración editable de la granja (se guarda en el teléfono; con backend,
 * vendrá del servidor). Todo lo que el propietario o el integrador ajusta.
 */

export interface ThresholdSettings {
  /** °C */
  ventilationOn: number;
  ventilationOff: number;
  tempWarning: number;
  tempCritical: number;
  /** % del tanque */
  pumpOn: number;
  pumpOff: number;
  waterWarning: number;
  waterCritical: number;
  /** % de la tolva */
  feederOn: number;
  feederOff: number;
  feedWarning: number;
  feedCritical: number;
}

export interface FarmConfig {
  version: 1;
  farmName: string;
  location: FarmLocation;
  zoneName: string;
  population: number;
  /** Nacimiento del lote: la edad avanza sola con el tiempo. */
  hatchDate: Timestamp;
  lighting: LightingProgram;
  thresholds: ThresholdSettings;
}

const WEEK_MS = 7 * 24 * 3600_000;

export function flockAgeWeeks(config: FarmConfig, now: Timestamp): number {
  return (now - config.hatchDate) / WEEK_MS;
}

export function hatchDateForAge(ageWeeks: number, now: Timestamp): Timestamp {
  return now - ageWeeks * WEEK_MS;
}

export function thresholdsFromProfile(profile: SpeciesProfile): ThresholdSettings {
  const { control, alerts } = profile;
  return {
    ventilationOn: control.ventilation.on,
    ventilationOff: control.ventilation.off,
    tempWarning: alerts.highTemperature.warning,
    tempCritical: alerts.highTemperature.critical,
    pumpOn: control.waterPump.on,
    pumpOff: control.waterPump.off,
    waterWarning: alerts.lowWater.warning,
    waterCritical: alerts.lowWater.critical,
    feederOn: control.feeder.on,
    feederOff: control.feeder.off,
    feedWarning: alerts.lowFeed.warning,
    feedCritical: alerts.lowFeed.critical,
  };
}

/** Perfil efectivo: el de la especie con los umbrales de esta granja. */
export function profileWithThresholds(base: SpeciesProfile, t: ThresholdSettings): SpeciesProfile {
  return {
    ...base,
    control: {
      ...base.control,
      ventilation: { on: t.ventilationOn, off: t.ventilationOff },
      waterPump: { on: t.pumpOn, off: t.pumpOff },
      feeder: { on: t.feederOn, off: t.feederOff },
    },
    alerts: {
      ...base.alerts,
      highTemperature: { warning: t.tempWarning, critical: t.tempCritical },
      lowWater: { warning: t.waterWarning, critical: t.waterCritical },
      lowFeed: { warning: t.feedWarning, critical: t.feedCritical },
    },
  };
}

export function defaultConfig(profile: SpeciesProfile, now: Timestamp = Date.now()): FarmConfig {
  const zone = demoFarmSetup.farm.zones[0];
  return {
    version: 1,
    farmName: demoFarmSetup.farm.name,
    location: demoFarmSetup.farm.location,
    zoneName: zone.name,
    population: zone.population,
    hatchDate: zone.hatchDate ?? hatchDateForAge(38, now),
    lighting: zone.lighting ?? { type: 'natural' },
    thresholds: thresholdsFromProfile(profile),
  };
}

/** Granja (dispositivos incluidos) con los datos de la configuración. */
export function setupFromConfig(config: FarmConfig): FarmSetup {
  const zone = demoFarmSetup.farm.zones[0];
  return {
    ...demoFarmSetup,
    farm: {
      ...demoFarmSetup.farm,
      name: config.farmName.trim() || demoFarmSetup.farm.name,
      location: config.location,
      zones: [
        {
          ...zone,
          name: config.zoneName.trim() || zone.name,
          population: config.population,
          hatchDate: config.hatchDate,
          lighting: config.lighting,
        },
      ],
    },
  };
}

/** Errores legibles; lista vacía = configuración válida. */
export function validateConfig(config: FarmConfig): string[] {
  const t = config.thresholds;
  const errors: string[] = [];
  if (!config.farmName.trim()) errors.push('La granja necesita un nombre.');
  if (!Number.isInteger(config.population) || config.population < 1 || config.population > 200_000) {
    errors.push('El número de aves debe estar entre 1 y 200.000.');
  }
  if (config.lighting.type === 'extended') {
    const { startHour, endHour } = config.lighting;
    if (startHour < 0 || endHour > 24 || startHour >= endHour) {
      errors.push('El programa de luz debe empezar antes de terminar (entre 0 y 24 h).');
    }
  }
  if (t.ventilationOff >= t.ventilationOn) errors.push('La ventilación debe apagarse por debajo de la temperatura de encendido.');
  if (t.tempWarning >= t.tempCritical) errors.push('La temperatura de advertencia debe ser menor que la crítica.');
  if (t.pumpOn >= t.pumpOff) errors.push('La bomba debe encender con un nivel de agua menor al de apagado.');
  if (t.feederOn >= t.feederOff) errors.push('El alimentador debe encender con un nivel menor al de apagado.');
  if (t.waterCritical >= t.waterWarning) errors.push('Agua: el nivel crítico debe ser menor que el de advertencia.');
  if (t.feedCritical >= t.feedWarning) errors.push('Alimento: el nivel crítico debe ser menor que el de advertencia.');
  for (const v of [t.pumpOn, t.pumpOff, t.waterWarning, t.waterCritical, t.feederOn, t.feederOff, t.feedWarning, t.feedCritical]) {
    if (v < 0 || v > 100) {
      errors.push('Los niveles deben estar entre 0 y 100 %.');
      break;
    }
  }
  return errors;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Lee una configuración guardada; null si falta o es inválida (se usan los valores por defecto). */
export function parseStoredConfig(raw: string | null): FarmConfig | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as Partial<FarmConfig>;
    const loc = c.location as Partial<FarmLocation> | undefined;
    const t = c.thresholds as Partial<ThresholdSettings> | undefined;
    if (c.version !== 1 || typeof c.farmName !== 'string' || typeof c.zoneName !== 'string') return null;
    if (!isNum(c.population) || !isNum(c.hatchDate) || !c.lighting || !loc || !t) return null;
    if (!isNum(loc.latitude) || !isNum(loc.longitude) || typeof loc.name !== 'string' || typeof loc.timezone !== 'string') {
      return null;
    }
    const keys: (keyof ThresholdSettings)[] = [
      'ventilationOn',
      'ventilationOff',
      'tempWarning',
      'tempCritical',
      'pumpOn',
      'pumpOff',
      'waterWarning',
      'waterCritical',
      'feederOn',
      'feederOff',
      'feedWarning',
      'feedCritical',
    ];
    if (!keys.every((k) => isNum(t[k]))) return null;
    const config = c as FarmConfig;
    return validateConfig(config).length ? null : config;
  } catch {
    return null;
  }
}

import type { Band, SpeciesProfile } from './profiles';
import type { HealthStatus, SensorKind } from './types';

/** Estado de un valor frente a una banda de advertencia/crítico. */
export function bandStatus(value: number, band: Band, direction: 'above' | 'below'): HealthStatus {
  if (direction === 'above') {
    if (value >= band.critical) return 'critical';
    if (value >= band.warning) return 'warning';
  } else {
    if (value <= band.critical) return 'critical';
    if (value <= band.warning) return 'warning';
  }
  return 'normal';
}

export interface ThresholdBand {
  from: number;
  to: number;
  kind: 'optimal' | 'warning' | 'critical';
  label: string;
}

/** Zonas de referencia de cada variable según el perfil (para pintar en gráficas). */
export function thresholdBands(kind: SensorKind, profile: SpeciesProfile): ThresholdBand[] {
  const a = profile.alerts;
  const { temperature: t, humidity: h } = profile.comfort;
  switch (kind) {
    case 'temperature':
      return [
        { from: -Infinity, to: a.lowTemperature.critical, kind: 'critical', label: 'Crítico' },
        { from: a.lowTemperature.critical, to: a.lowTemperature.warning, kind: 'warning', label: 'Advertencia' },
        { from: t.min, to: t.max, kind: 'optimal', label: 'Óptimo' },
        { from: a.highTemperature.warning, to: a.highTemperature.critical, kind: 'warning', label: 'Advertencia' },
        { from: a.highTemperature.critical, to: Infinity, kind: 'critical', label: 'Crítico' },
      ];
    case 'humidity':
      return [
        { from: h.min, to: h.max, kind: 'optimal', label: 'Óptimo' },
        { from: a.highHumidity.warning, to: a.highHumidity.critical, kind: 'warning', label: 'Advertencia' },
        { from: a.highHumidity.critical, to: Infinity, kind: 'critical', label: 'Crítico' },
      ];
    case 'waterLevel':
    case 'feedLevel': {
      const band = kind === 'waterLevel' ? a.lowWater : a.lowFeed;
      return [
        { from: -Infinity, to: band.critical, kind: 'critical', label: 'Crítico' },
        { from: band.critical, to: band.warning, kind: 'warning', label: 'Advertencia' },
      ];
    }
    case 'animalActivity':
      return [
        { from: -Infinity, to: a.lowActivity.critical, kind: 'critical', label: 'Crítico (de día)' },
        { from: a.lowActivity.critical, to: a.lowActivity.warning, kind: 'warning', label: 'Advertencia (de día)' },
      ];
    default:
      return [];
  }
}

/** Rango objetivo de cada variable, para medir el % del tiempo que se cumplió. */
export function targetRange(
  kind: SensorKind,
  profile: SpeciesProfile,
): { min: number; max: number; label: string } | null {
  switch (kind) {
    case 'temperature':
      return { ...profile.comfort.temperature, label: 'En rango óptimo' };
    case 'humidity':
      return { ...profile.comfort.humidity, label: 'En rango óptimo' };
    case 'waterLevel':
      return { min: profile.alerts.lowWater.warning, max: 100, label: 'Sobre el mínimo' };
    case 'feedLevel':
      return { min: profile.alerts.lowFeed.warning, max: 100, label: 'Sobre el mínimo' };
    default:
      return null;
  }
}

/** Estado de una lectura individual según los umbrales del perfil (para colorear la UI). */
export function readingStatus(
  kind: SensorKind,
  value: number,
  profile: SpeciesProfile,
  opts: { isPhotoperiod?: boolean } = {},
): HealthStatus {
  const a = profile.alerts;
  switch (kind) {
    case 'temperature': {
      const high = bandStatus(value, a.highTemperature, 'above');
      return high !== 'normal' ? high : bandStatus(value, a.lowTemperature, 'below');
    }
    case 'humidity':
      return bandStatus(value, a.highHumidity, 'above');
    case 'waterLevel':
      return bandStatus(value, a.lowWater, 'below');
    case 'feedLevel':
      return bandStatus(value, a.lowFeed, 'below');
    case 'animalActivity':
      return opts.isPhotoperiod === false ? 'normal' : bandStatus(value, a.lowActivity, 'below');
    default:
      return 'normal';
  }
}

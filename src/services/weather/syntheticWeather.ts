import type { FarmLocation } from '@/domain/location';
import { sunPosition } from '@/domain/solar';
import { hourOfDay } from '@/domain/time';
import type { Timestamp } from '@/domain/types';

import type { OutsideConditions, WeatherProvider } from './types';

const RAD = Math.PI / 180;

/**
 * Clima genérico de respaldo (sin conexión, pruebas o fuera del rango del
 * pronóstico): ciclo diario suave con mínimo de madrugada y máximo a media tarde.
 * El día y la noche sí siguen el sol real de la ubicación.
 */
export function syntheticConditions(time: Timestamp, location: FarmLocation): OutsideConditions {
  const hour = hourOfDay(time);
  const temperature = 22 + 6 * Math.sin((2 * Math.PI * (hour - 9)) / 24);
  const humidity = Math.min(95, Math.max(35, 72 - (temperature - 22) * 2.2));
  const sun = sunPosition(time, location.latitude, location.longitude);
  const isDay = sun.elevation > 0;
  return {
    temperature,
    humidity,
    apparentTemperature: temperature,
    radiation: isDay ? 850 * Math.sin(sun.elevation * RAD) : 0,
    precipitation: 0,
    cloudCover: 20,
    windSpeed: 5,
    weatherCode: 1,
    isDay,
  };
}

export class SyntheticWeather implements WeatherProvider {
  constructor(private readonly location: FarmLocation) {}

  conditionsAt(time: Timestamp): OutsideConditions {
    return syntheticConditions(time, this.location);
  }
}

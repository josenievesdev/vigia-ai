import type { Timestamp } from '@/domain/types';

/** Condiciones meteorológicas exteriores en un instante. */
export interface OutsideConditions {
  /** °C */
  temperature: number;
  /** % */
  humidity: number;
  /** Sensación térmica, °C */
  apparentTemperature: number;
  /** Radiación solar de onda corta, W/m² */
  radiation: number;
  /** mm en la última hora */
  precipitation: number;
  /** % */
  cloudCover: number;
  /** km/h */
  windSpeed: number;
  /** Código de tiempo WMO (0 despejado … 95 tormenta). */
  weatherCode: number;
  isDay: boolean;
}

/** Fuente de condiciones exteriores para cualquier instante (real, pronóstico o sintética). */
export interface WeatherProvider {
  conditionsAt(time: Timestamp): OutsideConditions;
}

export interface WeatherPoint extends OutsideConditions {
  time: Timestamp;
}

/** Respuesta normalizada de un servicio meteorológico. */
export interface WeatherSnapshot {
  fetchedAt: Timestamp;
  /** Observación actual (resolución de 15 min). */
  current: WeatherPoint;
  /** Serie horaria (incluye las últimas 24 h y el pronóstico). */
  hourly: WeatherPoint[];
}

/**
 * - live: datos reales recientes.
 * - stale: datos reales pero antiguos (sin conexión desde hace rato).
 * - synthetic: sin datos reales; se usa el clima de respaldo.
 */
export type WeatherStatus = 'loading' | 'live' | 'stale' | 'synthetic';

export const WEATHER_ATTRIBUTION = 'Datos meteorológicos: Open-Meteo.com (CC BY 4.0)';

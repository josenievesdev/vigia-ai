import type { FarmLocation } from '@/domain/location';

import type { WeatherPoint, WeatherSnapshot } from './types';

/**
 * Cliente de Open-Meteo (https://open-meteo.com). Sin clave de API.
 * Uso gratuito solo NO comercial: antes de comercializar VigíaAI se debe usar
 * un plan pago o consultar desde el servidor propio (ver docs/ARCHITECTURE.md).
 */

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const VARIABLES = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'shortwave_radiation',
  'precipitation',
  'cloud_cover',
  'wind_speed_10m',
  'weather_code',
  'is_day',
] as const;

export function buildOpenMeteoUrl(location: FarmLocation): string {
  const params = [
    `latitude=${location.latitude}`,
    `longitude=${location.longitude}`,
    `current=${VARIABLES.join(',')}`,
    `hourly=${VARIABLES.join(',')}`,
    // 31 días: 24 h para la simulación y un mes para el historial de producción.
    'past_days=31',
    'forecast_days=2',
    'timeformat=unixtime',
    `timezone=${encodeURIComponent(location.timezone)}`,
  ];
  return `${BASE_URL}?${params.join('&')}`;
}

type Series = Record<(typeof VARIABLES)[number] | 'time', unknown>;

function num(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Open-Meteo: campo inválido "${field}"`);
  return value;
}

function toPoint(get: (field: keyof Series) => unknown): WeatherPoint {
  return {
    time: num(get('time'), 'time') * 1000,
    temperature: num(get('temperature_2m'), 'temperature_2m'),
    humidity: num(get('relative_humidity_2m'), 'relative_humidity_2m'),
    apparentTemperature: num(get('apparent_temperature'), 'apparent_temperature'),
    radiation: num(get('shortwave_radiation'), 'shortwave_radiation'),
    precipitation: num(get('precipitation'), 'precipitation'),
    cloudCover: num(get('cloud_cover'), 'cloud_cover'),
    windSpeed: num(get('wind_speed_10m'), 'wind_speed_10m'),
    weatherCode: num(get('weather_code'), 'weather_code'),
    isDay: num(get('is_day'), 'is_day') === 1,
  };
}

/** Valida y normaliza la respuesta JSON (tiempos en unixtime → ms). */
export function parseOpenMeteo(json: unknown, fetchedAt: number): WeatherSnapshot {
  if (!json || typeof json !== 'object') throw new Error('Open-Meteo: respuesta vacía');
  const body = json as { current?: Series; hourly?: Record<string, unknown[]> };
  if (!body.current || !body.hourly || !Array.isArray(body.hourly.time)) {
    throw new Error('Open-Meteo: faltan "current" u "hourly"');
  }
  const hourly = body.hourly;
  const current = toPoint((f) => body.current![f]);
  const points = hourly.time.map((_, i) => toPoint((f) => (hourly[f] as unknown[] | undefined)?.[i]));
  return { fetchedAt, current, hourly: points };
}

export interface FetchOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export async function fetchOpenMeteo(location: FarmLocation, options: FetchOptions = {}): Promise<WeatherSnapshot> {
  const { timeoutMs = 8000, fetchImpl = fetch, now = Date.now } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(buildOpenMeteoUrl(location), { signal: controller.signal });
    if (!response.ok) throw new Error(`Open-Meteo: HTTP ${response.status}`);
    return parseOpenMeteo(await response.json(), now());
  } finally {
    clearTimeout(timer);
  }
}

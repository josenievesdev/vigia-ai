import type { FarmLocation } from '@/domain/location';
import type { Timestamp } from '@/domain/types';

import { fetchOpenMeteo } from './openMeteo';
import { SyntheticWeather } from './syntheticWeather';
import type { OutsideConditions, WeatherPoint, WeatherProvider, WeatherSnapshot, WeatherStatus } from './types';

/** Los datos reales se consideran "antiguos" pasada esta edad. */
const STALE_AFTER_MS = 60 * 60_000;

export interface WeatherServiceOptions {
  fetcher?: (location: FarmLocation) => Promise<WeatherSnapshot>;
  now?: () => number;
}

const NUMERIC_FIELDS = [
  'temperature',
  'humidity',
  'apparentTemperature',
  'radiation',
  'cloudCover',
  'windSpeed',
] as const satisfies readonly (keyof OutsideConditions)[];

/**
 * Clima exterior de la granja. Combina la serie horaria real (últimas 24 h +
 * pronóstico de 48 h) con la observación actual, interpola entre puntos y, si
 * no hay datos para un instante, usa el clima sintético de respaldo.
 */
export class WeatherService implements WeatherProvider {
  private snapshot: WeatherSnapshot | null = null;
  private series: WeatherPoint[] = [];
  private failed = false;
  private readonly synthetic: SyntheticWeather;
  private readonly fetcher: (location: FarmLocation) => Promise<WeatherSnapshot>;
  private readonly now: () => number;

  constructor(
    readonly location: FarmLocation,
    options: WeatherServiceOptions = {},
  ) {
    this.synthetic = new SyntheticWeather(location);
    this.fetcher = options.fetcher ?? ((loc) => fetchOpenMeteo(loc));
    this.now = options.now ?? Date.now;
  }

  /** Descarga datos nuevos. Nunca lanza: ante un error conserva lo último o pasa a respaldo. */
  async refresh(): Promise<WeatherStatus> {
    try {
      this.setSnapshot(await this.fetcher(this.location));
      this.failed = false;
    } catch (error) {
      this.failed = true;
      console.warn('[VigíaAI] No se pudo obtener el clima real:', error instanceof Error ? error.message : error);
    }
    return this.getStatus();
  }

  setSnapshot(snapshot: WeatherSnapshot): void {
    this.snapshot = snapshot;
    // La observación actual (15 min) reemplaza a los puntos horarios cercanos.
    const current = snapshot.current;
    this.series = [...snapshot.hourly.filter((p) => Math.abs(p.time - current.time) >= 30 * 60_000), current].sort(
      (a, b) => a.time - b.time,
    );
  }

  getStatus(): WeatherStatus {
    if (!this.snapshot) return this.failed ? 'synthetic' : 'loading';
    return this.now() - this.snapshot.fetchedAt > STALE_AFTER_MS ? 'stale' : 'live';
  }

  getUpdatedAt(): Timestamp | null {
    return this.snapshot?.fetchedAt ?? null;
  }

  /** true si el instante está cubierto por datos reales. */
  hasRealDataAt(time: Timestamp): boolean {
    return this.series.length > 1 && time >= this.series[0].time && time <= this.series[this.series.length - 1].time;
  }

  conditionsAt(time: Timestamp): OutsideConditions {
    if (!this.hasRealDataAt(time)) return this.synthetic.conditionsAt(time);
    const s = this.series;
    let hi = s.findIndex((p) => p.time >= time);
    if (hi <= 0) hi = 1;
    const a = s[hi - 1];
    const b = s[hi];
    const k = b.time === a.time ? 0 : (time - a.time) / (b.time - a.time);
    const nearest = k < 0.5 ? a : b;
    const result = { ...nearest };
    for (const field of NUMERIC_FIELDS) result[field] = a[field] + (b[field] - a[field]) * k;
    // La precipitación horaria es la acumulada en la hora anterior al punto.
    result.precipitation = b.precipitation;
    const { time: _time, ...conditions } = result;
    return conditions;
  }
}

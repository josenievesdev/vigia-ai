import { VALLEDUPAR } from '@/services/simulation/demoFarm';

import { buildOpenMeteoUrl, fetchOpenMeteo, parseOpenMeteo } from '../openMeteo';
import { WeatherService } from '../WeatherService';

// Respuesta real de Open-Meteo para Valledupar (25/09/2026, 20:15 hora local).
const fixture = require('./fixtures/valledupar.json');

const HOUR = 3600_000;

describe('Open-Meteo', () => {
  it('arma la URL con ubicación, variables, historial y zona horaria', () => {
    const url = buildOpenMeteoUrl(VALLEDUPAR);
    expect(url).toContain('latitude=10.46538');
    expect(url).toContain('longitude=-73.2531');
    expect(url).toContain('past_days=1');
    expect(url).toContain('timeformat=unixtime');
    expect(url).toContain('timezone=America%2FBogota');
    expect(url).toContain('shortwave_radiation');
  });

  it('normaliza la respuesta real', () => {
    const snap = parseOpenMeteo(fixture, 123);
    expect(snap.fetchedAt).toBe(123);
    expect(snap.hourly).toHaveLength(72);
    expect(snap.current.temperature).toBe(25.3);
    expect(snap.current.humidity).toBe(97);
    expect(snap.current.isDay).toBe(false);
    expect(snap.current.time).toBe(1790386200 * 1000);
  });

  it('rechaza respuestas incompletas o con datos inválidos', () => {
    expect(() => parseOpenMeteo({}, 0)).toThrow();
    const broken = { ...fixture, current: { ...fixture.current, temperature_2m: null } };
    expect(() => parseOpenMeteo(broken, 0)).toThrow(/temperature_2m/);
  });

  it('propaga errores HTTP', async () => {
    const fetchImpl = jest.fn(async () => ({ ok: false, status: 503 }) as Response);
    await expect(fetchOpenMeteo(VALLEDUPAR, { fetchImpl })).rejects.toThrow('HTTP 503');
  });
});

describe('WeatherService', () => {
  const snapshot = parseOpenMeteo(fixture, fixture.current.time * 1000);

  it('usa la observación actual y datos reales dentro del rango', async () => {
    const svc = new WeatherService(VALLEDUPAR, { fetcher: async () => snapshot, now: () => snapshot.fetchedAt });
    expect(await svc.refresh()).toBe('live');
    const now = svc.conditionsAt(snapshot.current.time);
    expect(now.temperature).toBeCloseTo(25.3, 5);
    expect(now.humidity).toBeCloseTo(97, 5);
    expect(svc.hasRealDataAt(snapshot.current.time - 20 * HOUR)).toBe(true);
  });

  it('interpola linealmente entre horas', () => {
    const svc = new WeatherService(VALLEDUPAR);
    svc.setSnapshot(snapshot);
    const [a, b] = snapshot.hourly;
    const mid = svc.conditionsAt((a.time + b.time) / 2);
    expect(mid.temperature).toBeCloseTo((a.temperature + b.temperature) / 2, 5);
  });

  it('fuera del rango real usa el clima de respaldo', () => {
    const svc = new WeatherService(VALLEDUPAR);
    svc.setSnapshot(snapshot);
    const far = snapshot.hourly[snapshot.hourly.length - 1].time + 10 * HOUR;
    expect(svc.hasRealDataAt(far)).toBe(false);
    expect(svc.conditionsAt(far).weatherCode).toBe(1);
  });

  it('sin red: respaldo sintético, sin lanzar errores', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const svc = new WeatherService(VALLEDUPAR, {
      fetcher: async () => {
        throw new Error('sin conexión');
      },
    });
    expect(await svc.refresh()).toBe('synthetic');
    expect(Number.isFinite(svc.conditionsAt(Date.now()).temperature)).toBe(true);
    warn.mockRestore();
  });

  it('marca como antiguos los datos de hace más de una hora', async () => {
    let clock = snapshot.fetchedAt;
    const svc = new WeatherService(VALLEDUPAR, { fetcher: async () => snapshot, now: () => clock });
    await svc.refresh();
    clock += 2 * HOUR;
    expect(svc.getStatus()).toBe('stale');
  });
});

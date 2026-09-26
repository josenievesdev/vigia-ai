import { sunPosition, sunTimes } from '../solar';

// Valledupar, Cesar (Colombia), UTC−5. Referencia: Open-Meteo para el 25/09/2026
// → salida 05:42 y puesta 17:47 hora local.
const LAT = 10.46538;
const LON = -73.2531;
const utc = (iso: string) => new Date(iso).getTime();
const MIN = 60_000;

describe('cálculo solar (NOAA)', () => {
  it('coincide con la salida y puesta del sol de Open-Meteo (±2 min)', () => {
    const t = sunTimes(utc('2026-09-25T20:15:00-05:00'), LAT, LON)!;
    expect(Math.abs(t.sunrise - utc('2026-09-25T05:42:00-05:00'))).toBeLessThanOrEqual(2 * MIN);
    expect(Math.abs(t.sunset - utc('2026-09-25T17:47:00-05:00'))).toBeLessThanOrEqual(2 * MIN);
  });

  it('el crepúsculo civil rodea la salida y la puesta', () => {
    const t = sunTimes(utc('2026-09-25T12:00:00-05:00'), LAT, LON)!;
    expect(t.dawn).toBeLessThan(t.sunrise);
    expect(t.dusk).toBeGreaterThan(t.sunset);
    expect((t.sunrise - t.dawn) / MIN).toBeGreaterThan(15);
    expect((t.sunrise - t.dawn) / MIN).toBeLessThan(30);
  });

  it('elevación: alta al mediodía, negativa a medianoche', () => {
    const noon = sunPosition(utc('2026-09-25T11:45:00-05:00'), LAT, LON);
    const midnight = sunPosition(utc('2026-09-25T23:45:00-05:00'), LAT, LON);
    expect(noon.elevation).toBeGreaterThan(75);
    expect(midnight.elevation).toBeLessThan(-60);
  });

  it('azimut: el sol sale por el este y se pone por el oeste', () => {
    const morning = sunPosition(utc('2026-09-25T07:00:00-05:00'), LAT, LON);
    const evening = sunPosition(utc('2026-09-25T17:00:00-05:00'), LAT, LON);
    expect(morning.azimuth).toBeGreaterThan(60);
    expect(morning.azimuth).toBeLessThan(120);
    expect(evening.azimuth).toBeGreaterThan(240);
    expect(evening.azimuth).toBeLessThan(300);
  });
});

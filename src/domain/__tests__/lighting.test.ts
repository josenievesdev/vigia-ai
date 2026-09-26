import { lightState, NATURAL_LIGHT } from '../lighting';
import type { FarmLocation } from '../location';

const VALLEDUPAR: FarmLocation = {
  name: 'Valledupar',
  region: 'Cesar',
  country: 'Colombia',
  latitude: 10.46538,
  longitude: -73.2531,
  elevation: 160,
  timezone: 'America/Bogota',
};

// Hora local de Colombia (UTC−5). Salida del sol ≈ 05:42, puesta ≈ 17:47.
const at = (hhmm: string) => new Date(`2026-09-25T${hhmm}:00-05:00`).getTime();
const EXTENDED = { type: 'extended', startHour: 5, endHour: 21 } as const;

describe('estado de luz', () => {
  it('luz natural: día al mediodía, noche tras el ocaso', () => {
    const noon = lightState(at('12:00'), VALLEDUPAR, NATURAL_LIGHT);
    const night = lightState(at('19:00'), VALLEDUPAR, NATURAL_LIGHT);
    expect(noon.isLightPeriod).toBe(true);
    expect(noon.natural).toBe(1);
    expect(night.isLightPeriod).toBe(false);
    expect(night.natural).toBe(0);
    expect(night.artificialWanted).toBe(false);
  });

  it('las aves "despiertan" poco antes de la salida del sol', () => {
    expect(lightState(at('05:25'), VALLEDUPAR, NATURAL_LIGHT).isLightPeriod).toBe(false);
    expect(lightState(at('05:40'), VALLEDUPAR, NATURAL_LIGHT).isLightPeriod).toBe(true);
  });

  it('calcula minutos desde el inicio y hasta el fin del periodo de luz', () => {
    const s = lightState(at('07:00'), VALLEDUPAR, NATURAL_LIGHT);
    expect(s.minutesSinceStart!).toBeGreaterThan(80);
    expect(s.minutesSinceStart!).toBeLessThan(100);
    expect(s.minutesUntilEnd!).toBeGreaterThan(640);
  });

  it('programa extendido: lámparas solo cuando falta luz dentro de la ventana', () => {
    expect(lightState(at('04:30'), VALLEDUPAR, EXTENDED).artificialWanted).toBe(false); // antes de las 5
    expect(lightState(at('05:10'), VALLEDUPAR, EXTENDED).artificialWanted).toBe(true); // aún oscuro
    expect(lightState(at('12:00'), VALLEDUPAR, EXTENDED).artificialWanted).toBe(false); // hay sol
    const evening = lightState(at('20:00'), VALLEDUPAR, EXTENDED);
    expect(evening.artificialWanted).toBe(true);
    expect(evening.isLightPeriod).toBe(true);
    expect(evening.minutesUntilEnd).toBeCloseTo(60, 0);
    expect(lightState(at('21:30'), VALLEDUPAR, EXTENDED).isLightPeriod).toBe(false);
  });
});

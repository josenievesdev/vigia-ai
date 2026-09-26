import { lightHoursForDay, NATURAL_LIGHT } from '@/domain/lighting';
import { layingHensProfile } from '@/domain/profiles/layingHens';
import { VALLEDUPAR } from '@/services/simulation/demoFarm';

import { ConditionsAccumulator } from '../conditions';
import { drawDeaths, expectedLayingRate, layingFactors, layingProgress, productionDay } from '../model';
import type { DayConditions } from '../types';

const P = layingHensProfile.production;
const calm: DayConditions = {
  lightHours: 16,
  heatDegreeHours: 0,
  maxTemperature: 26,
  meanTemperature: 22,
  waterOutageHours: 0,
  feedOutageHours: 0,
  sickHours: 0,
};
const fixedRng = () => 0.5;
const day = (previous: DayConditions, current: DayConditions = calm) =>
  productionDay({ profile: P, day: 0, ageWeeks: 38, hens: 1200, previous, current, source: 'weather', rng: fixedRng });

describe('modelo de producción', () => {
  it('curva de postura: pico a las ~30 semanas y descenso gradual', () => {
    expect(expectedLayingRate(P, 18)).toBeLessThan(0.1);
    expect(expectedLayingRate(P, 30)).toBeCloseTo(0.95, 2);
    expect(expectedLayingRate(P, 38)).toBeGreaterThan(0.9);
    expect(expectedLayingRate(P, 70)).toBeCloseTo(0.8, 2);
  });

  it('condiciones ideales: postura cercana a la esperada y conversión típica', () => {
    const d = day(calm);
    expect(d.layingRate).toBeCloseTo(d.expectedRate, 2);
    expect(d.eggs).toBeGreaterThan(1080);
    expect(d.feedConversion).toBeGreaterThan(1.7);
    expect(d.feedConversion).toBeLessThan(2.3);
  });

  it('luz natural del trópico (~12 h) reduce la postura frente a un programa de 16 h', () => {
    const natural = lightHoursForDay(new Date(2026, 8, 25, 12).getTime(), VALLEDUPAR, NATURAL_LIGHT);
    expect(natural).toBeGreaterThan(12);
    expect(natural).toBeLessThan(13.2);
    const short = day({ ...calm, lightHours: natural });
    expect(short.eggs).toBeLessThan(day(calm).eggs);
    expect(short.factors.light).toBeGreaterThan(0.85);
  });

  it('el calor de AYER baja la postura de HOY y achica el huevo', () => {
    const hot = day({ ...calm, heatDegreeHours: 40 });
    expect(hot.factors.heat).toBeLessThan(0.9);
    expect(hot.eggs).toBeLessThan(day(calm).eggs * 0.92);
    expect(hot.eggWeight).toBeLessThan(day(calm).eggWeight);
  });

  it('un corte de agua largo desploma la postura y eleva la mortalidad', () => {
    const drought = day({ ...calm, waterOutageHours: 8 }, { ...calm, waterOutageHours: 14 });
    expect(drought.factors.water).toBeCloseTo(0.36, 2);
    expect(drought.mortality).toBeGreaterThan(day(calm).mortality);
  });

  it('con calor comen menos y beben más', () => {
    const hot = day(calm, { ...calm, meanTemperature: 30, maxTemperature: 37 });
    expect(hot.feedPerBird).toBeLessThan(P.feedGramsPerBird);
    expect(hot.waterPerBird).toBeGreaterThan(P.waterMlPerBird * 1.3);
  });

  it('los huevos se ponen sobre todo en la mañana', () => {
    const dawn = new Date(2026, 8, 25, 5, 30).getTime();
    const at = (h: number) => layingProgress(new Date(2026, 8, 25, h).getTime(), dawn);
    expect(at(5)).toBeLessThan(0.05);
    expect(at(10)).toBeGreaterThan(0.45);
    expect(at(13)).toBeGreaterThan(0.95);
  });

  it('acumula condiciones: grados-hora de calor con agravante de humedad', () => {
    const acc = new ConditionsAccumulator(P);
    acc.add({ temperature: 32, humidity: 60 }, 2); // (32 − 30) °C × 2 h = 4
    acc.add({ temperature: 32, humidity: 80 }, 1); // (32 + 1) − 30 = 3
    acc.add({ temperature: 20, humidity: 90, waterLevel: 2 }, 3);
    const c = acc.result(12);
    expect(c.heatDegreeHours).toBeCloseTo(7, 5);
    expect(c.maxTemperature).toBe(32);
    expect(c.waterOutageHours).toBe(3);
    expect(c.meanTemperature).toBeCloseTo((32 * 3 + 20 * 3) / 6, 5);
  });

  it('factores sin pérdidas en condiciones ideales', () => {
    const f = layingFactors(P, calm);
    expect(f).toEqual({ light: 1, heat: 1, water: 1, feed: 1, health: 1 });
  });

  it('muertes enteras: la fracción se sortea y se respetan las ya conocidas', () => {
    expect(drawDeaths(2.3, () => 0.2)).toBe(3);
    expect(drawDeaths(2.3, () => 0.4)).toBe(2);
    expect(drawDeaths(0, () => 0)).toBe(0);
    const known = productionDay({
      profile: P,
      day: 0,
      ageWeeks: 38,
      hens: 1200,
      previous: calm,
      current: calm,
      source: 'weather',
      rng: fixedRng,
      deaths: 4,
    });
    expect(known.mortality).toBe(4);
  });
});

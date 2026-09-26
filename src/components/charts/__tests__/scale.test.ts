import { formatTimeShort } from '@/utils/format';

import { linearScale, niceDomain, timeTicks } from '../scale';

describe('escalas de gráficas', () => {
  it('mapea linealmente dominio → rango (eje Y invertido)', () => {
    const y = linearScale(0, 100, 200, 0);
    expect(y(0)).toBe(200);
    expect(y(50)).toBe(100);
    expect(y(100)).toBe(0);
  });

  it('redondea el dominio a números limpios', () => {
    const { domain, ticks } = niceDomain(16.3, 33.1);
    expect(domain).toEqual([15, 35]);
    expect(ticks).toEqual([15, 20, 25, 30, 35]);
  });

  it('maneja series planas', () => {
    const { domain } = niceDomain(20, 20);
    expect(domain[0]).toBeLessThan(20);
    expect(domain[1]).toBeGreaterThan(20);
  });

  it('alinea las marcas de tiempo a horas locales', () => {
    const from = new Date(2026, 0, 1, 2, 7).getTime();
    const to = new Date(2026, 0, 1, 8, 7).getTime();
    const labels = timeTicks(from, to).map((t) => new Date(t).getHours());
    expect(labels).toEqual([4, 6, 8]);
  });
});

describe('formatTimeShort', () => {
  const now = new Date(2026, 0, 10, 9, 30).getTime();
  it('muestra la hora si es hoy, "ayer" o la fecha', () => {
    expect(formatTimeShort(new Date(2026, 0, 10, 7, 5).getTime(), now)).toBe('07:05');
    expect(formatTimeShort(new Date(2026, 0, 9, 21, 0).getTime(), now)).toBe('ayer 21:00');
    expect(formatTimeShort(new Date(2026, 0, 7, 8, 0).getTime(), now)).toBe('07/01 08:00');
  });
});

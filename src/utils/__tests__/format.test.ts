import { formatCount, formatDayMonth, formatPercent, formatWeekday } from '../format';

describe('formatos en español', () => {
  it('separa miles con punto', () => {
    expect(formatCount(915)).toBe('915');
    expect(formatCount(1200)).toBe('1.200');
    expect(formatCount(1184.4)).toBe('1.184');
    expect(formatCount(200_000)).toBe('200.000');
    expect(formatCount(1_234_567)).toBe('1.234.567');
  });

  it('porcentajes y fechas cortas', () => {
    expect(formatPercent(0.746, 1)).toBe('74.6 %');
    expect(formatPercent(0.9)).toBe('90 %');
    const thursday = new Date(2026, 8, 24, 10).getTime();
    expect(formatDayMonth(thursday)).toBe('24/09');
    expect(formatWeekday(thursday)).toBe('jue 24/09');
  });
});

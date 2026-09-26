import {
  calibration,
  compareDays,
  type DailyEstimate,
  dateKey,
  eggsFromTrays,
  layingDrop,
  type ProductionRecord,
  shiftDate,
  validateRecord,
} from '../records';

const record = (date: string, eggs: number, patch: Partial<ProductionRecord> = {}): ProductionRecord => ({
  zoneId: 'z1',
  date,
  eggsCollected: eggs,
  eggsBroken: 0,
  eggsFloor: 0,
  eggsDirty: 0,
  deaths: 0,
  feedKg: null,
  notes: null,
  ...patch,
});

/** 20 días de estimados de 1.000 huevos para 1.200 gallinas, hasta el 26/09. */
const estimates: DailyEstimate[] = Array.from({ length: 20 }, (_, i) => ({
  date: shiftDate('2026-09-26', i - 19),
  eggs: 1000,
  hens: 1200,
}));

describe('registro diario de producción', () => {
  it('fechas locales y cubetas de 30', () => {
    expect(dateKey(new Date(2026, 8, 26, 23, 30).getTime())).toBe('2026-09-26');
    expect(shiftDate('2026-10-01', -1)).toBe('2026-09-30');
    expect(eggsFromTrays(35, 3)).toBe(1053);
  });

  it('valida el conteo con mensajes en español', () => {
    const today = '2026-09-26';
    expect(validateRecord(record(today, 1053), 1200, today)).toEqual([]);
    expect(validateRecord(record(today, 10, { eggsBroken: 6, eggsFloor: 5 }), 1200, today)).toContain(
      'Rotos, de piso y sucios no pueden sumar más que el total recogido.',
    );
    expect(validateRecord(record(today, 1500), 1200, today)[0]).toMatch(/más huevos/);
    expect(validateRecord(record('2026-09-27', 900), 1200, today)).toContain('No se puede registrar un día que aún no llega.');
    expect(validateRecord(record('2026-09-10', 900), 1200, today)[0]).toMatch(/últimos 7 días/);
    expect(validateRecord(record(today, 900, { feedKg: 900 }), 1200, today)[0]).toMatch(/300 g por ave/);
    expect(validateRecord(record(today, 900, { deaths: 1300 }), 1200, today)).toContain(
      'Las muertes no pueden ser más que las aves del galpón.',
    );
  });

  it('compara lo real con lo estimado día a día', () => {
    const [yesterday, today] = compareDays(estimates.slice(-2), [record('2026-09-26', 950)]);
    expect(yesterday.record).toBeNull();
    expect(yesterday.deviation).toBeNull();
    expect(today.realRate).toBeCloseTo(950 / 1200, 5);
    expect(today.deviation).toBeCloseTo(-0.05, 5);
  });

  it('se ajusta a la granja con 5 o más días registrados', () => {
    const four = compareDays(estimates, estimates.slice(-4).map((e) => record(e.date, 930)));
    expect(calibration(four)).toBeNull();
    const ten = compareDays(estimates, estimates.slice(-10).map((e) => record(e.date, 930)));
    expect(calibration(ten)).toEqual({ factor: 0.93, days: 10 });
  });

  it('avisa una caída que el clima no explica, frente a lo normal de esa granja', () => {
    // La granja rinde normalmente el 93 % de lo estimado; los dos últimos días cae al 80 %.
    const normal = estimates.slice(-12, -2).map((e) => record(e.date, 930));
    const drop = estimates.slice(-2).map((e) => record(e.date, 800));
    const drop2 = layingDrop(compareDays(estimates, [...normal, ...drop]), '2026-09-26');
    expect(drop2?.days).toBe(2);
    expect(drop2?.deviation).toBeCloseTo(800 / 930 - 1, 5);

    // Rendir siempre un 7 % menos no es una caída: es lo normal de esa granja.
    const steady = estimates.slice(-12).map((e) => record(e.date, 930));
    expect(layingDrop(compareDays(estimates, steady), '2026-09-26')).toBeNull();

    // Un solo día malo, o registros viejos, no avisan.
    const oneBad = [...normal, record('2026-09-25', 930), record('2026-09-26', 800)];
    expect(layingDrop(compareDays(estimates, oneBad), '2026-09-26')).toBeNull();
    expect(layingDrop(compareDays(estimates, [...normal, ...drop]), '2026-09-29')).toBeNull();
  });
});

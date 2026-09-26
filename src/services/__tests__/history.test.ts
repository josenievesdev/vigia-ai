import { RuleEngine } from '@/engine/RuleEngine';
import { computeStats, downsample, hourlySummary, splitSegments } from '@/services/history/analytics';
import { InMemoryHistory } from '@/services/history/InMemoryHistory';
import { FarmRuntime } from '@/services/runtime/FarmRuntime';
import { demoFarmSetup } from '@/services/simulation/demoFarm';
import { SimulatedSource } from '@/services/simulation/SimulatedSource';
import type { TelemetryBatch } from '@/services/telemetry/TelemetrySource';
import { farmActions, farmStore } from '@/store/farmStore';

const MIN = 60_000;
const HOUR = 60 * MIN;
const T0 = new Date(2026, 0, 1, 8, 0, 0).getTime();

const batch = (t: number, value: number | null, fanOn = false, fanChangedAt = T0): TelemetryBatch => ({
  timestamp: t,
  readings: value === null ? [] : [{ sensorId: 's1', value, timestamp: t }],
  sensorStatus: [{ sensorId: 's1', online: value !== null, lastSeenAt: value === null ? null : t }],
  actuators: [{ actuatorId: 'fan', active: fanOn, changedAt: fanChangedAt }],
});

describe('InMemoryHistory', () => {
  it('promedia lecturas dentro del mismo minuto', () => {
    const h = new InMemoryHistory();
    h.append(batch(T0, 20));
    h.append(batch(T0 + 20_000, 22));
    h.append(batch(T0 + 40_000, 24));
    h.append(batch(T0 + MIN, 30));
    const s = h.series('s1', T0, T0 + HOUR);
    expect(s).toHaveLength(2);
    expect(s[0].v).toBeCloseTo(22);
    expect(s[1].v).toBe(30);
  });

  it('marca cortes cuando el sensor se desconecta', () => {
    const h = new InMemoryHistory();
    h.append(batch(T0, 20));
    h.append(batch(T0 + MIN, null));
    h.append(batch(T0 + 2 * MIN, null));
    h.append(batch(T0 + 3 * MIN, 21));
    const s = h.series('s1', T0, T0 + HOUR);
    expect(s.map((p) => (Number.isNaN(p.v) ? 'gap' : p.v))).toEqual([20, 'gap', 21]);
    expect(splitSegments(s)).toHaveLength(2);
  });

  it('registra intervalos de encendido de los equipos', () => {
    const h = new InMemoryHistory();
    h.append(batch(T0, 20, false));
    h.append(batch(T0 + MIN, 20, true, T0 + 30_000));
    h.append(batch(T0 + 5 * MIN, 20, false, T0 + 5 * MIN));
    h.append(batch(T0 + 9 * MIN, 20, true, T0 + 9 * MIN));
    expect(h.actuatorIntervals('fan', T0, T0 + HOUR)).toEqual([
      { start: T0 + 30_000, end: T0 + 5 * MIN },
      { start: T0 + 9 * MIN, end: null },
    ]);
  });

  it('descarta datos fuera de la retención', () => {
    const h = new InMemoryHistory({ retentionMs: 10 * MIN });
    for (let i = 0; i <= 30; i++) h.append(batch(T0 + i * MIN, i));
    const s = h.series('s1', 0, Infinity);
    expect(s[0].t).toBe(T0 + 20 * MIN);
  });

  it('notifica a los suscriptores y cambia de versión', () => {
    const h = new InMemoryHistory();
    const listener = jest.fn();
    const unsubscribe = h.subscribe(listener);
    const v0 = h.getVersion();
    h.append(batch(T0, 20));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(h.getVersion()).toBe(v0 + 1);
    unsubscribe();
    h.append(batch(T0 + MIN, 20));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('analytics', () => {
  it('calcula estadísticas ponderadas por tiempo y % en rango', () => {
    // 20 °C durante 3 h y 30 °C durante 1 h.
    const points = [
      { t: 0, v: 20 },
      { t: HOUR, v: 20 },
      { t: 2 * HOUR, v: 20 },
      { t: 3 * HOUR, v: 30 },
    ].flatMap((p) => Array.from({ length: 60 }, (_, i) => ({ t: p.t + i * MIN, v: p.v })));
    const stats = computeStats(points, { min: 18, max: 26 })!;
    expect(stats.min).toBe(20);
    expect(stats.max).toBe(30);
    expect(stats.avg).toBeCloseTo(22.5, 1);
    expect(stats.inRangePct).toBeCloseTo(75, 0);
    expect(stats.last).toBe(30);
  });

  it('ignora cortes y devuelve null sin datos', () => {
    expect(computeStats([{ t: 0, v: NaN }])).toBeNull();
  });

  it('resume por hora, más reciente primero', () => {
    const points = Array.from({ length: 120 }, (_, i) => ({ t: T0 + i * MIN, v: i < 60 ? 10 : 20 }));
    const rows = hourlySummary(points);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ hour: T0 + HOUR, min: 20, max: 20 });
    expect(rows[1]).toMatchObject({ hour: T0, min: 10, max: 10 });
  });

  it('reduce puntos conservando los cortes', () => {
    const points = Array.from({ length: 1000 }, (_, i) => ({ t: i * MIN, v: i === 500 ? NaN : i }));
    const out = downsample(points, 100);
    expect(out.length).toBeLessThanOrEqual(101);
    expect(out.some((p) => Number.isNaN(p.v))).toBe(true);
  });
});

describe('historia previa simulada', () => {
  it('genera 24 h de historia con decisiones y sin alertas', async () => {
    farmActions.reset();
    const start = new Date(2026, 0, 2, 8, 0, 0).getTime();
    const source = new SimulatedSource({ setup: demoFarmSetup, startTime: start, seed: 11 });
    const runtime = new FarmRuntime(source, new RuleEngine(), demoFarmSetup, { primeSeconds: 24 * 3600 });

    const t0 = performance.now();
    await runtime.start();
    const elapsed = performance.now() - t0;
    source.stop();

    const temp = runtime.history.series(`${demoFarmSetup.farm.zones[0].id}:temperature`, 0, Infinity);
    expect(temp.length).toBeGreaterThan(1400);
    expect(temp[0].t).toBeLessThanOrEqual(start - 23 * HOUR);
    expect(farmStore.getState().now).toBe(start);
    expect(farmStore.getState().alerts).toEqual([]);
    expect(farmStore.getState().decisions.length).toBeGreaterThan(5);
    // Referencia de rendimiento (Node, ~40 ms): el arranque debe ser rápido.
    expect(elapsed).toBeLessThan(3000);
  });
});

import { computeHealth, reconcileAlerts } from '../alerts/AlertManager';
import type { KeyedAlertSignal } from '../types';

const signal = (overrides: Partial<KeyedAlertSignal> = {}): KeyedAlertSignal => ({
  key: 'highTemperature:z1:',
  zoneId: 'z1',
  type: 'highTemperature',
  severity: 'warning',
  title: 'Temperatura elevada',
  message: '30°C',
  ...overrides,
});

const opts = { resolveAfterMs: 60_000 };

describe('reconcileAlerts', () => {
  it('crea una alerta nueva y no la duplica en ciclos siguientes', () => {
    const first = reconcileAlerts([], [signal()], 0, opts);
    expect(first.created).toHaveLength(1);
    const second = reconcileAlerts(first.active, [signal()], 1000, opts);
    expect(second.created).toHaveLength(0);
    expect(second.active).toHaveLength(1);
    expect(second.active[0].id).toBe(first.active[0].id);
  });

  it('escala la severidad sin crear otra alerta', () => {
    const first = reconcileAlerts([], [signal()], 0, opts);
    const next = reconcileAlerts(first.active, [signal({ severity: 'critical', message: '33°C' })], 1000, opts);
    expect(next.active[0]).toMatchObject({ severity: 'critical', message: '33°C', updatedAt: 1000 });
  });

  it('resuelve solo tras el tiempo de gracia (anti-parpadeo)', () => {
    const first = reconcileAlerts([], [signal()], 0, opts);
    const gap = reconcileAlerts(first.active, [], 30_000, opts);
    expect(gap.active).toHaveLength(1);
    expect(gap.resolved).toHaveLength(0);
    const done = reconcileAlerts(gap.active, [], 60_000, opts);
    expect(done.active).toHaveLength(0);
    expect(done.resolved[0]).toMatchObject({ status: 'resolved', resolvedAt: 60_000 });
  });

  it('calcula el estado general', () => {
    const { active } = reconcileAlerts(
      [],
      [signal(), signal({ key: 'lowWater:z1:', type: 'lowWater', severity: 'critical' })],
      0,
      opts,
    );
    expect(computeHealth([])).toBe('normal');
    expect(computeHealth(active.slice(0, 1))).toBe('warning');
    expect(computeHealth(active)).toBe('critical');
  });
});

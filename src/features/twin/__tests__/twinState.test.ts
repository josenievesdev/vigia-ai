import { lightState, NATURAL_LIGHT } from '@/domain/lighting';
import { layingHensProfile } from '@/domain/profiles/layingHens';
import type { Alert } from '@/domain/types';
import { VALLEDUPAR } from '@/services/simulation/demoFarm';
import { syntheticConditions } from '@/services/weather/syntheticWeather';

import { buildTwinState, type TwinInput } from '../twinState';

const noon = new Date(2026, 0, 1, 12, 0).getTime();
const midnight = new Date(2026, 0, 1, 0, 0).getTime();
const lightAt = (t: number) => lightState(t, VALLEDUPAR, NATURAL_LIGHT);

const ids = {
  temperature: 'z:temperature',
  humidity: 'z:humidity',
  light: 'z:light',
  waterLevel: 'z:waterLevel',
  feedLevel: 'z:feedLevel',
  animalActivity: 'z:animalActivity',
};

function input(overrides: Partial<TwinInput> = {}): TwinInput {
  return {
    now: noon,
    profile: layingHensProfile,
    light: lightAt(noon),
    lighting: NATURAL_LIGHT,
    outside: syntheticConditions(noon, VALLEDUPAR),
    readings: {
      temperature: { value: 23, online: true },
      humidity: { value: 60, online: true },
      light: { value: 360, online: true },
      waterLevel: { value: 80, online: true },
      feedLevel: { value: 60, online: true },
      animalActivity: { value: 70, online: true },
    },
    actuators: { lighting: true },
    alerts: [],
    sensorIds: ids,
    ...overrides,
  };
}

const alert = (type: Alert['type'], severity: Alert['severity'], sensorId?: string): Alert => ({
  id: type,
  key: type,
  type,
  severity,
  zoneId: 'z',
  sensorId,
  title: type,
  message: type,
  status: 'active',
  createdAt: 0,
  updatedAt: 0,
  lastDetectedAt: 0,
});

describe('buildTwinState', () => {
  it('estado normal de día', () => {
    const s = buildTwinState(input());
    expect(s.daylight).toBeCloseTo(1);
    expect(s.sun.elevation).toBeGreaterThan(40);
    expect(s.flock.heatStress).toBe(0);
    expect(s.flock.sickness).toBe(0);
    expect(s.lampsOn).toBe(true);
    expect(s.resting).toBe(false);
    expect(s.waterLevel).toBeCloseTo(0.8);
    expect(s.activity).toBeCloseTo(0.7);
    expect(s.elements.every((e) => e.status === 'normal')).toBe(true);
    expect(Object.values(s.alerts).every((a) => a === null)).toBe(true);
  });

  it('de noche las aves descansan y no hay luz natural', () => {
    const s = buildTwinState(input({ now: midnight, light: lightAt(midnight), actuators: {} }));
    expect(s.daylight).toBe(0);
    expect(s.resting).toBe(true);
    expect(s.lampsOn).toBe(false);
  });

  it('asigna cada alerta a su elemento con la severidad más alta', () => {
    const s = buildTwinState(
      input({
        readings: { ...input().readings, temperature: { value: 33, online: true } },
        alerts: [alert('highTemperature', 'critical', ids.temperature), alert('lowWater', 'warning', ids.waterLevel)],
      }),
    );
    expect(s.alerts.climate).toBe('critical');
    expect(s.alerts.water).toBe('warning');
    expect(s.climateStatus).toBe('critical');
    expect(s.elements.find((e) => e.id === 'water')?.status).toBe('warning');
  });

  it('un sensor caído marca su elemento y su nodo como desconectados', () => {
    const s = buildTwinState(
      input({
        readings: { ...input().readings, feedLevel: { value: undefined, online: false } },
        alerts: [alert('sensorOffline', 'warning', ids.feedLevel)],
      }),
    );
    expect(s.sensors.find((n) => n.kind === 'feedLevel')?.status).toBe('offline');
    expect(s.feedLevel).toBeNull();
    expect(s.alerts.feeder).toBe('warning');
    expect(s.alerts.climate).toBeNull();
  });

  it('refleja los equipos activos', () => {
    const s = buildTwinState(input({ actuators: { ventilation: true, waterPump: true, feeder: true } }));
    expect(s.fanActive && s.pumpActive && s.feederActive).toBe(true);
    expect(s.elements.find((e) => e.id === 'water')?.value).toContain('bomba activa');
  });

  it('calor con humedad alta: estrés térmico mayor', () => {
    const hot = (humidity: number) =>
      buildTwinState(
        input({
          readings: {
            ...input().readings,
            temperature: { value: 30, online: true },
            humidity: { value: humidity, online: true },
          },
        }),
      ).flock.heatStress;
    expect(hot(50)).toBeGreaterThan(0.5);
    expect(hot(90)).toBeGreaterThan(hot(50));
  });

  it('baja actividad de día sin causa ambiental = decaimiento', () => {
    const s = buildTwinState(input({ readings: { ...input().readings, animalActivity: { value: 12, online: true } } }));
    expect(s.flock.sickness).toBeGreaterThan(0.5);
  });

  it('lluvia real se refleja en la escena', () => {
    const outside = { ...syntheticConditions(noon, VALLEDUPAR), weatherCode: 63, precipitation: 2 };
    expect(buildTwinState(input({ outside })).rain).toBeGreaterThan(0.5);
    expect(buildTwinState(input()).rain).toBe(0);
  });
});

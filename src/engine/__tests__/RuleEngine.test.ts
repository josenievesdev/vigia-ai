import type { LightingProgram, LightState } from '@/domain/lighting';
import { layingHensProfile } from '@/domain/profiles/layingHens';
import type { ActuatorKind, ActuatorMode, SensorKind } from '@/domain/types';
import { demoFarmSetup } from '@/services/simulation/demoFarm';

import { RuleEngine } from '../RuleEngine';
import type { ZoneContext } from '../types';

const zone = demoFarmSetup.farm.zones[0];

/** Día simple: luz natural de 6:00 a 18:00. */
function lightAt(hour: number, artificialWanted = false): LightState {
  const isDay = hour >= 6 && hour < 18;
  const isLightPeriod = isDay || artificialWanted;
  return {
    sunElevation: isDay ? 45 : -30,
    sunAzimuth: 90,
    natural: isDay ? 1 : 0,
    artificialWanted,
    isLightPeriod,
    minutesSinceStart: isLightPeriod ? (hour - 6) * 60 : null,
    minutesUntilEnd: isLightPeriod ? (18 - hour) * 60 : null,
    sun: null,
  };
}

function makeContext(options: {
  readings?: Partial<Record<SensorKind, number>>;
  active?: Partial<Record<ActuatorKind, boolean>>;
  modes?: Partial<Record<ActuatorKind, ActuatorMode>>;
  hour?: number;
  offline?: SensorKind[];
  artificialWanted?: boolean;
  lighting?: LightingProgram;
}): ZoneContext {
  const hour = options.hour ?? 12;
  const now = new Date(2026, 0, 1, hour, 0, 0).getTime();
  const readings = {
    temperature: 23,
    humidity: 60,
    light: 200,
    waterLevel: 80,
    feedLevel: 60,
    animalActivity: 70,
    ...options.readings,
  };
  const offline = new Set(options.offline ?? []);
  return {
    now,
    hour,
    light: lightAt(hour, options.artificialWanted),
    zone: { ...zone, lighting: options.lighting ?? zone.lighting },
    profile: layingHensProfile,
    readings: Object.fromEntries(Object.entries(readings).filter(([k]) => !offline.has(k as SensorKind))),
    sensors: demoFarmSetup.sensors.map((sensor) => ({
      sensor,
      online: !offline.has(sensor.kind),
      lastSeenAt: offline.has(sensor.kind) ? null : now,
    })),
    actuators: Object.fromEntries(
      demoFarmSetup.actuators.map((actuator) => [
        actuator.kind,
        {
          actuator,
          active: options.active?.[actuator.kind] ?? false,
          mode: options.modes?.[actuator.kind] ?? 'auto',
        },
      ]),
    ),
  };
}

const engine = new RuleEngine();
const idOf = (kind: ActuatorKind) => `${zone.id}:${kind}`;

describe('RuleEngine', () => {
  it('no hace nada en condiciones normales', () => {
    const result = engine.evaluate([makeContext({})]);
    expect(result.commands).toEqual([]);
    expect(result.alertSignals).toEqual([]);
  });

  it('activa la ventilación sobre el umbral y registra la decisión', () => {
    const result = engine.evaluate([makeContext({ readings: { temperature: 27.5 } })]);
    expect(result.commands).toEqual([{ actuatorId: idOf('ventilation'), active: true }]);
    expect(result.decisions[0]).toMatchObject({ source: 'rule', ruleId: 'control.ventilation' });
    expect(result.decisions[0].reason).toContain('27.5°C');
  });

  it('respeta la histéresis: no apaga la ventilación entre los umbrales', () => {
    const result = engine.evaluate([makeContext({ readings: { temperature: 25.5 }, active: { ventilation: true } })]);
    expect(result.commands).toEqual([]);
  });

  it('apaga la ventilación bajo el umbral de apagado', () => {
    const result = engine.evaluate([makeContext({ readings: { temperature: 23.5 }, active: { ventilation: true } })]);
    expect(result.commands).toEqual([{ actuatorId: idOf('ventilation'), active: false }]);
  });

  it('no manda actuadores en modo manual', () => {
    const result = engine.evaluate([
      makeContext({ readings: { temperature: 30 }, modes: { ventilation: 'manual' } }),
    ]);
    expect(result.commands).toEqual([]);
    expect(result.alertSignals.map((a) => a.type)).toContain('highTemperature');
  });

  it('activa alimentador y bomba con niveles bajos', () => {
    const result = engine.evaluate([makeContext({ readings: { feedLevel: 25, waterLevel: 30 } })]);
    expect(result.commands).toEqual(
      expect.arrayContaining([
        { actuatorId: idOf('feeder'), active: true },
        { actuatorId: idOf('waterPump'), active: true },
      ]),
    );
  });

  it('luz natural: apaga lámparas encendidas en automático', () => {
    const result = engine.evaluate([makeContext({ hour: 22, active: { lighting: true } })]);
    expect(result.commands).toEqual([{ actuatorId: idOf('lighting'), active: false }]);
    expect(result.decisions[0].reason).toContain('luz natural');
  });

  it('programa extendido: enciende las lámparas cuando falta luz natural', () => {
    const lighting = { type: 'extended', startHour: 5, endHour: 21 } as const;
    const evening = engine.evaluate([makeContext({ hour: 19, lighting, artificialWanted: true })]);
    expect(evening.commands).toEqual([{ actuatorId: idOf('lighting'), active: true }]);
    const noon = engine.evaluate([makeContext({ hour: 12, lighting, active: { lighting: true } })]);
    expect(noon.commands).toEqual([{ actuatorId: idOf('lighting'), active: false }]);
  });

  it('clasifica la severidad de la temperatura', () => {
    const warn = engine.evaluate([makeContext({ readings: { temperature: 30 } })]);
    const crit = engine.evaluate([makeContext({ readings: { temperature: 33 } })]);
    expect(warn.alertSignals.find((a) => a.type === 'highTemperature')?.severity).toBe('warning');
    expect(crit.alertSignals.find((a) => a.type === 'highTemperature')?.severity).toBe('critical');
  });

  it('alerta baja actividad solo durante el periodo de luz', () => {
    const day = engine.evaluate([makeContext({ readings: { animalActivity: 15 } })]);
    const night = engine.evaluate([makeContext({ hour: 23, readings: { animalActivity: 15 } })]);
    const dusk = engine.evaluate([makeContext({ hour: 17.5, readings: { animalActivity: 15 } })]);
    expect(dusk.alertSignals.find((a) => a.type === 'lowActivity')).toBeUndefined();
    expect(day.alertSignals.find((a) => a.type === 'lowActivity')?.severity).toBe('critical');
    expect(night.alertSignals.find((a) => a.type === 'lowActivity')).toBeUndefined();
  });

  it('alerta sensor desconectado y no actúa sin datos', () => {
    const result = engine.evaluate([makeContext({ offline: ['temperature'] })]);
    expect(result.alertSignals).toEqual([
      expect.objectContaining({ type: 'sensorOffline', sensorId: `${zone.id}:temperature` }),
    ]);
    expect(result.commands).toEqual([]);
  });
});

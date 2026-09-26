import { RuleEngine } from '@/engine/RuleEngine';
import { FarmRuntime } from '@/services/runtime/FarmRuntime';
import { demoFarmSetup } from '@/services/simulation/demoFarm';
import { SimulatedSource } from '@/services/simulation/SimulatedSource';
import { farmActions, farmStore } from '@/store/farmStore';
import { selectReading } from '@/store/selectors';

const zoneId = demoFarmSetup.farm.zones[0].id;

/** Deja correr las confirmaciones (microtasks) de los actuadores. */
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

async function createLoop(startHour = 10) {
  farmActions.reset();
  const start = new Date(2026, 0, 1, startHour, 0, 0).getTime();
  const source = new SimulatedSource({ setup: demoFarmSetup, startTime: start, seed: 42 });
  const runtime = new FarmRuntime(source, new RuleEngine(), demoFarmSetup);
  await runtime.start();
  source.stop(); // controlamos el tiempo manualmente
  const run = async (minutes: number) => {
    for (let i = 0; i < minutes; i++) {
      source.advance(60);
      await flush();
    }
  };
  return { source, runtime, run };
}

const reading = (kind: Parameters<typeof selectReading>[2]) =>
  selectReading(farmStore.getState(), zoneId, kind).value;
const isActive = (kind: string) => farmStore.getState().actuatorStates[`${zoneId}:${kind}`]?.active;
const alertTypes = () => farmStore.getState().alerts.map((a) => a.type);

describe('circuito simulación → motor → actuadores', () => {
  it('enciende la iluminación de día y registra la decisión', async () => {
    const { run } = await createLoop(10);
    await run(1);
    expect(isActive('lighting')).toBe(true);
    expect(farmStore.getState().decisions.some((d) => d.ruleId === 'control.lighting')).toBe(true);
  });

  it('ola de calor: activa ventilación y genera alerta crítica', async () => {
    const { runtime, run } = await createLoop(11);
    runtime.setScenario('heatWave', true);
    await run(90);
    expect(isActive('ventilation')).toBe(true);
    expect(reading('temperature')!).toBeGreaterThan(32);
    expect(farmStore.getState().alerts.find((a) => a.type === 'highTemperature')?.severity).toBe('critical');
  });

  it('falta de agua: la bomba se activa pero el nivel sigue bajando', async () => {
    const { runtime, run } = await createLoop(10);
    runtime.setScenario('waterOutage', true);
    await run(60);
    expect(isActive('waterPump')).toBe(true);
    expect(reading('waterLevel')!).toBeLessThan(20);
    expect(alertTypes()).toContain('lowWater');
  });

  it('el alimentador repone la tolva en condiciones normales', async () => {
    const { source, run } = await createLoop(10);
    source.setScenario('feedShortage', true);
    source.setScenario('feedShortage', false); // solo el efecto inicial: nivel al 24 %
    await run(90);
    expect(reading('feedLevel')!).toBeGreaterThan(40);
    expect(farmStore.getState().decisions.some((d) => d.ruleId === 'control.feeder')).toBe(true);
  });

  it('baja actividad animal genera alerta', async () => {
    const { runtime, run } = await createLoop(10);
    runtime.setScenario('lowActivity', true);
    await run(60);
    expect(alertTypes()).toContain('lowActivity');
  });

  it('sensor desconectado genera alerta y se resuelve al reconectar', async () => {
    const { runtime, run } = await createLoop(10);
    runtime.setScenario('sensorFailure', true);
    await run(1);
    expect(alertTypes()).toContain('sensorOffline');
    runtime.setScenario('sensorFailure', false);
    await run(5);
    expect(alertTypes()).not.toContain('sensorOffline');
  });

  it('el modo manual detiene la automatización de ese actuador', async () => {
    const { runtime, run } = await createLoop(11);
    await runtime.setManual(`${zoneId}:ventilation`, false);
    runtime.setScenario('heatWave', true);
    await run(60);
    expect(isActive('ventilation')).toBe(false);
    runtime.setAuto(`${zoneId}:ventilation`);
    await run(1);
    expect(isActive('ventilation')).toBe(true);
  });
});

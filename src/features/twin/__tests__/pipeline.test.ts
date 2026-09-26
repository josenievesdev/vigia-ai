import { actionCounts, createFlock, stepFlock } from '@/domain/behavior/flock';
import type { Flock, FlockAction } from '@/domain/behavior/types';
import { RuleEngine } from '@/engine/RuleEngine';
import { FarmRuntime } from '@/services/runtime/FarmRuntime';
import { demoFarmSetup } from '@/services/simulation/demoFarm';
import { SimulatedSource } from '@/services/simulation/SimulatedSource';
import { farmActions, farmStore } from '@/store/farmStore';

import { HEN_LAYOUT } from '../scene/layout';
import { behaviorWorldFor } from '../twinState';
import { twinStateFrom } from '../useTwinState';

/**
 * Cadena completa sin renderizar: simulación → store → estado del gemelo →
 * lo que perciben las aves → su comportamiento.
 */

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

async function farmAt(hour: number) {
  farmActions.reset();
  const start = new Date(2026, 0, 1, hour, 0, 0).getTime();
  const source = new SimulatedSource({ setup: demoFarmSetup, startTime: start, seed: 3 });
  const runtime = new FarmRuntime(source, new RuleEngine(), demoFarmSetup);
  await runtime.start();
  source.stop();
  const run = async (minutes: number) => {
    for (let i = 0; i < minutes; i++) {
      source.advance(60);
      await flush();
    }
  };
  return { runtime, run };
}

function flockFor(seconds: number): Flock {
  const twin = twinStateFrom(farmStore.getState());
  if (!twin) throw new Error('sin estado del gemelo');
  const world = behaviorWorldFor(twin);
  const flock = createFlock(24, HEN_LAYOUT);
  for (let t = 0; t < seconds; t += 0.1) stepFlock(flock, world, HEN_LAYOUT, 0.1);
  return flock;
}

const share = (flock: Flock, action: FlockAction) => actionCounts(flock)[action] / flock.agents.length;

describe('gemelo: de la simulación a la conducta de las aves', () => {
  it('de noche (luz natural) duermen en la percha', async () => {
    const { run } = await farmAt(22);
    await run(5);
    expect(share(flockFor(60), 'roost')).toBeGreaterThanOrEqual(0.9);
  });

  it('ola de calor: jadean junto a los ventiladores encendidos', async () => {
    const { runtime, run } = await farmAt(11);
    runtime.setScenario('heatWave', true);
    await run(90);
    const twin = twinStateFrom(farmStore.getState())!;
    expect(twin.fanActive).toBe(true);
    expect(twin.flock.heatStress).toBeGreaterThan(0.8);
    const flock = flockFor(40);
    expect(share(flock, 'pant')).toBeGreaterThanOrEqual(0.6);
  });

  it('corte de agua: se agolpan en los bebederos', async () => {
    const { runtime, run } = await farmAt(10);
    runtime.setScenario('waterOutage', true);
    await run(120);
    const twin = twinStateFrom(farmStore.getState())!;
    expect(twin.flock.waterAvailable).toBe(false);
    const flock = createFlock(24, HEN_LAYOUT);
    for (const a of flock.agents) a.needs.thirst = 0.9;
    const world = behaviorWorldFor(twin);
    for (let t = 0; t < 20; t += 0.1) stepFlock(flock, world, HEN_LAYOUT, 0.1);
    expect(share(flock, 'crowd')).toBeGreaterThanOrEqual(0.5);
  });

  it('día normal por la mañana: sin conductas de estrés', async () => {
    const { run } = await farmAt(8);
    await run(5);
    const flock = flockFor(60);
    for (const stress of ['pant', 'crowd', 'lethargic', 'huddle', 'roost'] as const) {
      expect(share(flock, stress)).toBe(0);
    }
  });
});

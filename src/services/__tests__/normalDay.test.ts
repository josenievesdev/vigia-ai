import { RuleEngine } from '@/engine/RuleEngine';
import { FarmRuntime } from '@/services/runtime/FarmRuntime';
import { demoFarmSetup } from '@/services/simulation/demoFarm';
import { SimulatedSource } from '@/services/simulation/SimulatedSource';
import { farmActions, farmStore } from '@/store/farmStore';

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('día normal', () => {
  it('24 h sin escenarios: sin alertas y con ciclos de agua y alimento', async () => {
    farmActions.reset();
    const source = new SimulatedSource({
      setup: demoFarmSetup,
      startTime: new Date(2026, 0, 1, 0, 0, 0).getTime(),
      seed: 7,
    });
    const runtime = new FarmRuntime(source, new RuleEngine(), demoFarmSetup);
    await runtime.start();
    source.stop();

    const seen = new Set<string>();
    for (let minute = 0; minute < 24 * 60; minute++) {
      source.advance(60);
      await flush();
      for (const a of farmStore.getState().alerts) seen.add(a.type);
    }

    expect([...seen]).toEqual([]);
    const rules = new Set(farmStore.getState().decisions.map((d) => d.ruleId));
    expect(rules).toEqual(new Set(['control.lighting', 'control.ventilation', 'control.feeder', 'control.waterPump']));
  });
});

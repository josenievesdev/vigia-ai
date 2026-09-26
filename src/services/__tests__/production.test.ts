import { layingHensProfile } from '@/domain/profiles/layingHens';
import { RuleEngine } from '@/engine/RuleEngine';
import { ProductionService } from '@/services/production/ProductionService';
import { FarmRuntime } from '@/services/runtime/FarmRuntime';
import { DEMO_FLOCK_AGE_WEEKS, demoFarmSetup, type FarmSetup, VALLEDUPAR } from '@/services/simulation/demoFarm';
import { SimulatedSource } from '@/services/simulation/SimulatedSource';
import { SyntheticWeather } from '@/services/weather/syntheticWeather';
import { farmActions, farmStore } from '@/store/farmStore';

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

/** La granja demo con un lote de 38 semanas respecto a la fecha de la prueba. */
function setupAt(start: Date): FarmSetup {
  const zone = demoFarmSetup.farm.zones[0];
  const hatchDate = start.getTime() - DEMO_FLOCK_AGE_WEEKS * 7 * 24 * 3600_000;
  return { ...demoFarmSetup, farm: { ...demoFarmSetup.farm, zones: [{ ...zone, hatchDate }] } };
}

async function farm(start: Date, heatWave = false) {
  farmActions.reset();
  const setup = setupAt(start);
  const weather = new SyntheticWeather(VALLEDUPAR);
  const source = new SimulatedSource({ setup, startTime: start.getTime(), seed: 5, weather });
  const production = new ProductionService({ setup, profile: layingHensProfile, weather, seed: 9 });
  const runtime = new FarmRuntime(source, new RuleEngine(), setup, { production });
  await runtime.start();
  source.stop();
  if (heatWave) runtime.setScenario('heatWave', true);
  const run = async (minutes: number, stepMinutes = 5) => {
    for (let m = 0; m < minutes; m += stepMinutes) {
      source.advance(stepMinutes * 60);
      await flush();
    }
  };
  return { run, production, runtime };
}

describe('producción: del galpón a los huevos', () => {
  it('genera 30 días de historial con postura y consumo realistas', async () => {
    const { production } = await farm(new Date(2026, 0, 15, 8, 0));
    const { days, today } = production.snapshot();
    expect(days).toHaveLength(30);
    for (const d of days) {
      expect(d.layingRate).toBeGreaterThan(0.7);
      expect(d.layingRate).toBeLessThan(0.97);
      expect(d.feedPerBird).toBeGreaterThan(90);
      expect(d.feedConversion).toBeGreaterThan(1.6);
      expect(d.feedConversion).toBeLessThan(2.6);
    }
    // Las aves configuradas son las vivas hoy; el historial suma hacia atrás las muertes.
    const population = demoFarmSetup.farm.zones[0].population;
    expect(today?.hens).toBe(population);
    const deaths = days.reduce((sum, d) => sum + d.mortality, 0);
    expect(days[0].hens).toBe(population + deaths);
    expect(farmStore.getState().production?.days).toHaveLength(30);
  });

  it('los huevos del día se acumulan durante la mañana', async () => {
    const { run, production } = await farm(new Date(2026, 0, 15, 6, 0));
    const early = production.snapshot().today!;
    await run(7 * 60);
    const midday = production.snapshot().today!;
    expect(early.eggsSoFar).toBeLessThan(early.expectedEggs * 0.1);
    expect(midday.eggsSoFar).toBeGreaterThan(midday.expectedEggs * 0.9);
  });

  it('una ola de calor hoy baja la postura de mañana (formación del huevo)', async () => {
    const tomorrowEggs = async (heatWave: boolean) => {
      const { run, production } = await farm(new Date(2026, 0, 15, 0, 0), heatWave);
      await run(24 * 60 + 30);
      const snap = production.snapshot();
      const closed = snap.days[snap.days.length - 1];
      expect(closed.source).toBe('simulation');
      return { eggs: snap.today!.expectedEggs, heat: snap.today!.factors.heat, deaths: closed.mortality };
    };
    const normal = await tomorrowEggs(false);
    const hot = await tomorrowEggs(true);
    // Una ola de calor severa resta más de un 10 % de postura al día siguiente.
    expect(hot.heat).toBeLessThan(0.9);
    expect(hot.eggs).toBeLessThan(normal.eggs * 0.9);
    expect(hot.deaths).toBeGreaterThanOrEqual(normal.deaths);
  });
});

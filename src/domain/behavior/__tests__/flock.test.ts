import { actionCounts, createFlock, stepFlock } from '../flock';
import type { BehaviorLayout, BehaviorWorld, Flock } from '../types';

const layout: BehaviorLayout = {
  bounds: { minX: -5.6, maxX: 5.6, minZ: -2.2, maxZ: 2.2 },
  feeder: { z: -1.1, minX: -5, maxX: 5, side: 1 },
  water: { z: 1.1, minX: -5, maxX: 5, side: -1 },
  perches: Array.from({ length: 24 }, (_, i) => ({ x: -5.2 + (i % 12) * 0.95, z: i < 12 ? -2.05 : 2.05 })),
  coolSpot: { x: 4.8, z: 0 },
};

const day: BehaviorWorld = {
  light: 1,
  heatStress: 0,
  cold: 0,
  sickness: 0,
  waterAvailable: true,
  feedAvailable: true,
  fanActive: false,
};

function simulate(world: BehaviorWorld, seconds: number, flock: Flock = createFlock(24, layout)) {
  for (let t = 0; t < seconds; t += 0.1) stepFlock(flock, world, layout, 0.1);
  return flock;
}

const share = (flock: Flock, action: keyof ReturnType<typeof actionCounts>) =>
  actionCounts(flock)[action] / flock.agents.length;

describe('bandada (IA de utilidad + steering)', () => {
  it('día normal: variedad de conductas y ninguna de estrés', () => {
    const flock = createFlock(24, layout);
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      simulate(day, 10, flock);
      for (const a of flock.agents) seen.add(a.action);
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
    for (const stress of ['pant', 'huddle', 'lethargic', 'crowd', 'roost']) expect(seen.has(stress)).toBe(false);
  });

  it('al oscurecer suben a la percha y se quedan en su puesto', () => {
    const flock = simulate({ ...day, light: 0 }, 60);
    expect(share(flock, 'roost')).toBeGreaterThanOrEqual(0.9);
    const onPerch = flock.agents.filter((a) => {
      const p = layout.perches[a.perch];
      return Math.hypot(p.x - a.pos.x, p.z - a.pos.z) < 0.3;
    });
    expect(onPerch.length / flock.agents.length).toBeGreaterThanOrEqual(0.85);
  });

  it('con calor jadean y se acercan a los ventiladores', () => {
    const before = createFlock(24, layout);
    const meanX0 = before.agents.reduce((s, a) => s + a.pos.x, 0) / 24;
    const flock = simulate({ ...day, heatStress: 1, fanActive: true }, 40, before);
    expect(share(flock, 'pant')).toBeGreaterThanOrEqual(0.6);
    const meanX = flock.agents.reduce((s, a) => s + a.pos.x, 0) / 24;
    expect(meanX).toBeGreaterThan(meanX0 + 1.5);
  });

  it('sin agua y con sed se agolpan en los bebederos', () => {
    const flock = createFlock(24, layout);
    for (const a of flock.agents) a.needs.thirst = 0.9;
    simulate({ ...day, waterAvailable: false }, 20, flock);
    expect(share(flock, 'crowd')).toBeGreaterThanOrEqual(0.5);
    const nearWater = flock.agents.filter((a) => a.action === 'crowd' && Math.abs(a.pos.z - layout.water.z) < 0.9);
    expect(nearWater.length).toBeGreaterThanOrEqual(8);
  });

  it('enfermas: decaimiento generalizado', () => {
    const flock = simulate({ ...day, sickness: 1 }, 20);
    expect(share(flock, 'lethargic')).toBeGreaterThanOrEqual(0.6);
  });

  it('con frío se amontonan', () => {
    const flock = simulate({ ...day, cold: 1 }, 20);
    expect(share(flock, 'huddle')).toBeGreaterThanOrEqual(0.6);
  });

  it('mantienen distancia entre sí al moverse', () => {
    const flock = simulate(day, 30);
    let min = Infinity;
    for (const a of flock.agents)
      for (const b of flock.agents) if (a !== b) min = Math.min(min, Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z));
    expect(min).toBeGreaterThan(0.12);
  });
});

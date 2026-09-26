import type { Agent, BehaviorLayout, BehaviorWorld, Flock, FlockAction, Needs, Vec2 } from './types';

/**
 * Motor de comportamiento de la bandada (gallinas ponedoras).
 * Cada animal: 1) actualiza sus necesidades, 2) cada ~1 s decide su acción
 * por utilidad, 3) elige un destino según la acción y 4) se mueve con
 * "steering" (llegada suave + separación de vecinos).
 * Los ritmos están comprimidos para que los ciclos se vean en minutos.
 */

// --- Aleatoriedad determinista (mulberry32 sobre el estado de la bandada) ---

function rand(flock: Flock): number {
  flock.seed = (flock.seed + 0x6d2b79f5) >>> 0;
  let t = flock.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const between = (flock: Flock, min: number, max: number) => min + rand(flock) * (max - min);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const clamp01 = (v: number) => clamp(v, 0, 1);

// --- Ajustes por acción --------------------------------------------------------

/** Velocidad de desplazamiento (m/s). 0 = se queda en el sitio. */
const SPEED: Record<FlockAction, number> = {
  roost: 0.55,
  rest: 0,
  forage: 0.35,
  eat: 0.5,
  drink: 0.5,
  preen: 0,
  dustbathe: 0,
  pant: 0.22,
  huddle: 0.35,
  crowd: 0.95,
  lethargic: 0,
};

/** Duración típica (s): pasado ese tiempo la acción pierde atractivo y cambian de actividad. */
const TYPICAL_DURATION: Partial<Record<FlockAction, number>> = {
  forage: 18,
  preen: 9,
  dustbathe: 14,
  rest: 25,
  eat: 30,
  drink: 12,
};

/** Distancia mínima entre aves (m). Menor cuando se amontonan a propósito. */
function spacing(action: FlockAction): number {
  return action === 'huddle' || action === 'crowd' ? 0.24 : 0.34;
}

// --- Necesidades ---------------------------------------------------------------

export function updateNeeds(needs: Needs, action: FlockAction, world: BehaviorWorld, appetite: number, dt: number): Needs {
  const asleep = action === 'roost';
  const metabolism = asleep ? 0.1 : 1;
  let hunger = needs.hunger + (dt / 240) * appetite * metabolism;
  let thirst = needs.thirst + (dt / 200) * (1 + 2 * world.heatStress) * metabolism;
  let energy = needs.energy + (asleep || action === 'rest' ? dt / 120 : -dt / 600);
  if (action === 'eat' && world.feedAvailable) hunger -= dt / 25;
  if (action === 'drink' && world.waterAvailable) thirst -= dt / 12;
  hunger = clamp01(hunger);
  thirst = clamp01(thirst);
  energy = clamp01(energy);
  return { hunger, thirst, energy };
}

// --- Utilidad ------------------------------------------------------------------

/** Puntaje de cada acción: cuánto "le conviene" al ave en este momento. */
export function scoreActions(agent: Agent, world: BehaviorWorld): Record<FlockAction, number> {
  const { hunger, thirst, energy } = agent.needs;
  const { activity, appetite } = agent.personality;
  const light = world.light;
  const dark = 1 - light;
  const heat = world.heatStress;
  const healthy = 1 - world.sickness;
  const calm = (1 - heat) * healthy;
  return {
    roost: dark * dark * 3.2,
    rest: ((1 - energy) * 0.9 + heat * 0.35) * light,
    eat: world.feedAvailable ? hunger * 1.25 * appetite * light * (1 - 0.6 * heat) : 0,
    drink: world.waterAvailable ? thirst * 1.35 * (1 + heat) * (0.2 + 0.8 * light) : 0,
    crowd: ((world.waterAvailable ? 0 : thirst * 1.7) + (world.feedAvailable ? 0 : hunger * 1.3)) * light,
    forage: 0.5 * light * activity * calm * energy,
    preen: 0.28 * light * calm,
    dustbathe: 0.2 * light * calm * energy,
    pant: Math.pow(heat, 1.2) * 2.4 * (0.35 + 0.65 * light),
    huddle: world.cold * 2.2 * (0.5 + 0.5 * light),
    lethargic: world.sickness * 2.4 * light,
  };
}

function chooseAction(flock: Flock, agent: Agent, world: BehaviorWorld): FlockAction {
  const scores = scoreActions(agent, world);
  const typical = TYPICAL_DURATION[agent.action];
  // Inercia: se sigue con lo que se está haciendo, salvo que ya haya durado mucho.
  scores[agent.action] += typical !== undefined && agent.actionTime > typical ? -0.5 : 0.3;
  let best: FlockAction = agent.action;
  let bestScore = -Infinity;
  for (const action of Object.keys(scores) as FlockAction[]) {
    const score = scores[action] + rand(flock) * 0.18; // variedad natural
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }
  return best;
}

// --- Destinos ------------------------------------------------------------------

function centroid(agents: Agent[]): Vec2 {
  const sum = agents.reduce((acc, a) => ({ x: acc.x + a.pos.x, z: acc.z + a.pos.z }), { x: 0, z: 0 });
  return { x: sum.x / agents.length, z: sum.z / agents.length };
}

function pickTarget(flock: Flock, agent: Agent, world: BehaviorWorld, layout: BehaviorLayout): Vec2 | null {
  const { feeder, water, bounds } = layout;
  switch (agent.action) {
    case 'roost':
      return layout.perches[agent.perch % layout.perches.length];
    case 'eat':
      return { x: between(flock, feeder.minX, feeder.maxX), z: feeder.z + feeder.side * 0.32 };
    case 'drink':
      return { x: between(flock, water.minX, water.maxX), z: water.z + water.side * 0.3 };
    case 'crowd': {
      const station = world.waterAvailable ? feeder : water;
      const center = (station.minX + station.maxX) / 2;
      return { x: center + between(flock, -1.8, 1.8), z: station.z + station.side * between(flock, 0.25, 0.65) };
    }
    case 'pant':
      return world.fanActive && layout.coolSpot
        ? { x: layout.coolSpot.x + between(flock, -1.1, 0.4), z: layout.coolSpot.z + between(flock, -1.7, 1.7) }
        : null;
    case 'huddle': {
      const c = centroid(flock.agents);
      return { x: c.x + between(flock, -0.4, 0.4), z: c.z + between(flock, -0.3, 0.3) };
    }
    case 'forage':
      return {
        x: clamp(agent.pos.x + between(flock, -1.3, 1.3), bounds.minX, bounds.maxX),
        z: clamp(agent.pos.z + between(flock, -0.7, 0.7), -0.9, 0.9),
      };
    default:
      return null; // acciones en el sitio: acicalarse, baño de tierra, reposo, decaimiento
  }
}

// --- Creación y paso de simulación ---------------------------------------------

export function createFlock(count: number, layout: BehaviorLayout, seed = 7): Flock {
  const flock: Flock = { agents: [], seed };
  const { bounds } = layout;
  for (let i = 0; i < count; i++) {
    flock.agents.push({
      id: i,
      pos: { x: between(flock, bounds.minX + 0.5, bounds.maxX - 0.5), z: between(flock, -0.9, 0.9) },
      vel: { x: 0, z: 0 },
      heading: between(flock, 0, Math.PI * 2),
      action: 'forage',
      actionTime: between(flock, 0, 10),
      thinkIn: between(flock, 0, 1.2),
      target: null,
      needs: { hunger: between(flock, 0.1, 0.6), thirst: between(flock, 0.1, 0.5), energy: between(flock, 0.6, 1) },
      personality: {
        activity: between(flock, 0.75, 1.25),
        appetite: between(flock, 0.8, 1.2),
        sociability: between(flock, 0.8, 1.2),
      },
      perch: i,
    });
  }
  return flock;
}

/** Avanza la bandada `dt` segundos (muta el estado para evitar asignaciones por frame). */
export function stepFlock(flock: Flock, world: BehaviorWorld, layout: BehaviorLayout, dt: number): void {
  const agents = flock.agents;
  for (const a of agents) {
    a.needs = updateNeeds(a.needs, a.action, world, a.personality.appetite, dt);
    a.actionTime += dt;
    a.thinkIn -= dt;
    if (a.thinkIn <= 0) {
      a.thinkIn = between(flock, 0.8, 1.6);
      const next = chooseAction(flock, a, world);
      if (next !== a.action) {
        a.action = next;
        a.actionTime = 0;
        a.target = pickTarget(flock, a, world, layout);
      } else if (!a.target && next === 'forage') {
        a.target = pickTarget(flock, a, world, layout);
      }
    }
  }

  const { bounds } = layout;
  for (const a of agents) {
    let desiredX = 0;
    let desiredZ = 0;
    const speed = SPEED[a.action] * (a.action === 'forage' ? a.personality.activity : 1);
    if (a.target && speed > 0) {
      const dx = a.target.x - a.pos.x;
      const dz = a.target.z - a.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.04) {
        // Llegó: las que exploran eligen otro punto; las demás se quedan.
        a.target = a.action === 'forage' ? pickTarget(flock, a, world, layout) : a.target;
      } else {
        const arrive = Math.min(1, dist / 0.35); // frenar al llegar
        desiredX = (dx / dist) * speed * arrive;
        desiredZ = (dz / dist) * speed * arrive;
      }
    }

    // Separación: no encimarse (salvo en la percha, donde cada una tiene su puesto).
    const onPerch = a.action === 'roost' && a.target && Math.hypot(a.target.x - a.pos.x, a.target.z - a.pos.z) < 0.15;
    if (!onPerch) {
      const minDist = spacing(a.action);
      for (const b of agents) {
        if (b === a) continue;
        const dx = a.pos.x - b.pos.x;
        const dz = a.pos.z - b.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0 && d < minDist) {
          const push = ((minDist - d) / minDist) * 0.8;
          desiredX += (dx / d) * push;
          desiredZ += (dz / d) * push;
        }
      }
    }

    const k = Math.min(1, dt * 5);
    a.vel.x += (desiredX - a.vel.x) * k;
    a.vel.z += (desiredZ - a.vel.z) * k;
    a.pos.x = clamp(a.pos.x + a.vel.x * dt, bounds.minX, bounds.maxX);
    a.pos.z = clamp(a.pos.z + a.vel.z * dt, bounds.minZ, bounds.maxZ);

    if (Math.hypot(a.vel.x, a.vel.z) > 0.05) {
      const targetHeading = Math.atan2(-a.vel.z, a.vel.x);
      let diff = targetHeading - a.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      a.heading += diff * Math.min(1, dt * 6);
    }
  }
}

/** Resumen de la bandada: cuántas aves hacen cada cosa (para UI y pruebas). */
export function actionCounts(flock: Flock): Record<FlockAction, number> {
  const counts = {
    roost: 0,
    rest: 0,
    forage: 0,
    eat: 0,
    drink: 0,
    preen: 0,
    dustbathe: 0,
    pant: 0,
    huddle: 0,
    crowd: 0,
    lethargic: 0,
  } satisfies Record<FlockAction, number>;
  for (const a of flock.agents) counts[a.action]++;
  return counts;
}

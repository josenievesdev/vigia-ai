import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BoxGeometry, ConeGeometry, type Group, MeshStandardMaterial, SphereGeometry } from 'three';

import { createRng } from '@/utils/random';

import { BARN, HEN_FIGURES, PALETTE } from './layout';
import { type SelectHandler, tapHandler } from './shared';

const X_LIMIT = BARN.length / 2 - 0.7;
const Z_LIMIT = 0.85;
const WANDER = 0.8;

interface HenSeed {
  x: number;
  z: number;
  heading: number;
  phase: number;
}

interface HenSim extends HenSeed {
  homeX: number;
  homeZ: number;
  tx: number;
  tz: number;
  wait: number;
  sit: number;
}

function createSeeds(count: number): HenSeed[] {
  const rng = createRng(7);
  return Array.from({ length: count }, (_, i) => {
    const col = i % 8;
    const row = Math.floor(i / 8);
    return {
      x: -X_LIMIT + (col + 0.5) * ((2 * X_LIMIT) / 8) + (rng() - 0.5) * 0.6,
      z: -Z_LIMIT + (row + 0.5) * ((2 * Z_LIMIT) / 3) + (rng() - 0.5) * 0.3,
      heading: rng() * Math.PI * 2,
      phase: rng() * Math.PI * 2,
    };
  });
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function turnTowards(current: number, target: number, amount: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * amount;
}

interface HensProps {
  /** 0–1: intensidad de movimiento. */
  activity: number;
  resting: boolean;
  onSelect: SelectHandler;
}

/**
 * Aves de corral estilizadas. El movimiento representa el índice de actividad:
 * caminan y picotean de día, se echan a descansar de noche y casi no se
 * mueven cuando la actividad es baja.
 */
export function Hens({ activity, resting, onSelect }: HensProps) {
  const [seeds] = useState(() => createSeeds(HEN_FIGURES));
  const bodies = useRef<(Group | null)[]>([]);
  const heads = useRef<(Group | null)[]>([]);
  const sims = useRef<HenSim[] | null>(null);
  const inputs = useRef({ activity, resting });

  useEffect(() => {
    inputs.current = { activity, resting };
  }, [activity, resting]);

  const shared = useMemo(
    () => ({
      body: new SphereGeometry(0.16, 12, 10),
      head: new SphereGeometry(0.075, 10, 8),
      comb: new BoxGeometry(0.07, 0.05, 0.02),
      beak: new ConeGeometry(0.025, 0.07, 6),
      tail: new BoxGeometry(0.1, 0.15, 0.12),
      feathers: new MeshStandardMaterial({ color: PALETTE.henBody, roughness: 0.9 }),
      red: new MeshStandardMaterial({ color: PALETTE.henComb }),
      orange: new MeshStandardMaterial({ color: PALETTE.henBeak }),
    }),
    [],
  );

  useEffect(
    () => () => {
      for (const resource of Object.values(shared)) resource.dispose();
    },
    [shared],
  );

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.1);
    const t = clock.elapsedTime;
    const { activity: act, resting: rest } = inputs.current;
    if (!sims.current) {
      sims.current = seeds.map((s) => ({ ...s, homeX: s.x, homeZ: s.z, tx: s.x, tz: s.z, wait: Math.random() * 2, sit: 0 }));
    }
    const speed = 0.12 + 0.45 * act;

    sims.current.forEach((h, i) => {
      const body = bodies.current[i];
      const head = heads.current[i];
      if (!body || !head) return;

      // Echarse (noche) o levantarse.
      h.sit += ((rest ? 1 : 0) - h.sit) * Math.min(1, dt * 1.5);

      if (!rest) {
        h.wait -= dt;
        const dx = h.tx - h.x;
        const dz = h.tz - h.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.04) {
          if (h.wait <= 0) {
            h.tx = clamp(h.homeX + (Math.random() - 0.5) * 2 * WANDER, -X_LIMIT, X_LIMIT);
            h.tz = clamp(h.homeZ + (Math.random() - 0.5) * WANDER, -Z_LIMIT, Z_LIMIT);
            // Con poca actividad pasan más tiempo quietas.
            h.wait = (0.6 + Math.random() * 2.5) / Math.max(act, 0.12);
          }
        } else if (act > 0.08) {
          const step = Math.min(dist, speed * act * dt * 2);
          h.x += (dx / dist) * step;
          h.z += (dz / dist) * step;
          h.heading = turnTowards(h.heading, Math.atan2(-dz, dx), Math.min(1, dt * 6));
        }
      }

      const moving = !rest && Math.hypot(h.tx - h.x, h.tz - h.z) >= 0.04 && act > 0.08;
      body.position.set(h.x, BARN.floorTop - h.sit * 0.07, h.z);
      body.rotation.y = h.heading;
      // Picoteo al estar quietas; balanceo al caminar; cabeza recogida al descansar.
      const peck = moving || rest ? 0 : Math.max(0, Math.sin(t * 5 + h.phase)) * act;
      head.rotation.z = -0.9 * peck - h.sit * 0.35;
      head.position.y = 0.3 - peck * 0.08 - h.sit * 0.06 + (moving ? Math.sin(t * 14 + h.phase) * 0.012 : 0);
    });
  });

  return (
    <group onClick={tapHandler('hens', onSelect)}>
      {seeds.map((s, i) => (
        <group
          key={i}
          ref={(el) => {
            bodies.current[i] = el;
          }}
          position={[s.x, BARN.floorTop, s.z]}
          rotation={[0, s.heading, 0]}>
          <mesh geometry={shared.body} material={shared.feathers} position={[0, 0.17, 0]} scale={[1.25, 0.95, 0.85]} dispose={null} />
          <mesh geometry={shared.tail} material={shared.feathers} position={[-0.2, 0.27, 0]} rotation={[0, 0, 0.55]} dispose={null} />
          <group
            ref={(el) => {
              heads.current[i] = el;
            }}
            position={[0.19, 0.3, 0]}>
            <mesh geometry={shared.head} material={shared.feathers} dispose={null} />
            <mesh geometry={shared.comb} material={shared.red} position={[0.01, 0.075, 0]} dispose={null} />
            <mesh geometry={shared.beak} material={shared.orange} position={[0.085, -0.01, 0]} rotation={[0, 0, -Math.PI / 2]} dispose={null} />
          </group>
        </group>
      ))}
    </group>
  );
}

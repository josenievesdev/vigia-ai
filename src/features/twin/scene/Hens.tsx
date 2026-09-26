import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BoxGeometry, ConeGeometry, type Group, MeshStandardMaterial, SphereGeometry } from 'three';

import { actionCounts, createFlock, stepFlock } from '@/domain/behavior/flock';
import type { BehaviorWorld, Flock, FlockAction } from '@/domain/behavior/types';

import { BARN, HEN_FIGURES, HEN_LAYOUT, PALETTE, PERCH } from './layout';
import { type SelectHandler, tapHandler } from './shared';

/** Cada cuánto se informa el resumen de la bandada a la UI 2D (s). */
const SUMMARY_EVERY = 2;

/** Partes animables de cada gallina. */
interface HenRig {
  body: Group | null;
  torso: Group | null;
  head: Group | null;
  jaw: Group | null;
  wingL: Group | null;
  wingR: Group | null;
}

const SITTING: ReadonlySet<FlockAction> = new Set(['roost', 'rest', 'lethargic', 'dustbathe']);

interface HensProps {
  world: BehaviorWorld;
  onSelect: SelectHandler;
  /** Recibe cuántas aves hacen cada cosa (cada ~2 s). */
  onSummary?: (counts: Record<FlockAction, number>) => void;
}

/**
 * Gallinas con comportamiento de NPC (IA de utilidad + steering, ver
 * domain/behavior). Aquí solo se traduce cada acción a una postura animada.
 */
export function Hens({ world, onSelect, onSummary }: HensProps) {
  const [ids] = useState(() => Array.from({ length: HEN_FIGURES }, (_, i) => i));
  const rigs = useRef<HenRig[]>(ids.map(() => ({ body: null, torso: null, head: null, jaw: null, wingL: null, wingR: null })));
  const flock = useRef<Flock | null>(null);
  const sit = useRef<number[]>(ids.map(() => 0));
  const inputs = useRef({ world, onSummary });
  const summaryTimer = useRef(0);

  useEffect(() => {
    inputs.current = { world, onSummary };
  }, [world, onSummary]);

  const shared = useMemo(
    () => ({
      body: new SphereGeometry(0.16, 12, 10),
      head: new SphereGeometry(0.075, 10, 8),
      wing: new SphereGeometry(0.12, 10, 8),
      comb: new BoxGeometry(0.07, 0.05, 0.02),
      beak: new ConeGeometry(0.025, 0.07, 6),
      tail: new BoxGeometry(0.1, 0.15, 0.12),
      feathers: new MeshStandardMaterial({ color: PALETTE.henBody, roughness: 0.9 }),
      wingColor: new MeshStandardMaterial({ color: '#86421f', roughness: 0.9 }),
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
    const { world: w, onSummary: report } = inputs.current;

    if (!flock.current) {
      flock.current = createFlock(HEN_FIGURES, HEN_LAYOUT);
      // Si la app abre de noche, las aves ya están dormidas en la percha.
      if (w.light < 0.2) {
        for (const a of flock.current.agents) {
          a.action = 'roost';
          a.pos = { ...HEN_LAYOUT.perches[a.perch] };
          a.target = HEN_LAYOUT.perches[a.perch];
        }
      }
    }
    const f = flock.current;
    stepFlock(f, w, HEN_LAYOUT, dt);

    summaryTimer.current += dt;
    if (report && summaryTimer.current >= SUMMARY_EVERY) {
      summaryTimer.current = 0;
      report(actionCounts(f));
    }

    const panting = w.heatStress > 0.45;
    f.agents.forEach((a, i) => {
      const rig = rigs.current[i];
      if (!rig.body || !rig.torso || !rig.head || !rig.jaw || !rig.wingL || !rig.wingR) return;
      const phase = i * 1.7;
      const perch = HEN_LAYOUT.perches[a.perch];
      const perched = a.action === 'roost' && Math.hypot(perch.x - a.pos.x, perch.z - a.pos.z) < 0.25;

      // Sentarse/echarse de forma gradual.
      sit.current[i] += ((SITTING.has(a.action) ? 1 : 0) - sit.current[i]) * Math.min(1, dt * 2);
      const s = sit.current[i];

      rig.body.position.set(a.pos.x, (perched ? PERCH.y : BARN.floorTop) - s * 0.07, a.pos.z);
      rig.body.rotation.y = a.heading;
      rig.body.rotation.x = a.action === 'dustbathe' ? Math.sin(t * 6 + phase) * 0.3 : 0;

      // Torso: plumas esponjadas con frío; respiración rápida al jadear.
      const fluff = a.action === 'huddle' ? 1.15 : 1;
      const breath = panting ? 1 + Math.sin(t * 14 + phase) * 0.04 : 1;
      rig.torso.scale.set(fluff, fluff * breath, fluff);

      // Cabeza según la acción.
      let headTilt = 0;
      let headTurn = 0;
      let headY = 0.3;
      switch (a.action) {
        case 'eat':
        case 'forage':
          headTilt = -0.9 * Math.max(0, Math.sin(t * 5 + phase));
          headY -= 0.08 * Math.max(0, Math.sin(t * 5 + phase));
          break;
        case 'drink':
          headTilt = 0.45 + 0.2 * Math.max(0, Math.sin(t * 4 + phase));
          break;
        case 'preen':
          headTilt = -0.3;
          headTurn = Math.sin(t * 2 + phase) * 1.2;
          break;
        case 'crowd':
          headTilt = -0.4 * Math.sin(t * 12 + phase);
          break;
        case 'roost':
          headTilt = -0.5;
          headY -= 0.08;
          break;
        case 'lethargic':
          headTilt = -0.85;
          headY -= 0.07;
          break;
        case 'pant':
          headTilt = 0.15;
          break;
      }
      rig.head.rotation.set(0, headTurn, headTilt);
      rig.head.position.y = headY - s * 0.02;

      // Pico abierto al jadear.
      rig.jaw.rotation.z = panting && a.action !== 'roost' ? -0.45 - Math.sin(t * 16 + phase) * 0.15 : 0;

      // Alas: separadas con calor, aleteo con agitación, pegadas al cuerpo en reposo.
      let wingOpen = 0.05;
      if (panting) wingOpen = 0.55;
      if (a.action === 'crowd') wingOpen = 0.3 + Math.abs(Math.sin(t * 18 + phase)) * 0.6;
      if (a.action === 'huddle' || a.action === 'roost') wingOpen = 0;
      rig.wingR.rotation.x = -wingOpen;
      rig.wingL.rotation.x = wingOpen;
    });
  });

  const bind = (i: number, part: keyof HenRig) => (el: Group | null) => {
    rigs.current[i][part] = el;
  };

  return (
    <group onClick={tapHandler('hens', onSelect)}>
      {ids.map((i) => (
        <group key={i} ref={bind(i, 'body')}>
          <group ref={bind(i, 'torso')}>
            <mesh geometry={shared.body} material={shared.feathers} position={[0, 0.17, 0]} scale={[1.25, 0.95, 0.85]} dispose={null} />
            <mesh geometry={shared.tail} material={shared.feathers} position={[-0.2, 0.27, 0]} rotation={[0, 0, 0.55]} dispose={null} />
          </group>
          {[-1, 1].map((side) => (
            <group key={side} ref={bind(i, side > 0 ? 'wingR' : 'wingL')} position={[0.01, 0.23, side * 0.12]}>
              <mesh geometry={shared.wing} material={shared.wingColor} position={[-0.02, -0.05, 0]} scale={[1.15, 0.55, 0.2]} dispose={null} />
            </group>
          ))}
          <group ref={bind(i, 'head')} position={[0.19, 0.3, 0]}>
            <mesh geometry={shared.head} material={shared.feathers} dispose={null} />
            <mesh geometry={shared.comb} material={shared.red} position={[0.01, 0.075, 0]} dispose={null} />
            <mesh geometry={shared.beak} material={shared.orange} position={[0.085, 0, 0]} rotation={[0, 0, -Math.PI / 2]} dispose={null} />
            <group ref={bind(i, 'jaw')} position={[0.055, -0.012, 0]}>
              <mesh geometry={shared.beak} material={shared.orange} position={[0.03, 0, 0]} rotation={[0, 0, -Math.PI / 2]} scale={[0.8, 0.8, 0.8]} dispose={null} />
            </group>
          </group>
        </group>
      ))}
    </group>
  );
}

import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { DoubleSide, type MeshStandardMaterial } from 'three';

import { BARN, PALETTE, TANK, WATER_Z } from './layout';
import { Flow, Pipe } from './Flow';
import { type SelectHandler, tapHandler } from './shared';

const TANK_HEIGHT = 1.5;
const TANK_RADIUS = 0.62;
const LINE_Y = 0.5;
const PUMP: [number, number, number] = [TANK[0] + 0.85, 0.16, TANK[2]];

interface WaterProps {
  level: number | null;
  pumpActive: boolean;
  onSelect: SelectHandler;
}

/** Tanque translúcido con el nivel, bomba con indicador y línea de bebederos de niple. */
export function Water({ level, pumpActive, onSelect }: WaterProps) {
  const fillHeight = Math.max(0.02, (TANK_HEIGHT - 0.06) * (level ?? 0));
  const barnStart = -BARN.length / 2 + 0.5;

  return (
    <group onClick={tapHandler('water', onSelect)}>
      <group position={TANK}>
        <mesh position={[0, 0.03 + fillHeight / 2, 0]}>
          <cylinderGeometry args={[TANK_RADIUS - 0.04, TANK_RADIUS - 0.04, fillHeight, 24]} />
          <meshStandardMaterial color={PALETTE.water} transparent opacity={0.85} />
        </mesh>
        <mesh position={[0, TANK_HEIGHT / 2, 0]}>
          <cylinderGeometry args={[TANK_RADIUS, TANK_RADIUS, TANK_HEIGHT, 28, 1, true]} />
          <meshStandardMaterial color="#e3eaf0" transparent opacity={0.3} depthWrite={false} side={DoubleSide} />
        </mesh>
        <mesh position={[0, TANK_HEIGHT + 0.03, 0]}>
          <cylinderGeometry args={[TANK_RADIUS + 0.02, TANK_RADIUS + 0.02, 0.06, 28]} />
          <meshStandardMaterial color={PALETTE.metal} />
        </mesh>
      </group>

      <group position={PUMP}>
        <mesh>
          <boxGeometry args={[0.34, 0.28, 0.3]} />
          <meshStandardMaterial color={PALETTE.darkMetal} />
        </mesh>
        <PumpLed active={pumpActive} />
      </group>

      {/* Tubería al galpón y línea de niples */}
      <Pipe from={[PUMP[0] + 0.17, 0.2, WATER_Z]} to={[barnStart, LINE_Y, WATER_Z]} radius={0.035} color={PALETTE.metal} />
      <Pipe from={[barnStart, LINE_Y, WATER_Z]} to={[BARN.length / 2 - 0.6, LINE_Y, WATER_Z]} radius={0.03} color={PALETTE.metal} />
      {Array.from({ length: 12 }, (_, i) => barnStart + 0.5 + i * 0.85).map((x) => (
        <mesh key={x} position={[x, LINE_Y - 0.07, WATER_Z]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.03, 0.09, 8]} />
          <meshStandardMaterial color="#c0392b" />
        </mesh>
      ))}
      <Flow
        from={[PUMP[0] + 0.2, 0.28, WATER_Z]}
        to={[barnStart, LINE_Y + 0.07, WATER_Z]}
        active={pumpActive}
        color={PALETTE.water}
        count={5}
        radius={0.04}
        speed={1.1}
      />
    </group>
  );
}

/** Indicador de la bomba: verde parpadeante cuando está encendida. */
function PumpLed({ active }: { active: boolean }) {
  const material = useRef<MeshStandardMaterial>(null);
  const isActive = useRef(active);

  useEffect(() => {
    isActive.current = active;
  }, [active]);

  useFrame(({ clock }) => {
    if (!material.current) return;
    material.current.emissiveIntensity = isActive.current ? 1.2 + Math.sin(clock.elapsedTime * 8) * 0.8 : 0;
  });

  return (
    <mesh position={[0, 0.17, 0]}>
      <sphereGeometry args={[0.045, 10, 8]} />
      <meshStandardMaterial ref={material} color={active ? '#22c55e' : '#6b7280'} emissive="#22c55e" emissiveIntensity={0} />
    </mesh>
  );
}

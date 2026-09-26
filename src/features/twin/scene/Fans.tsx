import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Group } from 'three';

import { FAN_X, FAN_Y, FAN_ZS, PALETTE } from './layout';
import { type SelectHandler, tapHandler } from './shared';

const MAX_SPEED = 16; // rad/s

/** Extractores en el muro del fondo: giran cuando la ventilación está activa. */
export function Fans({ active, onSelect }: { active: boolean; onSelect: SelectHandler }) {
  return (
    <group onClick={tapHandler('ventilation', onSelect)}>
      {FAN_ZS.map((z) => (
        <Fan key={z} position={[FAN_X, FAN_Y, z]} active={active} />
      ))}
    </group>
  );
}

function Fan({ position, active }: { position: [number, number, number]; active: boolean }) {
  const rotor = useRef<Group>(null);
  const state = useRef({ active, speed: 0 });

  useEffect(() => {
    state.current.active = active;
  }, [active]);

  useFrame((_, delta) => {
    const s = state.current;
    // Arranque y frenado graduales, como un motor real.
    s.speed += ((s.active ? MAX_SPEED : 0) - s.speed) * Math.min(1, delta * 1.5);
    if (rotor.current) rotor.current.rotation.x += s.speed * delta;
  });

  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.22, 1.05, 1.05]} />
        <meshStandardMaterial color={PALETTE.darkMetal} />
      </mesh>
      <mesh position={[0.12, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.44, 0.035, 8, 32]} />
        <meshStandardMaterial color={PALETTE.metal} />
      </mesh>
      <group ref={rotor} position={[0.14, 0, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.06, 12]} />
          <meshStandardMaterial color={PALETTE.metal} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <group key={i} rotation={[(i * Math.PI) / 2, 0, 0]}>
            <mesh position={[0, 0.21, 0]} rotation={[0.35, 0, 0]}>
              <boxGeometry args={[0.02, 0.34, 0.13]} />
              <meshStandardMaterial color="#d3d9de" />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

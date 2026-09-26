import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Mesh } from 'three';

import type { Vec3 } from './layout';
import { noRaycast } from './shared';

interface FlowProps {
  from: Vec3;
  to: Vec3;
  active: boolean;
  color: string;
  count?: number;
  radius?: number;
  /** Recorridos completos por segundo. */
  speed?: number;
}

/** Partículas que recorren un tramo cuando un equipo está activo (grano, agua). */
export function Flow({ from, to, active, color, count = 6, radius = 0.045, speed = 0.7 }: FlowProps) {
  const particles = useRef<(Mesh | null)[]>([]);
  const isActive = useRef(active);

  useEffect(() => {
    isActive.current = active;
  }, [active]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    particles.current.forEach((p, i) => {
      if (!p) return;
      p.visible = isActive.current;
      if (!isActive.current) return;
      const u = (t * speed + i / count) % 1;
      p.position.set(from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u, from[2] + (to[2] - from[2]) * u);
    });
  });

  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <mesh
          key={i}
          raycast={noRaycast}
          visible={false}
          ref={(el) => {
            particles.current[i] = el;
          }}>
          <sphereGeometry args={[radius, 8, 6]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

/** Cilindro (tubería) entre dos puntos. */
export function Pipe({ from, to, radius, color }: { from: Vec3; to: Vec3; radius: number; color: string }) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const length = Math.hypot(dx, dy, dz);
  const mid: Vec3 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];
  // Tuberías en el plano XY (a lo largo del galpón): basta con girar sobre Z.
  const angle = Math.atan2(dy, Math.hypot(dx, dz)) - Math.PI / 2;
  const heading = Math.atan2(-dz, dx);
  return (
    <group position={mid} rotation={[0, heading, 0]}>
      <mesh rotation={[0, 0, angle]}>
        <cylinderGeometry args={[radius, radius, length, 10]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

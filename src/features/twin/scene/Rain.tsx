import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import type { LineSegments } from 'three';

import { noRaycast } from './shared';

const MAX_DROPS = 260;
const AREA = { x: 22, z: 16, top: 14 };
const DROP_LENGTH = 0.35;
const FALL_SPEED = 11; // m/s

function initialPositions(): Float32Array {
  const positions = new Float32Array(MAX_DROPS * 6);
  for (let i = 0; i < MAX_DROPS; i++) {
    const x = (Math.random() - 0.5) * AREA.x;
    const y = Math.random() * AREA.top;
    const z = (Math.random() - 0.5) * AREA.z;
    positions.set([x, y, z, x, y + DROP_LENGTH, z], i * 6);
  }
  return positions;
}

/** Lluvia real (Open-Meteo): gotas que caen alrededor del galpón. 0 = no llueve. */
export function Rain({ intensity }: { intensity: number }) {
  const [positions] = useState(initialPositions);
  const lines = useRef<LineSegments>(null);
  const level = useRef(intensity);

  useEffect(() => {
    level.current = intensity;
  }, [intensity]);

  useFrame((_, delta) => {
    const mesh = lines.current;
    if (!mesh) return;
    const count = Math.round(MAX_DROPS * level.current);
    mesh.visible = count > 0;
    if (!count) return;
    const attr = mesh.geometry.getAttribute('position');
    const arr = attr.array as Float32Array;
    const fall = FALL_SPEED * Math.min(delta, 0.1);
    for (let i = 0; i < count; i++) {
      const o = i * 6;
      let y = arr[o + 1] - fall;
      if (y < 0) y += AREA.top;
      arr[o + 1] = y;
      arr[o + 4] = y + DROP_LENGTH;
    }
    attr.needsUpdate = true;
    mesh.geometry.setDrawRange(0, count * 2);
  });

  return (
    <lineSegments ref={lines} raycast={noRaycast} frustumCulled={false} visible={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#a9c7e2" transparent opacity={0.55} depthWrite={false} />
    </lineSegments>
  );
}

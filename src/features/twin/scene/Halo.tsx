import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { type Mesh, type MeshBasicMaterial, Path, Shape, ShapeGeometry } from 'three';

import type { TwinElementId } from '../twinState';
import { BARN, FAN_X, SILO, TANK, type Vec3 } from './layout';
import { noRaycast } from './shared';

/** Anillo elíptico en el suelo alrededor de cada elemento (radios en X y Z). */
export const HALO_SHAPES: Record<TwinElementId, { position: Vec3; radii: [number, number] }> = {
  climate: { position: [0.16, BARN.floorTop + 0.02, -2.0], radii: [0.6, 0.42] },
  hens: { position: [0, BARN.floorTop + 0.02, 0], radii: [5.9, 1.25] },
  ventilation: { position: [FAN_X + 0.45, 0.03, 0], radii: [0.55, 2.1] },
  feeder: { position: [SILO[0], 0.03, SILO[2]], radii: [0.95, 0.95] },
  water: { position: [TANK[0], 0.03, TANK[2]], radii: [0.95, 0.95] },
  lighting: { position: [0, BARN.floorTop + 0.02, 0], radii: [5.2, 0.5] },
};

/** Elipse hueca con grosor constante (una elipse escalada adelgazaría el borde en un eje). */
function ellipseRing(rx: number, rz: number, width: number): ShapeGeometry {
  const outer = new Shape();
  outer.absellipse(0, 0, rx, rz, 0, Math.PI * 2, false, 0);
  const inner = new Path();
  inner.absellipse(0, 0, rx - width, rz - width, 0, Math.PI * 2, true, 0);
  outer.holes.push(inner);
  return new ShapeGeometry(outer, 48);
}

interface HaloProps {
  element: TwinElementId;
  color: string;
  /** Pulsa (alerta) o queda fijo (selección). */
  pulse: boolean;
  width?: number;
}

export function Halo({ element, color, pulse, width = 0.1 }: HaloProps) {
  const mesh = useRef<Mesh>(null);
  const material = useRef<MeshBasicMaterial>(null);
  const { position, radii } = HALO_SHAPES[element];
  const geometry = useMemo(() => ellipseRing(radii[0], radii[1], width), [radii, width]);

  useFrame(({ clock }) => {
    if (!pulse || !mesh.current || !material.current) return;
    const k = (Math.sin(clock.elapsedTime * 3) + 1) / 2;
    mesh.current.scale.setScalar(1 + k * 0.06);
    material.current.opacity = 0.4 + k * 0.5;
  });

  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      raycast={noRaycast}
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={2}>
      <meshBasicMaterial ref={material} color={color} transparent opacity={pulse ? 0.7 : 0.9} depthWrite={false} />
    </mesh>
  );
}

import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { BackSide, Vector3 } from 'three';

import type { CameraGoal } from './layout';
import type { SelectHandler } from './shared';

/** Proporción (ancho/alto) para la que están pensadas las distancias de las vistas. */
const REFERENCE_ASPECT = 1.5;
const MIN_ELEVATION = 0.12;
const MAX_ELEVATION = 1.35;

interface OrbitCameraProps {
  goal: CameraGoal;
  onSelect: SelectHandler;
}

/**
 * Cámara orbital del gemelo:
 * - se desliza suavemente hacia el objetivo (vista elegida o elemento tocado);
 * - arrastrar sobre la escena la gira alrededor del objetivo;
 * - tocar en vacío quita la selección.
 * Usa el sistema de eventos de R3F (una esfera invisible envuelve la escena),
 * así funciona igual en web y en nativo.
 */
export function OrbitCamera({ goal, onSelect }: OrbitCameraProps) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const orbit = useRef({ azimuth: 0, elevation: 0, active: false, lastX: 0, lastY: 0 });
  const vectors = useRef<{ target: Vector3; desired: Vector3; goal: Vector3 } | null>(null);

  // Al cambiar de vista o de elemento, se descarta el giro manual.
  useEffect(() => {
    orbit.current.azimuth = 0;
    orbit.current.elevation = 0;
  }, [goal]);

  useFrame((_, delta) => {
    if (!vectors.current) {
      vectors.current = { target: new Vector3(...goal.target), desired: new Vector3(), goal: new Vector3() };
    }
    const { target, desired, goal: goalTarget } = vectors.current;
    const k = 1 - Math.exp(-Math.min(delta, 0.1) * 3.5);
    // En pantallas verticales (teléfono) se aleja la cámara para que el galpón quepa a lo ancho.
    const aspect = size.width / Math.max(1, size.height);
    const distance = goal.distance * Math.max(1, REFERENCE_ASPECT / aspect);
    const az = goal.azimuth + orbit.current.azimuth;
    const el = Math.min(MAX_ELEVATION, Math.max(MIN_ELEVATION, goal.elevation + orbit.current.elevation));

    goalTarget.set(...goal.target);
    target.lerp(goalTarget, k);
    desired.set(
      target.x + distance * Math.sin(az) * Math.cos(el),
      target.y + distance * Math.sin(el),
      target.z + distance * Math.cos(az) * Math.cos(el),
    );
    camera.position.lerp(desired, k);
    camera.lookAt(target);
  });

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    orbit.current.active = true;
    orbit.current.lastX = e.pointer.x;
    orbit.current.lastY = e.pointer.y;
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const o = orbit.current;
    if (!o.active) return;
    o.azimuth -= (e.pointer.x - o.lastX) * 2.2;
    o.elevation = Math.min(1.2, Math.max(-0.6, o.elevation - (e.pointer.y - o.lastY) * 1.2));
    o.lastX = e.pointer.x;
    o.lastY = e.pointer.y;
  };
  const onUp = () => {
    orbit.current.active = false;
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta <= 8) onSelect(null);
  };

  return (
    <mesh onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onClick={onClick}>
      <sphereGeometry args={[90, 16, 12]} />
      <meshBasicMaterial side={BackSide} colorWrite={false} depthWrite={false} />
    </mesh>
  );
}

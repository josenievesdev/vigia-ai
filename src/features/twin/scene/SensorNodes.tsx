import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { MeshStandardMaterial } from 'three';

import type { SensorKind } from '@/domain/types';
import type { ColorTokens } from '@/theme';

import { SENSOR_ELEMENT, type TwinSensorNode, type TwinStatus } from '../twinState';
import { PALETTE, SENSOR_POSITIONS, type Vec3 } from './layout';
import { type SelectHandler, statusColor, tapHandler } from './shared';

/** Hacia dónde mira el LED de cada nodo (según dónde está montado). */
const LED_OFFSET: Record<SensorKind, Vec3> = {
  temperature: [0, 0.05, 0.05],
  humidity: [0, 0.05, 0.05],
  light: [0, -0.13, 0],
  animalActivity: [0.06, 0, 0.03],
  waterLevel: [0, 0.13, 0],
  feedLevel: [0, 0.13, 0],
};

interface SensorNodesProps {
  sensors: TwinSensorNode[];
  colors: ColorTokens;
  onSelect: SelectHandler;
}

/** Nodos IoT (futuros ESP32) con un LED que muestra el estado de su lectura. */
export function SensorNodes({ sensors, colors, onSelect }: SensorNodesProps) {
  return (
    <group>
      {sensors.map((s) => (
        <group key={s.kind} position={SENSOR_POSITIONS[s.kind]} onClick={tapHandler(SENSOR_ELEMENT[s.kind], onSelect)}>
          <mesh>
            <boxGeometry args={[0.16, 0.22, 0.08]} />
            <meshStandardMaterial color={PALETTE.device} />
          </mesh>
          <StatusLed position={LED_OFFSET[s.kind]} status={s.status} colors={colors} />
        </group>
      ))}
    </group>
  );
}

function StatusLed({ position, status, colors }: { position: Vec3; status: TwinStatus; colors: ColorTokens }) {
  const material = useRef<MeshStandardMaterial>(null);
  const current = useRef(status);

  useEffect(() => {
    current.current = status;
  }, [status]);

  useFrame(({ clock }) => {
    if (!material.current) return;
    const s = current.current;
    const blink = s === 'warning' || s === 'critical';
    const base = s === 'offline' || s === 'neutral' ? 0 : 1.4;
    material.current.emissiveIntensity = blink ? base * (0.5 + 0.5 * Math.sign(Math.sin(clock.elapsedTime * 6))) : base;
  });

  const color = statusColor(colors, status);
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.04, 10, 8]} />
      <meshStandardMaterial ref={material} color={color} emissive={color} emissiveIntensity={1.4} />
    </mesh>
  );
}

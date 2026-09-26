import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { MeshBasicMaterial } from 'three';

import type { ColorTokens } from '@/theme';

import type { TwinStatus } from '../twinState';
import { BARN, PALETTE } from './layout';
import { noRaycast, type SelectHandler, tapHandler } from './shared';

const HALF_L = BARN.length / 2;
const HALF_W = BARN.width / 2;
const POST_XS = [-6, -3, 0, 3, 6];
const ROOF_RUN = HALF_W + 0.1;
const ROOF_RISE = BARN.ridge - BARN.eave;
const ROOF_ANGLE = Math.atan2(ROOF_RISE, ROOF_RUN);
const ROOF_SPAN = Math.hypot(ROOF_RUN, ROOF_RISE);

interface BarnProps {
  climateStatus: TwinStatus;
  colors: ColorTokens;
  onSelect: SelectHandler;
}

/** Galpón: piso con cama, muros bajos, postes, muro de ventiladores y techo translúcido. */
export function Barn({ climateStatus, colors, onSelect }: BarnProps) {
  const onTap = tapHandler('climate', onSelect);
  return (
    <group>
      <group onClick={onTap}>
        {/* Piso (cama) */}
        <mesh position={[0, BARN.floorTop / 2, 0]}>
          <boxGeometry args={[BARN.length + 0.2, BARN.floorTop, BARN.width + 0.2]} />
          <meshStandardMaterial color={PALETTE.bedding} />
        </mesh>
        {/* Muros bajos laterales */}
        {[-1, 1].map((side) => (
          <mesh key={`wall-${side}`} position={[0, BARN.kneeWall / 2, side * (HALF_W + 0.05)]}>
            <boxGeometry args={[BARN.length + 0.2, BARN.kneeWall, 0.1]} />
            <meshStandardMaterial color={PALETTE.wall} />
          </mesh>
        ))}
        {/* Muro bajo de entrada (-X) y muro completo de ventiladores (+X) */}
        <mesh position={[-HALF_L - 0.05, BARN.kneeWall / 2, 0]}>
          <boxGeometry args={[0.1, BARN.kneeWall, BARN.width + 0.2]} />
          <meshStandardMaterial color={PALETTE.wall} />
        </mesh>
        <mesh position={[HALF_L + 0.05, BARN.eave / 2, 0]}>
          <boxGeometry args={[0.1, BARN.eave, BARN.width + 0.2]} />
          <meshStandardMaterial color={PALETTE.wall} />
        </mesh>
        {/* Postes */}
        {POST_XS.flatMap((x) =>
          [-1, 1].map((side) => (
            <mesh key={`post-${x}-${side}`} position={[x, BARN.eave / 2, side * (HALF_W + 0.05)]}>
              <boxGeometry args={[0.12, BARN.eave, 0.12]} />
              <meshStandardMaterial color={PALETTE.wood} />
            </mesh>
          )),
        )}
      </group>

      {/* Techo translúcido: deja ver el interior y no captura toques */}
      {[-1, 1].map((side) => (
        <mesh
          key={`roof-${side}`}
          raycast={noRaycast}
          position={[0, BARN.eave + ROOF_RISE / 2, side * (ROOF_RUN / 2)]}
          rotation={[side * ROOF_ANGLE, 0, 0]}>
          <boxGeometry args={[BARN.length + 0.5, 0.03, ROOF_SPAN]} />
          <meshStandardMaterial color={PALETTE.roof} transparent opacity={0.18} depthWrite={false} />
        </mesh>
      ))}
      <mesh raycast={noRaycast} position={[0, BARN.ridge, 0]}>
        <boxGeometry args={[BARN.length + 0.5, 0.08, 0.08]} />
        <meshStandardMaterial color={PALETTE.wood} />
      </mesh>

      <AirTint status={climateStatus} colors={colors} />
    </group>
  );
}

/** Volumen de aire teñido cuando el clima sale de rango (advertencia/crítico), con pulso suave. */
function AirTint({ status, colors }: { status: TwinStatus; colors: ColorTokens }) {
  const material = useRef<MeshBasicMaterial>(null);
  const alerting = status === 'warning' || status === 'critical';
  const base = status === 'critical' ? 0.16 : 0.09;

  useFrame(({ clock }) => {
    if (!material.current) return;
    material.current.opacity = alerting ? base + Math.sin(clock.elapsedTime * 2.5) * 0.04 : 0;
  });

  return (
    <mesh raycast={noRaycast} position={[0, BARN.eave / 2 + 0.05, 0]} visible={alerting}>
      <boxGeometry args={[BARN.length - 0.2, BARN.eave - 0.1, BARN.width - 0.2]} />
      <meshBasicMaterial
        ref={material}
        color={status === 'critical' ? colors.critical : colors.warning}
        transparent
        opacity={0}
        depthWrite={false}
      />
    </mesh>
  );
}

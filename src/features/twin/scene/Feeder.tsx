import { DoubleSide } from 'three';

import { BARN, FEEDER_Z, PALETTE, SILO } from './layout';
import { Flow, Pipe } from './Flow';
import { noRaycast, type SelectHandler, tapHandler } from './shared';

const TROUGH_LENGTH = BARN.length - 1.6;
const SILO_BASE = 1.5;
const SILO_HEIGHT = 1.9;
const SILO_RADIUS = 0.6;

interface FeederProps {
  /** 0–1 o null sin dato. */
  level: number | null;
  active: boolean;
  onSelect: SelectHandler;
}

/**
 * Silo/tolva exterior con nivel visible, sinfín hacia el galpón y comedero lineal.
 * El nivel del silo es el dato del sensor; el grano fluye cuando el alimentador está activo.
 */
export function Feeder({ level, active, onSelect }: FeederProps) {
  const fill = level ?? 0;
  const fillHeight = Math.max(0.02, SILO_HEIGHT * fill);
  const troughFeed = 0.015 + 0.05 * Math.min(1, fill * 1.5);

  return (
    <group onClick={tapHandler('feeder', onSelect)}>
      {/* Comedero lineal */}
      <mesh position={[0, 0.3, FEEDER_Z]}>
        <boxGeometry args={[TROUGH_LENGTH, 0.1, 0.26]} />
        <meshStandardMaterial color={PALETTE.metal} />
      </mesh>
      <mesh position={[0, 0.35 + troughFeed / 2, FEEDER_Z]}>
        <boxGeometry args={[TROUGH_LENGTH - 0.1, troughFeed, 0.18]} />
        <meshStandardMaterial color={PALETTE.feed} />
      </mesh>
      {[-4, -1.3, 1.3, 4].map((x) => (
        <mesh key={x} position={[x, 0.16, FEEDER_Z]}>
          <cylinderGeometry args={[0.025, 0.025, 0.2, 6]} />
          <meshStandardMaterial color={PALETTE.darkMetal} />
        </mesh>
      ))}

      {/* Silo: patas, cono inferior, cuerpo translúcido con el nivel y techo */}
      <group position={SILO}>
        {[
          [0.38, 0.38],
          [-0.38, 0.38],
          [0.38, -0.38],
          [-0.38, -0.38],
        ].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, SILO_BASE / 2 - 0.2, z]}>
            <cylinderGeometry args={[0.04, 0.04, SILO_BASE - 0.4, 6]} />
            <meshStandardMaterial color={PALETTE.darkMetal} />
          </mesh>
        ))}
        <mesh position={[0, SILO_BASE - 0.25, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[SILO_RADIUS, 0.5, 20]} />
          <meshStandardMaterial color={fill > 0 ? PALETTE.feed : PALETTE.metal} />
        </mesh>
        <mesh position={[0, SILO_BASE + fillHeight / 2, 0]}>
          <cylinderGeometry args={[SILO_RADIUS - 0.04, SILO_RADIUS - 0.04, fillHeight, 20]} />
          <meshStandardMaterial color={PALETTE.feed} />
        </mesh>
        <mesh position={[0, SILO_BASE + SILO_HEIGHT / 2, 0]}>
          <cylinderGeometry args={[SILO_RADIUS, SILO_RADIUS, SILO_HEIGHT, 24, 1, true]} />
          <meshStandardMaterial color={PALETTE.metal} transparent opacity={0.35} depthWrite={false} side={DoubleSide} />
        </mesh>
        <mesh raycast={noRaycast} position={[0, SILO_BASE + SILO_HEIGHT + 0.18, 0]}>
          <coneGeometry args={[SILO_RADIUS + 0.05, 0.36, 24]} />
          <meshStandardMaterial color={PALETTE.metal} />
        </mesh>
      </group>

      {/* Sinfín del silo al comedero y grano en movimiento */}
      <Pipe from={[SILO[0] + 0.2, 1.05, FEEDER_Z]} to={[-BARN.length / 2 + 0.6, 0.42, FEEDER_Z]} radius={0.06} color={PALETTE.darkMetal} />
      <Flow
        from={[SILO[0] + 0.2, 1.14, FEEDER_Z]}
        to={[-BARN.length / 2 + 0.6, 0.52, FEEDER_Z]}
        active={active}
        color={PALETTE.feed}
        count={6}
        speed={0.8}
      />
    </group>
  );
}

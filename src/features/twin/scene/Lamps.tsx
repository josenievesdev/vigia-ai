import { DoubleSide } from 'three';

import { BARN, LAMP_XS, LAMP_Y, PALETTE } from './layout';
import { type SelectHandler, tapHandler } from './shared';

/** Luminarias del galpón: brillan y alumbran el interior cuando la iluminación está encendida. */
export function Lamps({ on, onSelect }: { on: boolean; onSelect: SelectHandler }) {
  return (
    <group onClick={tapHandler('lighting', onSelect)}>
      {LAMP_XS.map((x) => (
        <group key={x} position={[x, LAMP_Y, 0]}>
          <mesh position={[0, (BARN.ridge - LAMP_Y) / 2, 0]}>
            <cylinderGeometry args={[0.012, 0.012, BARN.ridge - LAMP_Y, 4]} />
            <meshStandardMaterial color={PALETTE.darkMetal} />
          </mesh>
          <mesh position={[0, 0.04, 0]}>
            <coneGeometry args={[0.2, 0.12, 16, 1, true]} />
            <meshStandardMaterial color={PALETTE.darkMetal} side={DoubleSide} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.09, 12, 10]} />
            <meshStandardMaterial
              color={on ? PALETTE.lampOn : PALETTE.lampOff}
              emissive={PALETTE.lampOn}
              emissiveIntensity={on ? 2.2 : 0}
            />
          </mesh>
        </group>
      ))}
      <pointLight position={[0, LAMP_Y - 0.3, 0]} intensity={on ? 22 : 0} distance={16} decay={1.4} color="#ffd9a0" />
    </group>
  );
}

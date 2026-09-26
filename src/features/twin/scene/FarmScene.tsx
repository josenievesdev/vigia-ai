import { Color } from 'three';

import type { ColorTokens } from '@/theme';

import type { TwinElementId, TwinState } from '../twinState';
import { Barn } from './Barn';
import { OrbitCamera } from './OrbitCamera';
import { Fans } from './Fans';
import { Feeder } from './Feeder';
import { Halo } from './Halo';
import { Hens } from './Hens';
import { Lamps } from './Lamps';
import { type CameraGoal, PALETTE } from './layout';
import { SensorNodes } from './SensorNodes';
import { noRaycast, type SelectHandler } from './shared';
import { Water } from './Water';

const SKY = {
  light: { day: '#cfe5f3', night: '#1b2733' },
  dark: { day: '#2b4455', night: '#0b1117' },
};

interface FarmSceneProps {
  twin: TwinState;
  goal: CameraGoal;
  selected: TwinElementId | null;
  onSelect: SelectHandler;
  colors: ColorTokens;
  scheme: 'light' | 'dark';
}

/** Escena completa del gemelo: todo lo que se ve se deriva de `TwinState`. */
export function FarmScene({ twin, goal, selected, onSelect, colors, scheme }: FarmSceneProps) {
  const sky = SKY[scheme];
  const background = `#${new Color(sky.night).lerp(new Color(sky.day), twin.daylight).getHexString()}`;
  const alertEntries = Object.entries(twin.alerts).filter(
    (entry): entry is [TwinElementId, 'warning' | 'critical'] => entry[1] !== null && entry[0] !== 'climate',
  );

  return (
    <>
      <color attach="background" args={[background]} />
      {/* La niebla funde el borde del terreno con el cielo. */}
      <fog attach="fog" args={[background, 40, 150]} />

      <hemisphereLight args={['#dfeefc', '#5d6b45', 0.35 + 0.9 * twin.daylight]} />
      <directionalLight position={[9, 14, 7]} intensity={0.25 + 2.3 * twin.daylight} color="#fff4e0" />
      <ambientLight intensity={0.18} />

      <mesh raycast={noRaycast} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[300, 64]} />
        <meshStandardMaterial color={PALETTE.grass} />
      </mesh>

      <Barn climateStatus={twin.climateStatus} colors={colors} onSelect={onSelect} />
      <Hens activity={twin.activity} resting={twin.resting} onSelect={onSelect} />
      <Fans active={twin.fanActive} onSelect={onSelect} />
      <Feeder level={twin.feedLevel} active={twin.feederActive} onSelect={onSelect} />
      <Water level={twin.waterLevel} pumpActive={twin.pumpActive} onSelect={onSelect} />
      <Lamps on={twin.lampsOn} onSelect={onSelect} />
      <SensorNodes sensors={twin.sensors} colors={colors} onSelect={onSelect} />

      {alertEntries.map(([element, severity]) => (
        <Halo
          key={`alert-${element}`}
          element={element}
          color={severity === 'critical' ? colors.critical : colors.warning}
          pulse
        />
      ))}
      {selected ? <Halo key={`sel-${selected}`} element={selected} color={colors.info} pulse={false} width={0.06} /> : null}

      <OrbitCamera goal={goal} onSelect={onSelect} />
    </>
  );
}

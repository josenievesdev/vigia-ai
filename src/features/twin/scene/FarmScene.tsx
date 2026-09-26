import { useMemo } from 'react';
import { Color } from 'three';

import type { FlockAction } from '@/domain/behavior/types';

import type { ColorTokens } from '@/theme';

import { behaviorWorldFor, type TwinElementId, type TwinState } from '../twinState';
import { Barn } from './Barn';
import { OrbitCamera } from './OrbitCamera';
import { Rain } from './Rain';
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
  light: { day: '#cfe5f3', night: '#1b2733', dusk: '#f0a36c', overcast: '#b3bcc4' },
  dark: { day: '#2b4455', night: '#0b1117', dusk: '#7d452c', overcast: '#39434b' },
};
const RAD = Math.PI / 180;

/** Color del cielo según el sol real: noche → crepúsculo anaranjado → día; las nubes lo agrisan. */
function skyColor(scheme: 'light' | 'dark', twin: TwinState): string {
  const sky = SKY[scheme];
  const color = new Color(sky.night).lerp(new Color(sky.day), twin.daylight);
  color.lerp(new Color(sky.dusk), twin.twilight * 0.55);
  color.lerp(new Color(sky.overcast), twin.cloudCover * 0.4 * twin.daylight);
  return `#${color.getHexString()}`;
}

/** Dirección del sol en la escena: +X = este, −Z = norte (el galpón va de este a oeste). */
function sunDirection(elevation: number, azimuth: number): [number, number, number] {
  const el = elevation * RAD;
  const az = azimuth * RAD;
  return [Math.cos(el) * Math.sin(az) * 30, Math.max(0.5, Math.sin(el) * 30), -Math.cos(el) * Math.cos(az) * 30];
}

interface FarmSceneProps {
  twin: TwinState;
  goal: CameraGoal;
  selected: TwinElementId | null;
  onSelect: SelectHandler;
  colors: ColorTokens;
  scheme: 'light' | 'dark';
  onFlockSummary?: (counts: Record<FlockAction, number>) => void;
}

/** Escena completa del gemelo: todo lo que se ve se deriva de `TwinState`. */
export function FarmScene({ twin, goal, selected, onSelect, colors, scheme, onFlockSummary }: FarmSceneProps) {
  const world = useMemo(() => behaviorWorldFor(twin), [twin]);

  const background = skyColor(scheme, twin);
  const sunUp = twin.sun.elevation > 0;
  const sunIntensity = sunUp ? (0.35 + 2.2 * twin.daylight) * (1 - 0.55 * twin.cloudCover) : 0;
  // Luz rasante más cálida al amanecer y al atardecer.
  const sunColor = `#${new Color('#ffc995').lerp(new Color('#fff4e0'), Math.min(1, Math.max(0, twin.sun.elevation / 20))).getHexString()}`;
  const alertEntries = Object.entries(twin.alerts).filter(
    (entry): entry is [TwinElementId, 'warning' | 'critical'] => entry[1] !== null && entry[0] !== 'climate',
  );

  return (
    <>
      <color attach="background" args={[background]} />
      {/* La niebla funde el borde del terreno con el cielo. */}
      <fog attach="fog" args={[background, 40, 150]} />

      <hemisphereLight args={['#dfeefc', '#5d6b45', 0.3 + 0.85 * twin.daylight * (1 - 0.3 * twin.cloudCover)]} />
      <directionalLight
        position={sunDirection(twin.sun.elevation, twin.sun.azimuth)}
        intensity={sunIntensity}
        color={sunColor}
      />
      <ambientLight intensity={0.2} />

      <mesh raycast={noRaycast} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[300, 64]} />
        <meshStandardMaterial color={PALETTE.grass} />
      </mesh>

      <Barn climateStatus={twin.climateStatus} colors={colors} onSelect={onSelect} />
      <Hens world={world} onSelect={onSelect} onSummary={onFlockSummary} />
      <Fans active={twin.fanActive} onSelect={onSelect} />
      <Feeder level={twin.feedLevel} active={twin.feederActive} onSelect={onSelect} />
      <Water level={twin.waterLevel} pumpActive={twin.pumpActive} onSelect={onSelect} />
      <Lamps on={twin.lampsOn} onSelect={onSelect} />
      <SensorNodes sensors={twin.sensors} colors={colors} onSelect={onSelect} />
      <Rain intensity={twin.rain} />

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

import { StyleSheet, View } from 'react-native';

import type { FlockAction } from '@/domain/behavior/types';
import type { ColorTokens } from '@/theme';

import { Canvas } from './Canvas3D';
import { FarmScene } from './scene/FarmScene';
import type { CameraGoal } from './scene/layout';
import type { SelectHandler } from './scene/shared';
import type { TwinElementId, TwinState } from './twinState';

interface TwinViewportProps {
  twin: TwinState;
  goal: CameraGoal;
  selected: TwinElementId | null;
  onSelect: SelectHandler;
  colors: ColorTokens;
  scheme: 'light' | 'dark';
  /** false pausa el render (pestaña no visible) para ahorrar batería. */
  active: boolean;
  onFlockSummary?: (counts: Record<FlockAction, number>) => void;
}

export function TwinViewport({ twin, goal, selected, onSelect, colors, scheme, active, onFlockSummary }: TwinViewportProps) {
  return (
    <View style={styles.root}>
      <Canvas
        style={{ flex: 1 }}
        frameloop={active ? 'always' : 'never'}
        camera={{ fov: 42, near: 0.1, far: 400, position: [12, 9, 12] }}>
        <FarmScene
          twin={twin}
          goal={goal}
          selected={selected}
          onSelect={onSelect}
          colors={colors}
          scheme={scheme}
          onFlockSummary={onFlockSummary}
        />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
});

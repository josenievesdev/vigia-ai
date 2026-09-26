import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { NATURAL_LIGHT } from '@/domain/lighting';
import type { ActuatorKind, SensorKind } from '@/domain/types';
import type { FarmState } from '@/store/farmStore';
import { useFarmStore } from '@/store/useFarmStore';

import { buildTwinState, type TwinInput, type TwinState } from './twinState';

type TwinSource = Pick<
  FarmState,
  'now' | 'profile' | 'farm' | 'environment' | 'sensors' | 'readings' | 'sensorStatus' | 'actuators' | 'actuatorStates' | 'alerts'
>;

/** Estado visual del gemelo para la zona principal a partir del estado de la granja (puro). */
export function twinStateFrom(s: TwinSource): TwinState | null {
  const zone = s.farm?.zones[0];
  if (s.now === null || !s.profile || !zone || !s.environment) return null;
  const readings: TwinInput['readings'] = {};
  const sensorIds: TwinInput['sensorIds'] = {};
  for (const sensor of s.sensors) {
    if (sensor.zoneId !== zone.id) continue;
    const online = s.sensorStatus[sensor.id]?.online ?? false;
    readings[sensor.kind as SensorKind] = { value: online ? s.readings[sensor.id]?.value : undefined, online };
    sensorIds[sensor.kind] = sensor.id;
  }
  const actuators: TwinInput['actuators'] = {};
  for (const a of s.actuators) {
    if (a.zoneId === zone.id) actuators[a.kind as ActuatorKind] = s.actuatorStates[a.id]?.active ?? false;
  }
  return buildTwinState({
    now: s.now,
    profile: s.profile,
    light: s.environment.light,
    lighting: zone.lighting ?? NATURAL_LIGHT,
    outside: s.environment.outside,
    readings,
    actuators,
    alerts: s.alerts.filter((a) => a.zoneId === zone.id),
    sensorIds,
  });
}

/** Estado visual del gemelo, recalculado con cada lectura. */
export function useTwinState(): TwinState | null {
  const s = useFarmStore(
    useShallow((st) => ({
      now: st.now,
      profile: st.profile,
      farm: st.farm,
      environment: st.environment,
      sensors: st.sensors,
      readings: st.readings,
      sensorStatus: st.sensorStatus,
      actuators: st.actuators,
      actuatorStates: st.actuatorStates,
      alerts: st.alerts,
    })),
  );
  return useMemo(() => twinStateFrom(s), [s]);
}

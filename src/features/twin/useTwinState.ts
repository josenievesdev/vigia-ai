import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { ActuatorKind, SensorKind } from '@/domain/types';
import { useFarmClock } from '@/hooks/use-farm-clock';
import { useFarmStore } from '@/store/useFarmStore';

import { buildTwinState, type TwinInput, type TwinState } from './twinState';

/** Estado visual del gemelo para la zona principal, recalculado con cada lectura. */
export function useTwinState(): TwinState | null {
  const s = useFarmStore(
    useShallow((st) => ({
      now: st.now,
      profile: st.profile,
      zoneId: st.farm?.zones[0]?.id,
      sensors: st.sensors,
      readings: st.readings,
      sensorStatus: st.sensorStatus,
      actuators: st.actuators,
      actuatorStates: st.actuatorStates,
      alerts: st.alerts,
    })),
  );
  const { isPhotoperiod } = useFarmClock();

  return useMemo(() => {
    if (s.now === null || !s.profile || !s.zoneId) return null;
    const readings: TwinInput['readings'] = {};
    const sensorIds: TwinInput['sensorIds'] = {};
    for (const sensor of s.sensors) {
      if (sensor.zoneId !== s.zoneId) continue;
      const online = s.sensorStatus[sensor.id]?.online ?? false;
      readings[sensor.kind as SensorKind] = { value: online ? s.readings[sensor.id]?.value : undefined, online };
      sensorIds[sensor.kind] = sensor.id;
    }
    const actuators: TwinInput['actuators'] = {};
    for (const a of s.actuators) {
      if (a.zoneId === s.zoneId) actuators[a.kind as ActuatorKind] = s.actuatorStates[a.id]?.active ?? false;
    }
    return buildTwinState({
      now: s.now,
      profile: s.profile,
      isPhotoperiod,
      readings,
      actuators,
      alerts: s.alerts.filter((a) => a.zoneId === s.zoneId),
      sensorIds,
    });
  }, [s, isPhotoperiod]);
}

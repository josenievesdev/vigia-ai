import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { computeHealth } from '@/engine/alerts/AlertManager';
import type { ActuatorKind, ActuatorMode, SensorKind } from '@/domain/types';

import type { FarmState } from './farmStore';
import { useFarmStore } from './useFarmStore';

/** Zona principal. El MVP tiene una; la UI multi-zona llegará después. */
export const usePrimaryZone = () => useFarmStore((s) => s.farm?.zones[0] ?? null);

export function selectReading(s: FarmState, zoneId: string, kind: SensorKind) {
  const sensor = s.sensors.find((x) => x.zoneId === zoneId && x.kind === kind);
  if (!sensor) return { value: undefined, online: false };
  const online = s.sensorStatus[sensor.id]?.online ?? false;
  return { value: online ? s.readings[sensor.id]?.value : undefined, online };
}

export function useReading(zoneId: string | undefined, kind: SensorKind) {
  return useFarmStore(
    useShallow((s) => (zoneId ? selectReading(s, zoneId, kind) : { value: undefined, online: false })),
  );
}

export interface ActuatorView {
  id: string;
  kind: ActuatorKind;
  label: string;
  active: boolean;
  mode: ActuatorMode;
  changedAt: number | null;
}

export function useActuators(zoneId: string | undefined): ActuatorView[] {
  // Se seleccionan referencias estables y la vista se deriva fuera del selector,
  // para no crear objetos nuevos en cada lectura del store.
  const { actuators, states, modes } = useFarmStore(
    useShallow((s) => ({ actuators: s.actuators, states: s.actuatorStates, modes: s.actuatorModes })),
  );
  return useMemo(
    () =>
      actuators
        .filter((a) => a.zoneId === zoneId)
        .map((a) => ({
          id: a.id,
          kind: a.kind,
          label: a.label,
          active: states[a.id]?.active ?? false,
          mode: modes[a.id] ?? 'auto',
          changedAt: states[a.id]?.changedAt ?? null,
        })),
    [actuators, states, modes, zoneId],
  );
}

export const useHealth = () => useFarmStore((s) => computeHealth(s.alerts));

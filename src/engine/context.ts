import { lightState, NATURAL_LIGHT } from '@/domain/lighting';
import type { SpeciesProfile } from '@/domain/profiles';
import { hourOfDay } from '@/domain/time';
import type {
  Actuator,
  ActuatorMode,
  ActuatorState,
  Farm,
  Sensor,
  SensorReading,
  SensorStatus,
  Timestamp,
} from '@/domain/types';

import type { ZoneContext } from './types';

export interface FarmSnapshot {
  now: Timestamp;
  farm: Farm;
  profile: SpeciesProfile;
  sensors: Sensor[];
  actuators: Actuator[];
  readings: Record<string, SensorReading>;
  sensorStatus: Record<string, SensorStatus>;
  actuatorStates: Record<string, ActuatorState>;
  actuatorModes: Record<string, ActuatorMode>;
}

/** Traduce el estado plano de la granja al contexto por zona que consumen las reglas. */
export function buildZoneContexts(s: FarmSnapshot): ZoneContext[] {
  const hour = hourOfDay(s.now);

  return s.farm.zones.map((zone) => {
    const ctx: ZoneContext = {
      now: s.now,
      hour,
      light: lightState(s.now, s.farm.location, zone.lighting ?? NATURAL_LIGHT),
      zone,
      profile: s.profile,
      readings: {},
      sensors: [],
      actuators: {},
    };

    for (const sensor of s.sensors) {
      if (sensor.zoneId !== zone.id) continue;
      const status = s.sensorStatus[sensor.id];
      const online = status?.online ?? false;
      ctx.sensors.push({ sensor, online, lastSeenAt: status?.lastSeenAt ?? null });
      const reading = s.readings[sensor.id];
      if (online && reading) ctx.readings[sensor.kind] = reading.value;
    }

    for (const actuator of s.actuators) {
      if (actuator.zoneId !== zone.id) continue;
      ctx.actuators[actuator.kind] = {
        actuator,
        active: s.actuatorStates[actuator.id]?.active ?? false,
        mode: s.actuatorModes[actuator.id] ?? 'auto',
      };
    }

    return ctx;
  });
}

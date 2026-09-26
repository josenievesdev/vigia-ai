import type { SpeciesProfile } from '@/domain/profiles';
import { readingStatus } from '@/domain/status';
import type { SensorKind } from '@/domain/types';
import type { Tone } from '@/theme';

/** Tono visual de una lectura: desconectado, sin dato o estado según umbrales. */
export function readingTone(
  kind: SensorKind,
  reading: { value: number | undefined; online: boolean },
  profile: SpeciesProfile,
  opts?: { isLightPeriod?: boolean; temperature?: number },
): Tone {
  if (!reading.online) return 'offline';
  if (reading.value === undefined) return 'neutral';
  return readingStatus(kind, reading.value, profile, opts);
}

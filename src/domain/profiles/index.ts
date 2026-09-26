import type { SpeciesId } from '@/domain/types';

import { layingHensProfile } from './layingHens';
import type { SpeciesProfile } from './types';

export type { Band, Hysteresis, SpeciesProfile } from './types';

const profiles: Record<SpeciesId, SpeciesProfile> = {
  layingHens: layingHensProfile,
};

export function getSpeciesProfile(id: SpeciesId): SpeciesProfile {
  return profiles[id];
}

import type { SpeciesProfile } from './profiles';
import type { Timestamp } from './types';

/** Hora local fraccionaria (0–24) de un instante. */
export function hourOfDay(time: Timestamp): number {
  const d = new Date(time);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

export function isPhotoperiod(time: Timestamp, profile: SpeciesProfile): boolean {
  const h = hourOfDay(time);
  const { startHour, endHour } = profile.control.photoperiod;
  return h >= startHour && h < endHour;
}

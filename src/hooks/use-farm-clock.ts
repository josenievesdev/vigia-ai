import { isPhotoperiod } from '@/domain/time';
import { useFarmStore } from '@/store/useFarmStore';

/** Hora actual de la granja (según la telemetría) y si está en periodo de luz. */
export function useFarmClock() {
  const now = useFarmStore((s) => s.now);
  const profile = useFarmStore((s) => s.profile);
  return {
    now,
    isPhotoperiod: now !== null && profile !== null ? isPhotoperiod(now, profile) : true,
  };
}

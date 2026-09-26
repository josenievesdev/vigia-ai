import type { LightState } from '@/domain/lighting';
import { useFarmStore } from '@/store/useFarmStore';

/** Hora actual de la granja y su estado de luz (sol real + programa de iluminación). */
export function useFarmClock(): { now: number | null; light: LightState | null; isLightPeriod: boolean } {
  const now = useFarmStore((s) => s.now);
  const light = useFarmStore((s) => s.environment?.light ?? null);
  return { now, light, isLightPeriod: light?.isLightPeriod ?? true };
}

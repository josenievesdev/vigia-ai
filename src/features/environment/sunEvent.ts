import type { LightState } from '@/domain/lighting';

/** Próximo evento solar a mostrar: "Anochece 17:47" de día, "Amanece 05:42" de noche. */
export function nextSunEvent(light: LightState, now: number): { label: 'Amanece' | 'Anochece'; time: number } | null {
  const sun = light.sun;
  if (!sun) return null;
  if (now < sun.sunrise) return { label: 'Amanece', time: sun.sunrise };
  if (now < sun.sunset) return { label: 'Anochece', time: sun.sunset };
  return { label: 'Amanece', time: sun.sunrise + 86_400_000 };
}

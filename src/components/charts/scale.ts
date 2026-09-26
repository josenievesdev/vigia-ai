/** Escala lineal: dominio [d0, d1] → rango [r0, r1]. */
export function linearScale(d0: number, d1: number, r0: number, r1: number) {
  const span = d1 - d0 || 1;
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0);
}

function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const residual = raw / magnitude;
  const nice = residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1;
  return nice * magnitude;
}

/** Amplía [min, max] a números redondos y devuelve el dominio y sus marcas. */
export function niceDomain(min: number, max: number, count = 4): { domain: [number, number]; ticks: number[] } {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const step = niceStep(max - min, count);
  const d0 = Math.floor(min / step) * step;
  const d1 = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = d0; v <= d1 + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
  return { domain: [d0, d1], ticks };
}

const TIME_STEPS_MIN = [15, 30, 60, 120, 180, 240, 360];

/** Marcas de tiempo alineadas a la hora local (p. ej. 06:00, 12:00, 18:00). */
export function timeTicks(from: number, to: number, maxTicks = 5): number[] {
  const spanMin = (to - from) / 60_000;
  const step = TIME_STEPS_MIN.find((s) => spanMin / s <= maxTicks) ?? 720;
  const start = new Date(from);
  start.setSeconds(0, 0);
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15);
  const ticks: number[] = [];
  for (let t = start.getTime(); t <= to; t += 15 * 60_000) {
    const d = new Date(t);
    if ((d.getHours() * 60 + d.getMinutes()) % step === 0) ticks.push(t);
  }
  return ticks;
}

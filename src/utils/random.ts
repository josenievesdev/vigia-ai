/** Generador pseudoaleatorio con semilla (mulberry32) para simulaciones reproducibles. */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ruido uniforme en [-amplitude, amplitude]. */
export function noise(rng: Rng, amplitude: number): number {
  return (rng() * 2 - 1) * amplitude;
}

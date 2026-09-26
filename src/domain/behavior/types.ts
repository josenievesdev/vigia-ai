/**
 * Comportamiento animal al estilo de los NPC de videojuegos:
 * - IA de utilidad ("utility AI"): cada animal puntúa sus acciones posibles
 *   según sus necesidades y el ambiente, y elige la más útil.
 * - Comportamientos de dirección ("steering"): llegar a un destino y
 *   mantener distancia con los vecinos, como una bandada.
 * Módulo puro (sin three.js ni React): testeable y reutilizable por especie.
 */

export type FlockAction =
  | 'roost' // dormir en la percha
  | 'rest' // reposar echada de día
  | 'forage' // explorar y picotear el suelo
  | 'eat'
  | 'drink'
  | 'preen' // acicalarse
  | 'dustbathe' // baño de tierra
  | 'pant' // jadeo por calor: pico abierto, alas separadas
  | 'huddle' // amontonarse por frío
  | 'crowd' // agitación junto a comederos/bebederos vacíos
  | 'lethargic'; // decaimiento (enfermedad)

export interface Vec2 {
  x: number;
  z: number;
}

/** Lo que perciben los animales en este momento. */
export interface BehaviorWorld {
  /** 0 (oscuridad) … 1 (luz plena, natural o artificial). */
  light: number;
  /** 0–1 */
  heatStress: number;
  /** 0–1 */
  cold: number;
  /** 0–1 */
  sickness: number;
  waterAvailable: boolean;
  feedAvailable: boolean;
  fanActive: boolean;
}

/** Anclas del escenario (en metros), definidas por quien dibuja la escena. */
export interface BehaviorLayout {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Línea de comederos: las aves comen de pie a su lado. */
  feeder: { z: number; minX: number; maxX: number; side: 1 | -1 };
  /** Línea de bebederos (niples). */
  water: { z: number; minX: number; maxX: number; side: 1 | -1 };
  /** Un puesto de percha por animal. */
  perches: Vec2[];
  /** Zona más fresca (frente a los ventiladores), si existe. */
  coolSpot: Vec2 | null;
}

export interface Needs {
  /** 0 (saciada) … 1 (hambrienta) */
  hunger: number;
  thirst: number;
  /** 0 (agotada) … 1 (descansada) */
  energy: number;
}

/** Variación individual: no todas las gallinas se comportan igual. */
export interface Personality {
  activity: number;
  appetite: number;
  sociability: number;
}

export interface Agent {
  id: number;
  pos: Vec2;
  vel: Vec2;
  heading: number;
  action: FlockAction;
  /** Segundos en la acción actual. */
  actionTime: number;
  /** Segundos hasta la próxima decisión. */
  thinkIn: number;
  target: Vec2 | null;
  needs: Needs;
  personality: Personality;
  perch: number;
}

export interface Flock {
  agents: Agent[];
  /** Estado del generador aleatorio (determinista para pruebas). */
  seed: number;
}

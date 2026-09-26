import type { SensorKind } from '@/domain/types';

import type { TwinElementId } from '../twinState';

/**
 * Disposición del galpón en unidades de escena (~metros).
 * Eje X: largo del galpón; Z: ancho; Y: altura. Origen en el centro del piso.
 */

export type Vec3 = [number, number, number];

export const BARN = {
  length: 12,
  width: 5,
  kneeWall: 0.6,
  eave: 2.2,
  ridge: 3.0,
  floorTop: 0.08,
} as const;

export const FEEDER_Z = -1.1;
export const WATER_Z = 1.1;
export const SILO: Vec3 = [-8.2, 0, FEEDER_Z];
export const TANK: Vec3 = [-8.2, 0, 1.6];
export const FAN_X = BARN.length / 2 + 0.16;
export const FAN_ZS = [-1.25, 1.25];
export const FAN_Y = 1.25;
export const LAMP_XS = [-4.5, -1.5, 1.5, 4.5];
export const LAMP_Y = 2.45;

/** Figuras de aves en escena (representan a toda la población del galpón). */
export const HEN_FIGURES = 24;

export const SENSOR_POSITIONS: Record<SensorKind, Vec3> = {
  temperature: [0, 1.55, -2.42],
  humidity: [0.32, 1.55, -2.42],
  light: [2.8, 2.5, 0],
  animalActivity: [-5.85, 2.05, -2.38],
  waterLevel: [TANK[0], 1.85, TANK[2]],
  feedLevel: [SILO[0], 3.92, SILO[2]],
};

export interface CameraGoal {
  target: Vec3;
  distance: number;
  /** Ángulo horizontal (rad): 0 = frente del galpón (+Z); π/2 = muro de ventiladores (+X). */
  azimuth: number;
  /** Ángulo vertical (rad) sobre el horizonte. */
  elevation: number;
}

export type ViewId = 'general' | 'interior' | 'supplies' | 'ventilation';

export const VIEWS: Record<ViewId, CameraGoal & { label: string }> = {
  general: { label: 'General', target: [-1, 0.8, 0], distance: 17, azimuth: 0.7, elevation: 0.52 },
  interior: { label: 'Interior', target: [0, 0.5, 0], distance: 8.5, azimuth: 0.2, elevation: 0.85 },
  supplies: { label: 'Suministros', target: [-7.6, 1.2, 0.2], distance: 7.5, azimuth: -0.75, elevation: 0.32 },
  ventilation: { label: 'Ventilación', target: [5.8, 1.2, 0], distance: 7, azimuth: 1.25, elevation: 0.25 },
};

/** Enfoque de cámara al seleccionar un elemento. */
export const ELEMENT_FOCUS: Record<TwinElementId, CameraGoal> = {
  climate: { target: [0, 1.2, -1], distance: 7, azimuth: 0.35, elevation: 0.45 },
  hens: { target: [0, 0.3, 0], distance: 6, azimuth: 0.3, elevation: 0.75 },
  ventilation: VIEWS.ventilation,
  feeder: { target: [-7.2, 1.2, FEEDER_Z], distance: 6, azimuth: -0.55, elevation: 0.35 },
  water: { target: [-7.6, 0.9, TANK[2]], distance: 5.5, azimuth: -0.3, elevation: 0.3 },
  lighting: { target: [0, 2.2, 0], distance: 8, azimuth: 0.25, elevation: 0.35 },
};

/** Paleta de materiales de la escena (independiente del tema de la UI). */
export const PALETTE = {
  grass: '#7ea35a',
  bedding: '#d8c7a0',
  wall: '#ece6d8',
  wood: '#8a6a45',
  roof: '#b9c6cf',
  metal: '#9aa4ad',
  darkMetal: '#4e5a62',
  henBody: '#9a4f28',
  henComb: '#d7263d',
  henBeak: '#f2a93b',
  feed: '#d9b04e',
  water: '#3d9be9',
  lampOff: '#8d9296',
  lampOn: '#ffd873',
  device: '#2c363c',
};

import type { ThreeEvent } from '@react-three/fiber';

import type { ColorTokens } from '@/theme';

import type { TwinElementId, TwinStatus } from '../twinState';

/** Los elementos decorativos no deben capturar toques (p. ej. el techo translúcido). */
export const noRaycast = () => null;

/** Umbral de movimiento (px) para distinguir un toque de un arrastre. */
const TAP_MAX_DELTA = 8;

export type SelectHandler = (id: TwinElementId | null) => void;

/** Crea el manejador de toque de un elemento: selecciona y evita que el fondo lo reciba. */
export function tapHandler(id: TwinElementId, onSelect: SelectHandler) {
  return (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > TAP_MAX_DELTA) return;
    onSelect(id);
  };
}

export function statusColor(c: ColorTokens, status: TwinStatus): string {
  switch (status) {
    case 'warning':
      return c.warning;
    case 'critical':
      return c.critical;
    case 'offline':
    case 'neutral':
      return c.offline;
    default:
      return c.normal;
  }
}
